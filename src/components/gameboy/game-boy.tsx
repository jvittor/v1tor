"use client"

import { useEffect, useRef, useState } from "react"

import type { GitHubProfile } from "@/lib/github"
import { cn } from "@/lib/utils"

import type { Track } from "./radio"
import type { Btn } from "./screen"

const KEYS: Record<string, Btn> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  z: "a",
  k: "a",
  " ": "a",
  x: "b",
  j: "b",
  Backspace: "b",
  Enter: "start",
  Shift: "select",
}

export function GameBoy({ profile, font }: { profile: GitHubProfile; font: string }) {
  const host = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [zoomed, setZoomed] = useState(false)
  const [muted, setMuted] = useState(false)
  const [touch, setTouch] = useState(false)

  useEffect(() => {
    const el = host.current
    if (!el) return
    let alive = true
    let cleanup = () => {}

    void (async () => {
      // A lista de músicas vem em paralelo. A cena não espera por ela.
      const tracks = fetch("/api/music")
        .then((r) => r.json() as Promise<{ tracks: Track[] }>)
        .then((d) => d.tracks)
        .catch(() => [] as Track[])
      const [{ mountScene }, { Screen }, { Sound }, { Radio }, { City }] = await Promise.all([
        import("./scene"),
        import("./screen"),
        import("./sound"),
        import("./radio"),
        import("./city"),
      ])
      if (!alive) return
      setTouch(window.matchMedia("(pointer: coarse)").matches)

      const sound = new Sound()
      let radio: InstanceType<typeof Radio> | null = null
      let city: InstanceType<typeof City> | null = null
      let near = false
      // Música e cidade só começam depois do primeiro clique ou tecla.
      sound.onReady((ctx, out) => {
        city = new City(ctx, out)
        city.start()
        void tracks.then((list) => {
          if (!alive) return
          radio = new Radio(ctx, out, list)
          radio.start()
          radio.setNear(near)
        })
      })

      const screen = new Screen(
        font,
        sound,
        profile,
        (url) => {
          window.open(url, "_blank", "noopener,noreferrer")
        },
        () => radio
      )
      // A cena entra na hora: enquanto o modelo carrega, só as nuvens aparecem.
      const loaded = screen.load()
      const scene = mountScene(el, screen, {
        onReady: () => setReady(true),
        // A tela só liga depois que ele sai das nuvens e termina o giro.
        onLanded: () => void loaded.then(() => screen.start(performance.now())),
        onZoom: (z) => {
          near = z
          radio?.setNear(z)
          setZoomed(z)
        },
        onPress: (b) => screen.input(b),
      })

      const unlock = () => sound.unlock()
      const onKey = (e: KeyboardEvent) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return
        if (e.key === "Escape") {
          scene.setZoom(false)
          return
        }
        if (e.key === "m" || e.key === "M") {
          sound.setMuted(!sound.muted)
          setMuted(sound.muted)
          return
        }
        const btn = KEYS[e.key] ?? KEYS[e.key.toLowerCase()]
        if (!btn) return
        e.preventDefault()
        if (e.repeat && (btn === "a" || btn === "b" || btn === "start" || btn === "select")) return
        scene.press(btn)
      }

      window.addEventListener("pointerdown", unlock, true)
      window.addEventListener("keydown", unlock, true)
      window.addEventListener("keydown", onKey)
      cleanup = () => {
        window.removeEventListener("pointerdown", unlock, true)
        window.removeEventListener("keydown", unlock, true)
        window.removeEventListener("keydown", onKey)
        scene.dispose()
        radio?.stop()
        city?.dispose()
        void sound.ctx?.close()
      }
    })()

    return () => {
      alive = false
      cleanup()
    }
  }, [font, profile])

  return (
    <>
      <div ref={host} className="absolute inset-0" />

      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 px-4 pb-[max(18px,env(safe-area-inset-bottom))] text-center text-[8px] leading-[1.6] text-[#2a3150]/60 transition-opacity duration-500 sm:text-[9px]",
          touch && zoomed && "opacity-0"
        )}
      >
        <p className={cn("transition-opacity duration-500", ready ? "opacity-100" : "opacity-0")}>
          {touch
            ? zoomed
              ? "toque na tela ou nos botões. Toque fora pra afastar"
              : "toque no game boy pra chegar perto"
            : zoomed
              ? "setas mexem, Z confirma, X volta. Esc ou clique fora pra afastar"
              : "clique no game boy pra chegar perto"}
        </p>
      </div>
    </>
  )
}
