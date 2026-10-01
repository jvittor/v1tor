import { EXPERIENCIAS, TECNOLOGIAS } from "@/content/curriculo"
import { PROJETOS } from "@/content/projetos"
import type { GitHubProfile } from "@/lib/github"
import { LINKS } from "@/lib/site"

import type { Sound } from "./sound"

/** Resolução do Game Boy original. Tudo é desenhado nessa grade. */
export const W = 160
export const H = 144
/** Fator de ampliação da textura que vai pro modelo. */
const SCALE = 4

/** Do mais claro pro mais escuro, as quatro cores do DMG. */
const PAL: [number, number, number][] = [
  [155, 188, 15],
  [139, 172, 15],
  [48, 98, 48],
  [15, 56, 15],
]
const C = PAL.map(([r, g, b]) => `rgb(${r},${g},${b})`)
const LIGHT = C[0]
const DARK = C[3]

/** Acentos em 2 linhas de pixel, desenhados em cima da letra (ou embaixo, a cedilha). */
const ACCENTS: Record<string, string[]> = {
  "\u0301": ["....##..", "...##..."],
  "\u0300": ["..##....", "...##..."],
  "\u0302": ["...##...", "..#..#.."],
  "\u0303": ["..##..#.", ".#..##.."],
  "\u0308": ["..#..#..", "........"],
  "\u0327": ["...##...", "..##...."],
}

const CHAR = 8
const COLS = 18
const ROW = 12
const LIST_TOP = 16
const LIST_ROWS = 9
const LINE = 10
const TEXT_ROWS = 11
const FOOTER_Y = 134

export type Btn = "up" | "down" | "left" | "right" | "a" | "b" | "start" | "select"

type Item = {
  label: string
  icon?: "pasta" | "arquivo"
  open: () => Page | void
}

type ListPage = {
  kind: "list"
  title: string
  items: Item[]
  sel: number
  top: number
}

type TextPage = {
  kind: "text"
  title: string
  lines: string[]
  top: number
  /** O que o A faz nessa página. Se devolver uma página, ela substitui a atual. */
  action?: { label: string; run: () => Page | void }
}

type Page = ListPage | TextPage

function wrap(text: string, cols = COLS): string[] {
  const out: string[] = []
  for (const para of text.split("\n")) {
    if (!para.trim()) {
      out.push("")
      continue
    }
    let line = ""
    for (let word of para.split(" ")) {
      while (word.length > cols) {
        if (line) {
          out.push(line)
          line = ""
        }
        out.push(word.slice(0, cols))
        word = word.slice(cols)
      }
      if (!line) line = word
      else if (line.length + 1 + word.length <= cols) line += " " + word
      else {
        out.push(line)
        line = word
      }
    }
    if (line) out.push(line)
  }
  return out
}

function list(title: string, items: Item[]): ListPage {
  return { kind: "list", title, items, sel: 0, top: 0 }
}

function text(title: string, body: string, action?: TextPage["action"]): TextPage {
  return { kind: "text", title, lines: wrap(body), top: 0, action }
}

/** O que a tela precisa saber do rádio. */
export type RadioInfo = {
  current: { artist: string; title: string } | null
  empty: boolean
  next: () => void
}

export class Screen {
  /** Canvas em alta, já com grade de pixel e vinheta. É a textura do modelo. */
  readonly canvas: HTMLCanvasElement

  private low: HTMLCanvasElement
  private lowCtx: CanvasRenderingContext2D
  private out: HTMLCanvasElement
  private outCtx: CanvasRenderingContext2D
  private hiCtx: CanvasRenderingContext2D
  private overlay: HTMLCanvasElement
  private ghost = new Float32Array(W * H * 3)
  private ghostReady = false
  private logo: HTMLCanvasElement | null = null

