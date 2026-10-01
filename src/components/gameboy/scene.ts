import * as THREE from "three"
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"

import { createClouds, HORIZON } from "./clouds"
import { type Btn, H, type Screen, W } from "./screen"

/*
 * Posições dos botões no espaço do modelo, tiradas da própria malha. O corpo
 * é uma peça só, então o clique é decidido pelo ponto onde o raio bate.
 */
const DPAD = { x: -0.39, y: -0.33, r: 0.16 }
const BTN_A = { x: 0.44, y: -0.265, r: 0.08 }
const BTN_B = { x: 0.23, y: -0.355, r: 0.08 }
const SELECT = { x: -0.196, y: -0.628 }
const START = { x: 0.02, y: -0.628 }

/** Centro do Game Boy e da moldura da tela. */
/** Um pouco acima do meio, pra caber o gato sentado no topo. */
const BODY_CENTER = new THREE.Vector3(0, 0.2, 0)
/** Topo do Game Boy, onde o gato senta, e a altura dele. */
const CAT_SEAT = new THREE.Vector3(0.36, 1.075, 0.03)
const CAT_HEIGHT = 0.5
const SCREEN_CENTER = new THREE.Vector3(-0.015, 0.52, 0.16)
const HANDHELD = new THREE.Vector3(0, 0.02, 0.16)

const FOV = 30
const TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2))

function buttonAt(p: THREE.Vector3): Btn | null {
  if (p.z < 0.15) return null
  const dx = p.x - DPAD.x
  const dy = p.y - DPAD.y
  if (Math.abs(dx) < DPAD.r && Math.abs(dy) < DPAD.r && Math.min(Math.abs(dx), Math.abs(dy)) < 0.06) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 0.025) return null
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left"
    return dy > 0 ? "up" : "down"
  }
  if (Math.hypot(p.x - BTN_A.x, p.y - BTN_A.y) < BTN_A.r) return "a"
  if (Math.hypot(p.x - BTN_B.x, p.y - BTN_B.y) < BTN_B.r) return "b"
  for (const [b, c] of [["select", SELECT], ["start", START]] as const) {
    if (Math.abs(p.x - c.x) < 0.08 && Math.abs(p.y - c.y) < 0.05) return b
  }
  return null
}

export type SceneEvents = {
  onReady: () => void
  /** O Game Boy terminou de subir e girar. Hora de ligar a tela. */
  onLanded: () => void
  onZoom: (zoomed: boolean) => void
  onPress: (btn: Btn) => void
}

