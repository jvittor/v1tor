import { noiseBuffer } from "./sound"

export type Track = { src: string; artist: string; title: string }

/** Volume da música de longe e de perto (com zoom). Baixo de propósito. */
const FAR = 0.16
const NEAR = 0.3

/** Curva de saturação leve, o alto-falante pequeno não aguenta grave. */
function softClip(k: number) {
  const n = 1024
  const curve = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    curve[i] = Math.tanh(k * x) / Math.tanh(k)
  }
  return curve
}

/*
 * A música sai "pelo Game Boy": mono, cortada na faixa de uma ligação
 * telefônica (300 a 3400 Hz), um pico metálico no meio, saturação e um
 * chiado de linha bem baixinho por baixo.
 */
export class Radio {
  private el = new Audio()
  private order: Track[] = []
  private i = -1
  private out: GainNode
  private fails = 0

  constructor(
    private ctx: AudioContext,
    dest: AudioNode,
    tracks: Track[]
  ) {
    this.order = [...tracks].sort(() => Math.random() - 0.5)
    this.el.preload = "auto"

    const src = ctx.createMediaElementSource(this.el)
    const mono = ctx.createGain()
    mono.channelCount = 1
    mono.channelCountMode = "explicit"
    mono.channelInterpretation = "speakers"

    const hp = ctx.createBiquadFilter()
    hp.type = "highpass"
    hp.frequency.value = 320
    hp.Q.value = 0.8
    const lp = ctx.createBiquadFilter()
    lp.type = "lowpass"
    lp.frequency.value = 3200
    lp.Q.value = 0.9
    const tin = ctx.createBiquadFilter()
    tin.type = "peaking"
    tin.frequency.value = 1700
    tin.gain.value = 5
    tin.Q.value = 1.1
    const shaper = ctx.createWaveShaper()
    shaper.curve = softClip(2.2)
    shaper.oversample = "2x"
    const lp2 = ctx.createBiquadFilter()
    lp2.type = "lowpass"
    lp2.frequency.value = 3400

    this.out = ctx.createGain()
    this.out.gain.value = 0
    src.connect(mono).connect(hp).connect(lp).connect(tin).connect(shaper).connect(lp2).connect(this.out)

    const hiss = ctx.createBufferSource()
    hiss.buffer = noiseBuffer(ctx, 2)
    hiss.loop = true
    const hissBand = ctx.createBiquadFilter()
    hissBand.type = "bandpass"
    hissBand.frequency.value = 2500
    hissBand.Q.value = 0.7
    const hissGain = ctx.createGain()
    hissGain.gain.value = 0.006
    hiss.connect(hissBand).connect(hissGain).connect(this.out)
    hiss.start()

    this.out.connect(dest)

    this.el.addEventListener("ended", () => this.next())
    this.el.addEventListener("error", () => {
      // Um arquivo quebrado pula pro próximo, sem ficar em loop se todos falharem.
      if (++this.fails < this.order.length) this.next()
    })
    this.el.addEventListener("playing", () => {
      this.fails = 0
    })
  }

  get current(): Track | null {
    return this.order[this.i] ?? null
  }

  get empty() {
    return this.order.length === 0
  }

  start() {
    if (this.empty) return
    this.next()
    // Entra devagar, em uns 4 segundos.
    this.out.gain.setTargetAtTime(FAR, this.ctx.currentTime, 1.4)
  }

  next() {
    if (this.empty) return
    this.i = (this.i + 1) % this.order.length
    this.el.src = this.order[this.i].src
    void this.el.play().catch(() => undefined)
  }

  stop() {
    this.el.pause()
    this.el.removeAttribute("src")
  }

  setNear(near: boolean) {
    this.out.gain.setTargetAtTime(near ? NEAR : FAR, this.ctx.currentTime, 0.6)
  }
}