  /** "off" até o Game Boy terminar de subir: a tela fica apagada. */
  private phase: "off" | "boot" | "title" | "ui" = "off"
  private phaseAt = 0
  private stack: Page[] = []
  private lastDraw = 0
  private now = 0
  /** Linha do primeiro pixel de uma maiúscula, medida depois que a fonte carrega. */
  private capTop = 0

  constructor(
    private font: string,
    private sound: Sound,
    private profile: GitHubProfile,
    private openUrl: (url: string) => void,
    private radio: () => RadioInfo | null
  ) {
    this.low = document.createElement("canvas")
    this.low.width = W
    this.low.height = H
    this.lowCtx = this.low.getContext("2d", { willReadFrequently: true })!

    this.out = document.createElement("canvas")
    this.out.width = W
    this.out.height = H
    this.outCtx = this.out.getContext("2d")!

    this.canvas = document.createElement("canvas")
    this.canvas.width = W * SCALE
    this.canvas.height = H * SCALE
    this.hiCtx = this.canvas.getContext("2d")!

    this.overlay = this.makeOverlay()
    this.stack = [this.menu()]
  }

  /** Carrega a fonte e o logo. A tela fica em branco até isso terminar. */
  async load() {
    await Promise.all([
      document.fonts.load(`${CHAR}px ${this.font}`).catch(() => undefined),
      new Promise<void>((resolve) => {
        const img = new Image()
        img.onload = () => {
          const c = document.createElement("canvas")
          c.width = img.width
          c.height = img.height
          const x = c.getContext("2d")!
          x.drawImage(img, 0, 0)
          x.globalCompositeOperation = "source-in"
          x.fillStyle = DARK
          x.fillRect(0, 0, c.width, c.height)
          this.logo = c
          resolve()
        }
        img.onerror = () => resolve()
        img.src = "/gameboy/logo.png"
      }),
    ])
    this.capTop = this.measureCapTop()
  }

  private measureCapTop() {
    const c = this.lowCtx
    c.fillStyle = "#fff"
    c.fillRect(0, 0, 16, 16)
    c.font = `${CHAR}px ${this.font}`
    c.textBaseline = "top"
    c.fillStyle = "#000"
    c.fillText("E", 0, 4)
    const d = c.getImageData(0, 0, 16, 16).data
    for (let row = 0; row < 16; row++) {
      for (let col = 0; col < 8; col++) {
        if (d[(row * 16 + col) * 4] < 128) return row - 4
      }
    }
    return 0
  }

  start(now: number) {
    this.phase = "boot"
    this.phaseAt = now
  }

  /** Aparece o APERTE START, com o "plim". */
  private enterTitle() {
    this.phase = "title"
    this.phaseAt = this.now
    this.sound.ding()
  }

  // ------------------------------------------------------------------ páginas

  private menu(): ListPage {
    return list("MENU", [
      { label: "PROJETOS", icon: "pasta", open: () => this.projetos() },
      { label: "TECNOLOGIAS", open: () => this.tecnologias() },
      { label: "EXPERIÊNCIA", open: () => this.experiencias() },
      { label: "GITHUB", open: () => this.github() },
      { label: "LINKEDIN", open: () => this.linkedin() },
      { label: "RÁDIO", open: () => this.radioPage() },
    ])
  }

  private projetos(): ListPage {
    return list(
      "~/PROJETOS",
      PROJETOS.map((p) => ({
        label: p.nome,
        icon: "arquivo" as const,
        open: () =>
          text(p.nome.toUpperCase(), `${p.sobre}\n\nFEITO COM\n${p.stack}\n\n${p.ano}`, this.link(p.repo, "A ABRE O REPO")),
      }))
    )
  }

  private tecnologias(): ListPage {
    return list(
      "TECNOLOGIAS",
      TECNOLOGIAS.map((t) => ({
        label: t.area,
        open: () => text(t.area, t.itens.map((i) => `- ${i}`).join("\n")),
      }))
    )
  }