export function mountScene(container: HTMLElement, screen: Screen, ev: SceneEvents) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = 0.95
  container.appendChild(renderer.domElement)
  Object.assign(renderer.domElement.style, {
    display: "block",
    width: "100%",
    height: "100%",
    touchAction: "none",
  })

  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(HORIZON, 7, 20)
  const clouds = createClouds(scene, reduce)
  const pmrem = new THREE.PMREMGenerator(renderer)
  // Reflexo bem desfocado: com o ambiente nítido, as caixas de luz da sala
  // apareciam como listras na moldura da tela.
  const envMap = pmrem.fromScene(new RoomEnvironment(), 0.35).texture
  scene.environment = envMap
  scene.environmentIntensity = 0.6

  const key = new THREE.DirectionalLight(0xfff4e0, 1.8)
  key.position.set(2.5, 3, 4)
  scene.add(key)
  const rim = new THREE.DirectionalLight(0xb8c4ff, 0.6)
  rim.position.set(-3, 1, -2)
  scene.add(rim)

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 50)
  const rig = new THREE.Group()
  scene.add(rig)

  const texture = new THREE.CanvasTexture(screen.canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy()

  let body: THREE.Mesh | null = null
  let mixer: THREE.AnimationMixer | null = null

  /*
   * O gato mago sentado no canto de cima à direita. Fica pendurado no próprio
   * Game Boy, então sobe e gira junto. Escala e posição saem da caixa dele,
   * porque o arquivo vem num tamanho qualquer.
   */
  function loadCat(parent: THREE.Object3D) {
    new GLTFLoader().load("/models/wizard-cat.glb", (gltf) => {
      const cat = gltf.scene
      const box = new THREE.Box3().setFromObject(cat)
      const size = box.getSize(new THREE.Vector3())
      const s = CAT_HEIGHT / size.y
      cat.scale.setScalar(s)
      const center = box.getCenter(new THREE.Vector3())
      cat.position.set(CAT_SEAT.x - center.x * s, CAT_SEAT.y - box.min.y * s, CAT_SEAT.z - center.z * s)
      cat.rotation.y = -0.35
      cat.traverse((o) => {
        if (o instanceof THREE.Mesh) o.frustumCulled = false
      })
      parent.add(cat)
      if (gltf.animations.length) {
        mixer = new THREE.AnimationMixer(cat)
        mixer.clipAction(gltf.animations[0]).play()
      }
    })
  }
  let model: THREE.Object3D | null = null
  let display: THREE.Mesh | null = null

  new GLTFLoader().load("/models/gameboy.glb", (gltf) => {
    gltf.scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return
      const mat = o.material as THREE.MeshStandardMaterial
      if (mat.name === "gameboy_screen") {
        // A malha da tela tem UV invertida e com sobra. Aqui ela passa a
        // cobrir o canvas inteiro, com o topo da imagem no topo da tela.
        const uv = o.geometry.getAttribute("uv") as THREE.BufferAttribute
        const pos = o.geometry.getAttribute("position") as THREE.BufferAttribute
        o.geometry.computeBoundingBox()
        const bb = o.geometry.boundingBox!
        for (let i = 0; i < uv.count; i++) {
          uv.setXY(
            i,
            (pos.getX(i) - bb.min.x) / (bb.max.x - bb.min.x),
            (pos.getY(i) - bb.min.y) / (bb.max.y - bb.min.y)
          )
        }
        uv.needsUpdate = true
        o.material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false })
        display = o
      } else {
        body = o
      }
    })
    rig.add(gltf.scene)
    model = gltf.scene
    loadCat(gltf.scene)
    // HOLD segura o mar de nuvens sozinho na tela antes da subida. Em zero, ele
    // começa a subir assim que o modelo chega.
    landedAt = Math.max(performance.now(), mountedAt + HOLD)
    ev.onReady()
  })

  // ------------------------------------------------------------------ câmera

  /** Quando o modelo carregou e começou a subir das nuvens. */
  const mountedAt = performance.now()
  const HOLD = 0
  let landedAt = -1
  let landed = false
  /** Duração da subida, em segundos. */
  const RISE = 4.4
  let zoomed = false
  const target = BODY_CENTER.clone()
  let dist = 6

  function goal() {
    const aspect = camera.aspect
    if (zoomed) {
      // Em retrato a tela já ocupa a largura toda. Ali o zoom enquadra a tela
      // e os botões juntos, que é onde o dedo vai.
      if (aspect < 0.8) return { t: HANDHELD, d: 0.68 / (TAN * aspect) }
      // Perto o bastante pra ler a tela sem perder a moldura de vista.
      const d = Math.max(0.74 / TAN, 0.62 / (TAN * aspect))
      return { t: SCREEN_CENTER, d }
    }
    const d = Math.max(1.58 / TAN, 0.8 / (TAN * aspect))
    return { t: BODY_CENTER, d }
  }

  function setZoom(z: boolean) {
    if (z === zoomed) return
    zoomed = z
    ev.onZoom(z)
  }

  function resize() {
    const w = container.clientWidth
    const h = container.clientHeight
    renderer.setSize(w, h, false)
    camera.aspect = w / Math.max(h, 1)
    camera.updateProjectionMatrix()
  }
  const ro = new ResizeObserver(resize)
  ro.observe(container)
  resize()
  dist = goal().d * 1.25

  // ------------------------------------------------------------------ ponteiro

  const ray = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  const pointer = { x: 0, y: 0 }

  type Hit = { kind: "screen"; x: number; y: number } | { kind: "button"; btn: Btn } | { kind: "body" } | null

  function pick(e: PointerEvent | WheelEvent): Hit {
    const r = renderer.domElement.getBoundingClientRect()
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    if (!body || !display) return null
    ray.setFromCamera(ndc, camera)
    const [hit] = ray.intersectObjects([display, body], false)
    if (!hit) return null
    if (hit.object === display && hit.uv) {
      return { kind: "screen", x: hit.uv.x * W, y: (1 - hit.uv.y) * H }
    }
    const local = body.worldToLocal(hit.point.clone())
    const btn = buttonAt(local)
    return btn ? { kind: "button", btn } : { kind: "body" }
  }

  /** Empurrão rápido no modelo quando um botão é apertado. */
  const kick = { x: 0, y: 0 }

  function press(btn: Btn) {
    ev.onPress(btn)
    if (reduce) return
    if (btn === "left") kick.y -= 0.05
    else if (btn === "right") kick.y += 0.05
    else if (btn === "up") kick.x -= 0.05
    else if (btn === "down") kick.x += 0.05
    else kick.x += 0.035
  }

  function onMove(e: PointerEvent) {
    const r = container.getBoundingClientRect()
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1
    pointer.y = ((e.clientY - r.top) / r.height) * 2 - 1
    const hit = pick(e)
    let clickable = false
    if (!zoomed) clickable = hit !== null
    else if (hit?.kind === "screen") clickable = screen.hover(hit.x, hit.y)
    else if (hit?.kind === "button") clickable = true
    renderer.domElement.style.cursor = clickable ? "pointer" : ""
  }

  function onDown(e: PointerEvent) {
    const hit = pick(e)
    if (!zoomed) {
      if (hit) setZoom(true)
      return
    }
    if (!hit) return setZoom(false)
    if (hit.kind === "screen") screen.click(hit.x, hit.y)
    else if (hit.kind === "button") press(hit.btn)
  }

  let wheelAt = 0
  function onWheel(e: WheelEvent) {
    if (!zoomed) return
    const hit = pick(e)
    if (hit?.kind !== "screen") return
    e.preventDefault()
    const now = performance.now()
    if (now - wheelAt < 90) return
    wheelAt = now
    screen.scroll(e.deltaY > 0 ? 1 : -1)
  }

  const el = renderer.domElement
  el.addEventListener("pointermove", onMove)
  el.addEventListener("pointerdown", onDown)
  el.addEventListener("wheel", onWheel, { passive: false })

  // ------------------------------------------------------------------ loop

  const look = { x: 0, y: 0 }
  let raf = 0
  let last = performance.now()
  const start = last

  function frame(now: number) {
    raf = requestAnimationFrame(frame)
    const dt = Math.min((now - last) / 1000, 0.1)
    last = now
    const k = 1 - Math.exp(-dt * (reduce ? 20 : 4.5))

    const g = goal()
    target.lerp(g.t, k)
    dist += (g.d - dist) * k
    // A câmera acompanha o mouse um pouco. As camadas de nuvem andam em
    // velocidades diferentes e o céu ganha profundidade.
    const par = zoomed || reduce ? 0.05 : 0.35
    look.x += (pointer.x * par - look.x) * k
    look.y += (-pointer.y * par * 0.6 - look.y) * k
    camera.position.set(target.x + look.x, target.y + look.y, target.z + dist)
    camera.lookAt(target)

    const t = (now - start) / 1000
    const sway = zoomed || reduce ? 0.04 : 0.28
    kick.x *= Math.exp(-dt * 9)
    kick.y *= Math.exp(-dt * 9)
    const ry = pointer.x * sway + kick.y + (zoomed || reduce ? 0 : Math.sin(t * 0.5) * 0.06)
    const rx = pointer.y * sway * 0.5 + kick.x
    rig.rotation.y += (ry - rig.rotation.y) * k
    rig.rotation.x += (rx - rig.rotation.x) * k
    // Sobe das nuvens com uma desaceleração longa, girando um pouco no caminho.
    // A abertura toca mesmo com "reduzir movimento": é a única animação longa
    // e só roda uma vez. O que fica se mexendo o tempo todo é que para.
    const intro = landedAt < 0 ? 0 : Math.min(Math.max((now - landedAt) / 1000 / RISE, 0), 1)
    // Sai devagar de dentro da nuvem e freia longo no fim.
    const ease = intro < 0.5 ? 4 * intro * intro * intro : 1 - Math.pow(-2 * intro + 2, 3) / 2
    if (intro >= 1 && !landed) {
      landed = true
      ev.onLanded()
    }
    const float = zoomed || reduce ? 0 : Math.sin(t * 1.1) * 0.025
    rig.position.y = -2.9 * (1 - ease) + float
    rig.rotation.z = (1 - ease) * 0.22
    // Uma volta inteira enquanto sobe, acelerando e freando, e para de frente
    // antes da tela ligar.
    if (model) {
      // O giro começa quando ele já passou da superfície das nuvens.
      const p = Math.min(Math.max((intro - 0.4) / 0.55, 0), 1)
      const spin = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2
      model.rotation.y = (1 - spin) * Math.PI * 2
    }
    clouds.update(dt, ease, zoomed)

    mixer?.update(dt)
    if (screen.update(now)) texture.needsUpdate = true
    renderer.render(scene, camera)
  }
  raf = requestAnimationFrame(frame)

  return {
    setZoom,
    press,
    get zoomed() {
      return zoomed
    },
    dispose() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      el.removeEventListener("pointermove", onMove)
      el.removeEventListener("pointerdown", onDown)
      el.removeEventListener("wheel", onWheel)
      texture.dispose()
      clouds.dispose()
      envMap.dispose()
      pmrem.dispose()
      renderer.dispose()
      el.remove()
    },
  }
}
