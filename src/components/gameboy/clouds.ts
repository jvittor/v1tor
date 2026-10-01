import * as THREE from "three"

/** Cor do céu perto do horizonte. A neblina usa a mesma, pra nuvem longe sumir nele. */
export const HORIZON = 0xe6dccb

/** Um puff de nuvem: bolha clara em cima e a barriga puxando pro cinza azulado. */
function puffTexture(seed: number) {
  const size = 128
  const c = document.createElement("canvas")
  c.width = size
  c.height = size
  const x = c.getContext("2d")!
  let s = seed
  const rand = () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
  for (let i = 0; i < 7; i++) {
    const px = size * (0.32 + rand() * 0.36)
    const py = size * (0.36 + rand() * 0.3)
    const r = size * (0.16 + rand() * 0.16)
    const g = x.createRadialGradient(px, py, 0, px, py, r)
    g.addColorStop(0, "rgba(255,253,248,0.9)")
    g.addColorStop(0.6, "rgba(255,253,248,0.5)")
    g.addColorStop(1, "rgba(255,253,248,0)")
    x.fillStyle = g
    x.fillRect(0, 0, size, size)
  }
  x.globalCompositeOperation = "source-atop"
  const shade = x.createLinearGradient(0, size * 0.25, 0, size * 0.85)
  shade.addColorStop(0, "rgba(255,255,255,0)")
  shade.addColorStop(1, "rgba(140,148,182,0.5)")
  x.fillStyle = shade
  x.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

type Cluster = {
  group: THREE.Group
  mats: THREE.SpriteMaterial[]
  speed: number
  /** Metade da largura por onde ela anda antes de voltar do outro lado. */
  span: number
  opacity: number
  /** Na frente do Game Boy: fica quase transparente com zoom. */
  front: boolean
  /** Cortina da abertura: abre pro lado (-1 ou 1) e some. */
  part: number
  /** Afunda depois que o Game Boy passou por ela. */
  sink: number
  home: THREE.Vector3
}

export function createClouds(scene: THREE.Scene, reduce: boolean) {
  const textures = [11, 29, 47, 83, 131].map(puffTexture)
  const clusters: Cluster[] = []
  const root = new THREE.Group()
  scene.add(root)
  let seed = 7
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }

  /**
   * Uma nuvem é um bolo de puffs espalhados num elipsoide, cada um numa
   * profundidade. Quando a câmera mexe, eles se deslocam diferente entre si
   * e a nuvem ganha volume.
   */
  function cluster(
    x: number,
    y: number,
    z: number,
    size: number,
    opts: { puffs?: number; speed?: number; opacity?: number; front?: boolean; part?: number; sink?: number } = {}
  ) {
    const group = new THREE.Group()
    group.position.set(x, y, z)
    const mats: THREE.SpriteMaterial[] = []
    const n = opts.puffs ?? 6
    const opacity = opts.opacity ?? 0.95
    for (let i = 0; i < n; i++) {
      const mat = new THREE.SpriteMaterial({
        map: textures[Math.floor(rand() * textures.length)],
        transparent: true,
        depthWrite: false,
        opacity,
        fog: true,
      })
      const sp = new THREE.Sprite(mat)
      const a = rand() * Math.PI * 2
      const r = Math.sqrt(rand())
      sp.position.set(Math.cos(a) * r * size * 1.1, (rand() - 0.35) * size * 0.35, (rand() - 0.5) * size * 0.8)
      const k = size * (0.55 + rand() * 0.5)
      sp.scale.set(k * 1.25, k, 1)
      group.add(sp)
      mats.push(mat)
    }
    root.add(group)
    clusters.push({
      group,
      mats,
      speed: opts.speed ?? 0.06,
      span: 7 + Math.max(0, -z) * 0.75,
      opacity,
      front: opts.front ?? false,
      part: opts.part ?? 0,
      sink: opts.sink ?? 0,
      home: group.position.clone(),
    })
  }

  // Céu ao fundo.
  for (let i = 0; i < 10; i++) {
    cluster(-14 + rand() * 28, -2 + rand() * 6, -9 - rand() * 6, 2.4 + rand() * 1.8, {
      puffs: 5,
      speed: 0.05 + rand() * 0.05,
      opacity: 0.8,
    })
  }
  // Atrás do Game Boy, mais perto.
  for (let i = 0; i < 7; i++) {
    cluster(-7 + rand() * 14, -1.2 + rand() * 3, -2.5 - rand() * 2, 1.4 + rand() * 0.8, {
      puffs: 6,
      speed: 0.08 + rand() * 0.06,
    })
  }
  // O mar de nuvens de onde ele sobe. A parte de trás fica sempre.
  for (let i = 0; i < 9; i++) {
    cluster(-5.5 + rand() * 11, -1.6 - rand() * 0.6, -1.8 + rand() * 2, 1.3 + rand() * 0.7, {
      puffs: 7,
      speed: 0.04 + rand() * 0.04,
    })
  }
  // A parte da frente é grossa e cobre a metade de baixo da tela. O Game Boy
  // atravessa ela subindo, e depois ela afunda pra borda.
  for (let i = 0; i < 16; i++) {
    cluster(-5 + (i / 15) * 10 + (rand() - 0.5) * 0.8, -1.05 - rand() * 0.5, 0.7 + rand() * 1.4, 1.2 + rand() * 0.6, {
      puffs: 7,
      speed: 0.03 + rand() * 0.03,
      front: true,
      sink: 1,
    })
  }
  // Fiapos que passam na frente dele de vez em quando, na altura dos botões,
  // finos o bastante pra não esconder nada por muito tempo.
  for (let i = 0; i < 3; i++) {
    cluster(-6 + i * 4.5 + rand(), -1.05 + rand() * 0.45, 1.3 + rand() * 0.7, 0.55 + rand() * 0.3, {
      puffs: 4,
      speed: 0.2 + rand() * 0.08,
      opacity: 0.6,
      front: true,
    })
  }
  // Cortina da abertura: cobre o centro enquanto carrega e abre quando ele sobe.
  for (let i = 0; i < 6; i++) {
    const side = i % 2 === 0 ? -1 : 1
    cluster(side * (0.3 + rand() * 0.7), -1 + rand() * 2.2, 1.6 + rand() * 0.6, 1.1 + rand() * 0.5, {
      puffs: 6,
      speed: 0,
      part: side,
    })
  }

  let frontFade = 1

  return {
    /** `intro` vai de 0 a 1 enquanto o Game Boy sobe. */
    update(dt: number, intro: number, zoomed: boolean) {
      frontFade += ((zoomed ? 0.12 : 1) - frontFade) * (1 - Math.exp(-dt * 4))
      for (const c of clusters) {
        const p = c.group.position
        if (c.part) {
          const k = intro
          p.x = c.home.x + c.part * k * k * 4
          p.y = c.home.y - k * 0.4
          c.group.visible = k < 1
          for (const m of c.mats) m.opacity = c.opacity * (1 - k) * frontFade
          continue
        }
        if (c.front) for (const m of c.mats) m.opacity = c.opacity * frontFade
        if (c.sink) {
          const k = Math.min(Math.max((intro - 0.55) / 0.45, 0), 1)
          p.y = c.home.y - c.sink * k * k * 1.15
        }
        if (reduce) continue
        p.x += c.speed * dt
        if (p.x > c.span) p.x -= c.span * 2
      }
    },
    dispose() {
      for (const c of clusters) for (const m of c.mats) m.dispose()
      for (const t of textures) t.dispose()
      scene.remove(root)
    },
  }
}