  private experiencias(): ListPage {
    return list(
      "EXPERIÊNCIA",
      EXPERIENCIAS.map((e) => ({
        label: e.nome,
        open: () => text(e.nome, `${e.cargo}\n${e.periodo}\n\n${e.texto}`),
      }))
    )
  }

  private github(): TextPage {
    const p = this.profile
    const repos = p.publicRepos ? `${p.publicRepos} repositórios públicos.` : ""
    return text(
      "GITHUB",
      `github.com/\n${p.login}\n\n${repos}\nO código dos projetos fica lá.`,
      this.link(LINKS.github, "A ABRE O GITHUB")
    )
  }

  private linkedin(): TextPage {
    return text(
      "LINKEDIN",
      "linkedin.com/in/\njvittor\n\nHistórico completo, recomendações e contato.",
      this.link(LINKS.linkedin, "A ABRE O PERFIL")
    )
  }

  private link(url: string, label: string): TextPage["action"] {
    return { label, run: () => this.openUrl(url) }
  }

  private radioPage(): TextPage {
    const r = this.radio()
    if (!r) return text("RÁDIO", "Clique em qualquer lugar pra ligar o som.")
    if (r.empty) return text("RÁDIO", "Fora do ar. Nenhuma música na pasta.")
    const t = r.current
    const body = t ? `TOCANDO\n\n${t.artist}\n\n${t.title}` : "Sintonizando..."
    return text("RÁDIO", body, {
      label: "A PRÓXIMA",
      run: () => {
        r.next()
        return this.radioPage()
      },
    })
  }

  private get page() {
    return this.stack[this.stack.length - 1]
  }

  private push(p: Page) {
    this.stack.push(p)
    this.sound.select()
  }

  private pop() {
    if (this.stack.length > 1) {
      this.stack.pop()
      this.sound.back()
    } else {
      this.sound.bump()
    }
  }

  // ------------------------------------------------------------------ entrada

  input(btn: Btn) {
    if (this.phase === "off") return
    if (this.phase === "boot") return this.enterTitle()
    if (this.phase === "title") {
      if (btn === "a" || btn === "start") {
        this.sound.cancelDing()
        this.phase = "ui"
        this.sound.select()
      }
      return
    }

    if (btn === "select") {
      if (this.stack.length > 1) {
        this.stack = [this.stack[0]]
        this.sound.back()
      }
      return
    }

    const page = this.page
    if (page.kind === "list") {
      if (btn === "up" || btn === "down") {
        const next = page.sel + (btn === "up" ? -1 : 1)
        if (next < 0 || next >= page.items.length) return this.sound.bump()
        page.sel = next
        this.keepVisible(page)
        this.sound.move()
      } else if (btn === "a" || btn === "start" || btn === "right") {
        this.activate(page)
      } else if (btn === "b" || btn === "left") {
        this.pop()
      }
      return
    }

    const max = Math.max(0, page.lines.length - TEXT_ROWS)
    if (btn === "up" || btn === "down") {
      const next = page.top + (btn === "up" ? -1 : 1)
      if (next < 0 || next > max) return this.sound.bump()
      page.top = next
      this.sound.move()
    } else if (btn === "right") {
      if (page.top >= max) return this.sound.bump()
      page.top = Math.min(max, page.top + TEXT_ROWS - 1)
      this.sound.move()
    } else if (btn === "a" || btn === "start") {
      if (page.action) {
        this.sound.select()
        const next = page.action.run()
        if (next) this.stack[this.stack.length - 1] = next
      } else this.sound.bump()
    } else if (btn === "b" || btn === "left") {
      this.pop()
    }
  }

  /** Roda da mouse sobre a tela. */
  scroll(dir: 1 | -1) {
    if (this.phase !== "ui") return
    this.input(dir > 0 ? "down" : "up")
  }

  private activate(page: ListPage) {
    const item = page.items[page.sel]
    const next = item?.open()
    if (next) this.push(next)
  }

