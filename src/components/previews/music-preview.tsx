"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { grantConsent, isMediaAllowed } from "@/lib/media-consent"

type Track = { file: string; src: string; artist: string; title: string }
type LyricLine = { time: number; text: string }

/** Background music shouldn't arrive at full blast. */
const VOLUME = 0.35

export function MusicPreview({ open }: { open: boolean }) {
  const [tracks, setTracks] = useState<Track[] | null>(null)
  const [track, setTrack] = useState<Track | null>(null)
  const [lines, setLines] = useState<LyricLine[] | null>(null)
  const [lyricsState, setLyricsState] = useState<"idle" | "loading" | "none">(
    "idle"
  )
  const [muted, setMuted] = useState(true)
  const [active, setActive] = useState(-1)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const lyricsRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<{
    ctx: AudioContext
    analyser: AnalyserNode
  } | null>(null)

  // Pick a fresh track every time the window opens.
  useEffect(() => {
    if (!open) return
    let cancelled = false

    void (async () => {
      let list = tracks
      if (!list) {
        try {
          const res = await fetch("/api/music")
          list = ((await res.json()) as { tracks: Track[] }).tracks
        } catch {
          list = []
        }
        if (cancelled) return
        setTracks(list)
      }

      if (!list.length || cancelled) return
      setTrack(list[Math.floor(Math.random() * list.length)])
    })()

    return () => {
      cancelled = true
    }
    // `tracks` is intentionally not a dependency: re-picking on every state
    // change would swap the video mid-play.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Rewind when the window closes.
  useEffect(() => {
    if (open) return
    const video = videoRef.current
    if (!video) return
    video.pause()
    video.currentTime = 0
  }, [open])

  // Fetch synced lyrics for the chosen track.
  useEffect(() => {
    if (!track) return
    let cancelled = false

    void (async () => {
      setLines(null)
      setActive(-1)
      setLyricsState("loading")

      try {
        const res = await fetch(
          `/api/music/lyrics?file=${encodeURIComponent(track.file)}`
        )
        const data = (await res.json()) as { lines: LyricLine[] }
        if (cancelled) return

        if (data.lines?.length) {
          setLines(data.lines)
          setLyricsState("idle")
        } else {
          setLyricsState("none")
        }
      } catch {
        if (!cancelled) setLyricsState("none")
      }
    })()

    return () => {
      cancelled = true
    }
  }, [track])

  /** Routes the element through an analyser so the wave is the real signal. */
  const ensureAudioGraph = useCallback(() => {
    const video = videoRef.current
    if (!video || audioRef.current) return audioRef.current

    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      const ctx = new Ctx()
      const source = ctx.createMediaElementSource(video)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 1024
      source.connect(analyser)
      analyser.connect(ctx.destination)
      audioRef.current = { ctx, analyser }
    } catch {
      audioRef.current = null
    }

    return audioRef.current
  }, [])

  // Start playback whenever a track is mounted into an open window.
  useEffect(() => {
    if (!open || !track) return
    const video = videoRef.current
    if (!video) return

    const wantsSound = isMediaAllowed()
    video.volume = VOLUME
    video.muted = !wantsSound
    setMuted(!wantsSound)

    // Build the analyser only once sound is actually allowed. Routing the
    // element through a suspended AudioContext would silence it outright.
    if (wantsSound) {
      const graph = ensureAudioGraph()
      void graph?.ctx.resume().catch(() => {})
    }

    video.play().catch(() => {
      // Unmuted playback refused — fall back to a silent preview.
      video.muted = true
      setMuted(true)
      void video.play().catch(() => {})
    })
  }, [open, track, ensureAudioGraph])

  const unmute = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    grantConsent()
    const graph = ensureAudioGraph()
    void graph?.ctx.resume().catch(() => {})
    video.volume = VOLUME
    video.muted = false
    setMuted(false)
    void video.play().catch(() => {})
  }, [ensureAudioGraph])

  // Waveform + lyric tracking share one loop.
  useEffect(() => {
    if (!open || !track) return

    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const ctx2d = canvas.getContext("2d")
    if (!ctx2d) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let width = 0
    let height = 0
    let raf = 0
    // Owned by the loop rather than mirrored from state, so the draw call
    // never has to read React state back.
    let activeIndex = -1

    const resize = () => {
      const r = canvas.getBoundingClientRect()
      width = r.width
      height = r.height
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    let buffer: Uint8Array | null = null
    const STEPS = 96

    const draw = (now: number) => {
      const graph = audioRef.current
      ctx2d.clearRect(0, 0, width, height)
      ctx2d.beginPath()

      const mid = height / 2
      let drewSignal = false

      if (graph && !video.muted) {
        if (!buffer || buffer.length !== graph.analyser.fftSize) {
          buffer = new Uint8Array(graph.analyser.fftSize)
        }
        graph.analyser.getByteTimeDomainData(buffer)

        // A suspended context or a silent passage reads as a dead flat 128;
        // only draw the real trace when there is actually something in it.
        let peak = 0
        for (let i = 0; i < buffer.length; i += 4) {
          const d = Math.abs(buffer[i] - 128)
          if (d > peak) peak = d
        }

        if (peak > 1) {
          // Normalise so quiet passages still read, without clipping loud ones.
          const gain = Math.min(3, 42 / peak)

          for (let i = 0; i <= STEPS; i++) {
            const sample = buffer[Math.floor((i / STEPS) * (buffer.length - 1))]
            const amplitude = ((sample - 128) / 128) * gain
            const y = mid + Math.max(-1, Math.min(1, amplitude)) * (mid * 0.9)
            const x = (i / STEPS) * width
            if (i === 0) ctx2d.moveTo(x, y)
            else ctx2d.lineTo(x, y)
          }
          drewSignal = true
        }
      }

      if (!drewSignal) {
        // Silent: a slow idle ripple, so the strip never looks dead.
        for (let i = 0; i <= STEPS; i++) {
          const p = i / STEPS
          const y =
            mid +
            Math.sin(p * Math.PI * 6 + now / 420) *
              Math.sin(p * Math.PI) *
              (mid * 0.3)
          const x = p * width
          if (i === 0) ctx2d.moveTo(x, y)
          else ctx2d.lineTo(x, y)
        }
      }

      ctx2d.strokeStyle = "rgba(11, 11, 12, 0.75)"
      ctx2d.lineWidth = 1.5
      ctx2d.lineJoin = "round"
      ctx2d.stroke()

      // Advance the highlighted lyric.
      if (lines?.length) {
        const t = video.currentTime
        let i = activeIndex
        // Usually moves forward by one; reset if playback looped or scrubbed.
        if (i >= 0 && lines[i] && lines[i].time > t) i = -1
        while (i + 1 < lines.length && lines[i + 1].time <= t) i++
        if (i !== activeIndex) {
          activeIndex = i
          setActive(i)
        }
      }

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)

    return () => {
      observer.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [open, track, lines])

  // Keep the highlighted line in view.
  useEffect(() => {
    const box = lyricsRef.current
    if (!box || active < 0) return
    const el = box.children[active] as HTMLElement | undefined
    if (!el) return

    const top = Math.max(
      0,
      Math.min(
        el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2,
        box.scrollHeight - box.clientHeight
      )
    )

    // Ignore sub-line jitter so it glides between lines instead of twitching.
    if (Math.abs(top - box.scrollTop) < 2) return
    box.scrollTo({ top, behavior: "smooth" })
  }, [active])

  if (tracks && !tracks.length) {
    return (
      <div className="p-4 text-[13px] leading-relaxed text-ink/70">
        Nada em <span className="font-mono">public/music</span> ainda — é só
        soltar um vídeo lá que ele aparece aqui.
      </div>
    )
  }

  return (
    <div>
      <div className="relative aspect-video bg-black">
        {track && (
          <video
            ref={videoRef}
            key={track.file}
            src={track.src}
            className="size-full object-cover"
            playsInline
            loop
            preload="metadata"
          />
        )}

        {muted && (
          <button
            type="button"
            onClick={unmute}
            className="absolute right-2 bottom-2 rounded-full bg-black/65 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/80"
          >
            Ligar som
          </button>
        )}
      </div>

      <div className="px-3.5 pt-3 pb-3.5">
        <p className="truncate text-[13px] leading-tight font-semibold text-ink">
          {track?.title ?? "…"}
        </p>
        {track?.artist && (
          <p className="mt-0.5 truncate text-[11px] text-ink/55">
            {track.artist}
          </p>
        )}

        <canvas ref={canvasRef} className="mt-2.5 h-9 w-full" aria-hidden />

        {/* `relative` matters: it makes this the offsetParent of the lines, so
            the auto-scroll below measures against the box and not the whole
            window. */}
        <div
          ref={lyricsRef}
          className="relative mt-1 h-24 overflow-y-auto text-[12px] leading-relaxed"
        >
          {lines?.length ? (
            lines.map((line, i) => (
              <p
                key={`${line.time}-${i}`}
                className={
                  i === active
                    ? "font-semibold text-ink transition-colors"
                    : "text-ink/35 transition-colors"
                }
              >
                {line.text}
              </p>
            ))
          ) : (
            <p className="text-ink/40">
              {lyricsState === "loading"
                ? "Procurando a letra…"
                : "Sem letra sincronizada para esta faixa."}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
