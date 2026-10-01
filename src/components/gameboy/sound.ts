/*
 * Um AudioContext só pra tudo: bipes, rádio e cidade. Ele nasce depois do
 * primeiro clique ou tecla, porque o navegador bloqueia som antes disso.
 */
export class Sound {
  ctx: AudioContext | null = null
  /** Tudo passa por aqui, e é aqui que o M corta o som. */
  master: GainNode | null = null
  muted = false
  private listeners: ((ctx: AudioContext, out: AudioNode) => void)[] = []
  /** "Plim" que chegou com o som bloqueado. Toca quando o áudio liberar. */
  private pendingDing = false

  /** Roda `fn` assim que o áudio estiver liberado (ou na hora, se já estiver). */
  onReady(fn: (ctx: AudioContext, out: AudioNode) => void) {
    this.listeners.push(fn)
    this.flush()
  }

  /**
   * Cria o AudioContext sem esperar clique. Se o navegador deixar tocar logo
   * (site que a pessoa já visita bastante), ele já nasce rodando. Senão fica
   * suspenso até o primeiro clique ou tecla.
   */
  private ensure() {
    if (this.ctx) return this.ctx
    try {
      this.ctx = new AudioContext()
    } catch {
      return null
    }
    this.master = this.ctx.createGain()
    this.master.gain.value = this.muted ? 0 : 1
    this.master.connect(this.ctx.destination)
    this.ctx.addEventListener("statechange", () => this.flush())
    this.flush()
    return this.ctx
  }

  /** Música e cidade só começam com o áudio rodando de verdade. */
  private flush() {
    if (this.ctx?.state !== "running" || !this.master) return
    for (const fn of this.listeners.splice(0)) fn(this.ctx, this.master)
    if (this.pendingDing) {
      this.pendingDing = false
      this.ding()
    }
  }

  unlock() {
    const ctx = this.ensure()
    if (ctx?.state === "suspended") void ctx.resume()
  }

  /** Desiste do "plim" guardado, se a pessoa já saiu da tela de título. */
  cancelDing() {
    this.pendingDing = false
  }

  setMuted(m: boolean) {
    this.muted = m
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.05)
    }
  }

  private tone(freq: number, start: number, dur: number, vol = 0.035) {
    const ctx = this.ctx
    if (!ctx || !this.master || ctx.state !== "running") return
    const t = ctx.currentTime + start
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "square"
    osc.frequency.setValueAtTime(freq, t)
    gain.gain.setValueAtTime(vol, t)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(gain).connect(this.master)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  move() {
    this.tone(1320, 0, 0.04, 0.025)
  }

  select() {
    this.tone(988, 0, 0.05)
    this.tone(1568, 0.05, 0.08)
  }

  back() {
    this.tone(784, 0, 0.05)
    this.tone(523, 0.05, 0.08)
  }

  bump() {
    this.tone(196, 0, 0.06, 0.03)
  }

  /** O "plim" do boot: um Dó curto e o Dó da oitava de cima segurando. */
  ding() {
    const ctx = this.ensure()
    if (ctx?.state !== "running") {
      this.pendingDing = true
      return
    }
    this.tone(1047, 0, 0.09, 0.04)
    this.tone(2093, 0.09, 0.9, 0.04)
  }
}

/** Ruído branco em loop, base pra cidade e pro chiado da linha. */
export function noiseBuffer(ctx: AudioContext, seconds: number, brown = false) {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1
    if (brown) {
      last = (last + 0.02 * white) / 1.02
      d[i] = last * 3.5
    } else d[i] = white
  }
  return buf
}