  private keepVisible(page: ListPage) {
    if (page.sel < page.top) page.top = page.sel
    if (page.sel >= page.top + LIST_ROWS) page.top = page.sel - LIST_ROWS + 1
  }

  /** O que fica sob o ponteiro, em coordenadas da tela (0..160, 0..144). */
  private hit(x: number, y: number): "titulo" | "rodape" | "seta-cima" | "seta-baixo" | number | null {
    if (this.phase !== "ui") return null
    const page = this.page
    if (y < 13) return this.stack.length > 1 ? "titulo" : null
    if (y >= FOOTER_Y - 3) return "rodape"
    if (page.kind === "list") {
      if (y < LIST_TOP - 2) return null
      const i = page.top + Math.floor((y - LIST_TOP + 2) / ROW)
      if (i >= page.top + LIST_ROWS || i >= page.items.length) return null
      return i
    }
    if (x > 146) {
      if (y < 70) return page.top > 0 ? "seta-cima" : null
      return page.top < page.lines.length - TEXT_ROWS ? "seta-baixo" : null
    }
    return null
  }

  /** Atualiza a seleção pelo ponteiro. Devolve true se há algo clicável ali. */
  hover(x: number, y: number) {
    if (this.phase !== "ui") return true
    const h = this.hit(x, y)
    const page = this.page
    if (typeof h === "number" && page.kind === "list" && page.sel !== h) {
      page.sel = h
      this.sound.move()
    }
    if (h === "rodape") return this.stack.length > 1 || (page.kind === "text" && !!page.action) || page.kind === "list"
    return h !== null
  }

  click(x: number, y: number) {
    if (this.phase !== "ui") return this.input("start")
    const h = this.hit(x, y)
    const page = this.page
    if (h === null) return
    if (typeof h === "number" && page.kind === "list") {
      page.sel = h
      this.activate(page)
    } else if (h === "titulo") this.pop()
    else if (h === "seta-cima") this.input("up")
    else if (h === "seta-baixo") this.input("down")
    else if (h === "rodape") {
      if (page.kind === "text" && page.action) this.input("a")
      else if (page.kind === "list") this.activate(page)
      else this.pop()
    }
  }

  // ------------------------------------------------------------------ desenho

  /** Redesenha a ~30 fps. Devolve true quando a textura mudou. */
  update(now: number) {
    this.now = now
    if (now - this.lastDraw < 33) return false
    this.lastDraw = now
    this.draw(now)
    return true
  }

  private draw(now: number) {
    const x = this.lowCtx
    x.globalCompositeOperation = "source-over"
    x.fillStyle = LIGHT
    x.fillRect(0, 0, W, H)
    x.font = `${CHAR}px ${this.font}`
    x.textBaseline = "top"

    const t = (now - this.phaseAt) / 1000
    if (this.phase === "off") x.fillStyle = C[1]
    if (this.phase === "off") x.fillRect(0, 0, W, H)
    else if (this.phase === "boot") this.drawBoot(t)
    else if (this.phase === "title") this.drawTitle(t)
    else this.drawPage()

    this.present()
  }

  /**
   * A Press Start 2P não tem as maiúsculas acentuadas do português. A letra
   * sai sem acento e o acento é pintado em cima, pixel a pixel.
   */
  private txt(s: string, x: number, y: number, color = DARK) {
    const c = this.lowCtx
    c.fillStyle = color
    let base = s
    const marks: [number, string][] = []
    for (let i = 0; i < s.length; i++) {
      const ch = s[i]
      if (ch >= "À" && ch <= "Ý" && ch === ch.toUpperCase() && ch !== ch.toLowerCase()) {
        const nfd = ch.normalize("NFD")
        if (nfd.length > 1) {
          marks.push([i, nfd[1]])
          base = base.slice(0, i) + nfd[0] + base.slice(i + 1)
        }
      }
    }
    c.fillText(base, x, y)
    const top = y + this.capTop
    for (const [i, mark] of marks) {
      const shape = ACCENTS[mark]
      if (!shape) continue
      const cx = x + i * CHAR
      shape.forEach((row, r) => {
        for (let k = 0; k < row.length; k++) {
          if (row[k] === "#") c.fillRect(cx + k, mark === "\u0327" ? top + 7 + r : top - 2 + r, 1, 1)
        }
      })
    }
  }

