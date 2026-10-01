import { noiseBuffer } from "./sound"

/** Volume geral da cidade. Fica embaixo da música. */
const LEVEL = 0.5

/*
 * Barulho de cidade feito na hora, sem arquivo: ronco grave de trânsito que
 * sobe e desce, vento, carros passando de um lado pro outro e uma buzina
 * longe de vez em quando.
 */
export class City {
  private out: GainNode
  private noise: AudioBuffer
  private timers: number[] = []

  constructor(
    private ctx: AudioContext,
    dest: AudioNode
  ) {
    this.out = ctx.createGain()
    this.out.gain.value = 0
    this.out.connect(dest)
    this.noise = noiseBuffer(ctx, 4)

    // Ronco do trânsito.
    const rumble = ctx.createBufferSource()
    rumble.buffer = noiseBuffer(ctx, 6, true)
    rumble.loop = true
    const rumbleLp = ctx.createBiquadFilter()
    rumbleLp.type = "lowpass"
    rumbleLp.frequency.value = 260
    const rumbleGain = ctx.createGain()
    rumbleGain.gain.value = 0.05
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.06
    const lfoDepth = ctx.createGain()
    lfoDepth.gain.value = 0.015
    lfo.connect(lfoDepth).connect(rumbleGain.gain)
    rumble.connect(rumbleLp).connect(rumbleGain).connect(this.out)
    rumble.start()
    lfo.start()

    // Vento e cidade ao longe.
    const air = ctx.createBufferSource()
    air.buffer = this.noise
    air.loop = true
    const airBand = ctx.createBiquadFilter()
    airBand.type = "bandpass"
    airBand.frequency.value = 700
    airBand.Q.value = 0.4
    const airGain = ctx.createGain()
    airGain.gain.value = 0.006
    air.connect(airBand).connect(airGain).connect(this.out)
    air.start()
  }

  start() {
    this.out.gain.setTargetAtTime(LEVEL, this.ctx.currentTime, 2)
    this.loop(() => this.car(), 5000, 13000)
    this.loop(() => this.horn(), 22000, 55000)
  }

  private loop(fn: () => void, min: number, max: number) {
    const tick = () => {
      if (this.ctx.state === "running") fn()
      this.timers.push(window.setTimeout(tick, min + Math.random() * (max - min)))
    }
    this.timers.push(window.setTimeout(tick, min + Math.random() * (max - min)))
  }

  /** Um carro passando: chiado de pneu que cresce, cruza e some. */
  private car() {
    const ctx = this.ctx
    const t = ctx.currentTime
    const dur = 2.5 + Math.random() * 2.5
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    const band = ctx.createBiquadFilter()
    band.type = "bandpass"
    band.Q.value = 1.2
    band.frequency.setValueAtTime(260, t)
    band.frequency.linearRampToValueAtTime(620 + Math.random() * 300, t + dur * 0.5)
    band.frequency.linearRampToValueAtTime(240, t + dur)
    const gain = ctx.createGain()
    const peak = 0.012 + Math.random() * 0.016
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(peak, t + dur * 0.5)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    const pan = ctx.createStereoPanner()
    const dir = Math.random() < 0.5 ? -1 : 1
    pan.pan.setValueAtTime(-0.8 * dir, t)
    pan.pan.linearRampToValueAtTime(0.8 * dir, t + dur)
    src.connect(band).connect(gain).connect(pan).connect(this.out)
    src.start(t, Math.random() * 3)
    src.stop(t + dur + 0.1)
  }

  /** Buzina longe: duas notas desafinadas, abafadas pela distância. */
  private horn() {
    const ctx = this.ctx
    const t = ctx.currentTime
    const lp = ctx.createBiquadFilter()
    lp.type = "lowpass"
    lp.frequency.value = 900
    const gain = ctx.createGain()
    gain.gain.value = 0
    const pan = ctx.createStereoPanner()
    pan.pan.value = Math.random() * 1.4 - 0.7
    lp.connect(gain).connect(pan).connect(this.out)

    const honks = Math.random() < 0.4 ? 2 : 1
    for (let h = 0; h < honks; h++) {
      const s = t + h * 0.32
      const len = 0.18 + Math.random() * 0.12
      gain.gain.setValueAtTime(0, s)
      gain.gain.linearRampToValueAtTime(0.006, s + 0.02)
      gain.gain.setValueAtTime(0.006, s + len)
      gain.gain.linearRampToValueAtTime(0, s + len + 0.05)
    }
    const end = t + honks * 0.32 + 0.2
    for (const f of [392, 494]) {
      const osc = ctx.createOscillator()
      osc.type = "sawtooth"
      osc.frequency.value = f * (0.97 + Math.random() * 0.06)
      osc.connect(lp)
      osc.start(t)
      osc.stop(end)
    }
  }

  dispose() {
    for (const id of this.timers) window.clearTimeout(id)
  }
}