  private center(s: string, y: number, color = DARK) {
    this.txt(s, Math.round((W - s.length * CHAR) / 2), y, color)
  }

  private drawLogo(y: number) {
    if (!this.logo) return
    const lx = Math.round((W - this.logo.width) / 2)
    this.lowCtx.drawImage(this.logo, lx, Math.round(y))
  }

  private drawBoot(t: number) {
    // O logo desce do topo e para no meio, como o "Nintendo" fazia.
    const lh = this.logo?.height ?? 60
    const rest = Math.round((H - lh) / 2) - 6
    const p = Math.min(t / 2.2, 1)
    this.drawLogo(-lh + (rest + lh) * p)
    if (p >= 1) this.center("jvsj", rest + lh + 6, C[2])
    if (t > 3.6) this.enterTitle()
  }

  private drawTitle(t: number) {
    this.drawLogo(8)
    this.center("JOÃO VÍTOR", 78)
    this.center("FULL STACK", 90, C[2])
    if (Math.floor(t * 1.8) % 2 === 0) this.center("APERTE START", 118)
  }

  private bar(title: string) {
    const x = this.lowCtx
    x.fillStyle = DARK
    x.fillRect(0, 0, W, 12)
    if (this.stack.length > 1) {
      this.arrow(4, 3, "left", LIGHT)
      this.txt(title.slice(0, COLS - 1), 12, 2, LIGHT)
    } else this.txt(title, 4, 2, LIGHT)
  }

  private footer(label: string) {
    const x = this.lowCtx
    x.fillStyle = C[2]
    x.fillRect(0, FOOTER_Y - 3, W, 1)
    this.txt(label, 4, FOOTER_Y, C[2])
  }

  private drawPage() {
    const page = this.page
    this.bar(page.title)
    const x = this.lowCtx

    if (page.kind === "list") {
      const end = Math.min(page.items.length, page.top + LIST_ROWS)
      for (let i = page.top; i < end; i++) {
        const y = LIST_TOP + (i - page.top) * ROW
        const item = page.items[i]
        const on = i === page.sel
        if (on) {
          x.fillStyle = C[1]
          x.fillRect(2, y - 2, W - 4, ROW)
          // O cursor pisca devagar, como nos menus da época.
          if (Math.floor(this.now / 400) % 3 !== 2) this.arrow(4, y, "right", DARK)
        }
        let lx = 14
        if (item.icon === "arquivo") {
          this.fileIcon(14, y)
          lx = 26
        }
        this.txt(item.label, lx, y, on ? DARK : C[2])
        if (item.icon === "pasta") this.folderIcon(W - 16, y)
      }
      if (page.top > 0) this.arrow(W - 8, LIST_TOP - 3, "up", C[2])
      if (end < page.items.length) this.arrow(W - 8, FOOTER_Y - 9, "down", C[2])
      this.footer(this.stack.length > 1 ? "A ABRE   B VOLTA" : "A ABRE")
      return
    }

    const end = Math.min(page.lines.length, page.top + TEXT_ROWS)
    for (let i = page.top; i < end; i++) {
      this.txt(page.lines[i], 4, LIST_TOP + (i - page.top) * LINE)
    }
    if (page.top > 0) this.arrow(W - 9, LIST_TOP, "up", C[2])
    if (end < page.lines.length) {
      // Pisca pra avisar que tem mais texto embaixo.
      if (Math.floor(this.now / 350) % 2 === 0) this.arrow(W - 9, FOOTER_Y - 12, "down", DARK)
    }
    this.footer(page.action ? page.action.label : "B VOLTA")
  }

  private arrow(x: number, y: number, dir: "left" | "right" | "up" | "down", color: string) {
    const c = this.lowCtx
    c.fillStyle = color
    for (let i = 0; i < 4; i++) {
      const len = 7 - i * 2
      if (dir === "right") c.fillRect(x + i, y + i, 1, len)
      else if (dir === "left") c.fillRect(x + 3 - i, y + i, 1, len)
      else if (dir === "down") c.fillRect(x + i, y + i, len, 1)
      else c.fillRect(x + i, y + 3 - i, len, 1)
    }
  }

  private folderIcon(x: number, y: number) {
    const c = this.lowCtx
    c.fillStyle = DARK
    c.fillRect(x, y, 4, 2)
    c.fillRect(x, y + 1, 10, 7)
    c.fillStyle = C[1]
    c.fillRect(x + 1, y + 3, 8, 4)
  }

  private fileIcon(x: number, y: number) {
    const c = this.lowCtx
    c.fillStyle = DARK
    c.fillRect(x, y, 5, 1)
    c.fillRect(x, y, 1, 8)
    c.fillRect(x, y + 7, 7, 1)
    c.fillRect(x + 6, y + 2, 1, 6)
    c.fillRect(x + 4, y, 1, 3)
    c.fillRect(x + 4, y + 2, 3, 1)
    c.fillRect(x + 2, y + 4, 3, 1)
  }

  /**
   * Passa o quadro pelo "LCD": cada pixel cai na cor mais próxima das quatro
   * do DMG, e a cor anterior demora um pouco pra sumir, o rastro que o
   * Game Boy deixava quando algo se mexia.
   */
  private present() {
    const img = this.lowCtx.getImageData(0, 0, W, H)
    const d = img.data
    const g = this.ghost
    const lum = PAL.map(([r, gg, b]) => r * 0.3 + gg * 0.59 + b * 0.11)
    for (let i = 0, j = 0; i < d.length; i += 4, j += 3) {
      const l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11
      let best = 0
      let bd = Infinity
      for (let k = 0; k < 4; k++) {
        const dist = Math.abs(l - lum[k])
        if (dist < bd) {
          bd = dist
          best = k
        }
      }
      const [r, gg, b] = PAL[best]
      if (this.ghostReady) {
        g[j] += (r - g[j]) * 0.55
        g[j + 1] += (gg - g[j + 1]) * 0.55
        g[j + 2] += (b - g[j + 2]) * 0.55
      } else {
        g[j] = r
        g[j + 1] = gg
        g[j + 2] = b
      }
      d[i] = g[j]
      d[i + 1] = g[j + 1]
      d[i + 2] = g[j + 2]
      d[i + 3] = 255
    }
    this.ghostReady = true
    this.outCtx.putImageData(img, 0, 0)

    const h = this.hiCtx
    h.imageSmoothingEnabled = false
    h.drawImage(this.out, 0, 0, W * SCALE, H * SCALE)
    h.drawImage(this.overlay, 0, 0)
  }

  /** Grade entre os pixels e a borda mais escura do LCD, feitas uma vez só. */
  private makeOverlay() {
    const c = document.createElement("canvas")
    c.width = W * SCALE
    c.height = H * SCALE
    const x = c.getContext("2d")!
    x.fillStyle = "rgba(15,56,15,0.16)"
    for (let i = 0; i < W; i++) x.fillRect(i * SCALE, 0, 1, c.height)
    for (let j = 0; j < H; j++) x.fillRect(0, j * SCALE, c.width, 1)
    const v = x.createRadialGradient(c.width / 2, c.height / 2, c.height * 0.35, c.width / 2, c.height / 2, c.width * 0.75)
    v.addColorStop(0, "rgba(15,56,15,0)")
    v.addColorStop(1, "rgba(15,56,15,0.35)")
    x.fillStyle = v
    x.fillRect(0, 0, c.width, c.height)
    return c
  }
}
