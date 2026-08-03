"use client"

import { useEffect, useRef } from "react"

import { cn } from "@/lib/utils"

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  radius: number
  seed: number
}

/**
 * The canvas is drawn at 3x the wrapper box so dust can drift well past the
 * element it was kicked off. The element therefore sits in the middle third.
 */
const CANVAS_SCALE = 3
/** Where the element sits inside the canvas, as a fraction of canvas size. */
const ELEMENT_INSET = (1 - 1 / CANVAS_SCALE) / 2 // 0.333…
/**
 * CSS percentages resolve against the wrapper, not the canvas, so the offset
 * that centres the element is (SCALE - 1) / 2 of the *wrapper* size.
 */
const CANVAS_OFFSET = ((CANVAS_SCALE - 1) / 2) * 100 // 100%

/** Sooty grey — the page sits on a pale backdrop. */
const DUST_RGB = "78, 76, 72"

/** Time constant for the angular velocity to reach hover speed. */
const SPIN_UP_MS = 220
/** Shortest sweep worth easing through when landing, in degrees. */
const MIN_LANDING_SWEEP = 150

/** One lub-dub cycle. */
const BEAT_MS = 900
/** How quickly the beat fades in on hover and back out on leave. */
const BEAT_RAMP_MS = 200

/**
 * Scale for one heartbeat cycle: a strong first contraction, a beat of rest,
 * a weaker second one, then a long diastole.
 */
function heartbeatScale(phase: number) {
  if (phase < 0.1) return 1 + 0.24 * Math.sin((phase / 0.1) * Math.PI)
  if (phase < 0.17) return 1
  if (phase < 0.3) return 1 + 0.15 * Math.sin(((phase - 0.17) / 0.13) * Math.PI)
  return 1
}

type SpinDustProps = {
  children: React.ReactNode
  /** Hover/focus state, controlled by the parent so a whole link can drive it. */
  active: boolean
  /** "spin" rotates continuously; "beat" pulses like a heart. */
  mode?: "spin" | "beat"
  /** Sustained rotation speed in degrees per second. Ignored when beating. */
  speed?: number
  className?: string
}

export function SpinDust({
  children,
  active,
  mode = "spin",
  speed = 400,
  className,
}: SpinDustProps) {
  const spinRef = useRef<HTMLSpanElement>(null)
  const activeRef = useRef(active)
  const startRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    let angle = 0
    let velocity = 0
    /** Set once hover ends: the planned glide back to upright. */
    let landing: { from: number; to: number; start: number; ms: number } | null =
      null
    let beatPhase = 0
    let beatAmp = 0
    let raf = 0
    let last = 0

    const beatFrame = (now: number) => {
      const dt = Math.min(now - last, 48)
      last = now

      // Amplitude eases in and out, so the pulse swells and subsides rather
      // than starting and stopping mid-contraction.
      const target = activeRef.current ? 1 : 0
      beatAmp += (target - beatAmp) * (1 - Math.exp(-dt / BEAT_RAMP_MS))
      beatPhase = (beatPhase + dt / BEAT_MS) % 1

      const scale = 1 + (heartbeatScale(beatPhase) - 1) * beatAmp

      if (spinRef.current) {
        spinRef.current.style.transform = `scale(${scale})`
      }

      if (activeRef.current || beatAmp > 0.01) {
        raf = requestAnimationFrame(beatFrame)
      } else {
        beatAmp = 0
        if (spinRef.current) spinRef.current.style.transform = "scale(1)"
        raf = 0
      }
    }

    const frame = (now: number) => {
      if (mode === "beat") return beatFrame(now)

      const dt = Math.min(now - last, 48)
      last = now

      if (activeRef.current) {
        landing = null
        // Exponential approach so it eases up to speed rather than snapping.
        velocity += (speed - velocity) * (1 - Math.exp(-dt / SPIN_UP_MS))
        angle += (velocity * dt) / 1000
      } else {
        if (!landing) {
          // Carry on to the next whole turn so it always finishes upright,
          // giving it a long enough runway to decelerate gracefully.
          const from = angle
          let to = Math.ceil(from / 360) * 360
          if (to - from < MIN_LANDING_SWEEP) to += 360
          const sweep = to - from
          landing = {
            from,
            to,
            start: now,
            ms: Math.min(1500, Math.max(420, (sweep / Math.max(velocity, 90)) * 1700)),
          }
        }

        const t = Math.min(1, (now - landing.start) / landing.ms)
        const sweep = landing.to - landing.from
        // easeOutCubic
        angle = landing.from + sweep * (1 - Math.pow(1 - t, 3))
        // Keep velocity meaningful in case hover resumes mid-landing.
        velocity = (sweep * 3 * Math.pow(1 - t, 2)) / (landing.ms / 1000)

        if (t >= 1) {
          angle = 0
          velocity = 0
          landing = null
        }
      }

      if (spinRef.current) {
        spinRef.current.style.transform = `rotate(${angle}deg)`
      }

      if (activeRef.current || landing) {
        raf = requestAnimationFrame(frame)
      } else {
        raf = 0
      }
    }

    const start = () => {
      if (raf) return
      last = performance.now()
      raf = requestAnimationFrame(frame)
    }

    startRef.current = start
    if (activeRef.current) start()

    return () => {
      startRef.current = null
      if (raf) cancelAnimationFrame(raf)
    }
  }, [speed, mode])

  useEffect(() => {
    activeRef.current = active
    if (active) startRef.current?.()
  }, [active])

  return (
    <span className={cn("relative inline-flex", className)}>
      <Dust active={active} />

      <span ref={spinRef} className="relative inline-flex will-change-transform">
        {children}
      </span>
    </span>
  )
}

function Dust({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const activeRef = useRef(active)
  const startRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const particles: Particle[] = []
    let width = 0
    let height = 0
    let raf = 0

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    // All motion scales off the element's measured width, so a 34px icon and a
    // 130px sigil kick up dust that reads the same — and it stays correct when
    // the layout rescales with the viewport.
    const unit = () => width / CANVAS_SCALE / 100

    const spawn = () => {
      const u = unit()
      const el = width / CANVAS_SCALE
      const boxX = width * ELEMENT_INSET
      const boxY = height * ELEMENT_INSET
      const boxH = height / CANVAS_SCALE

      // Kicked off the bottom edge of the element, spread across its width.
      particles.push({
        x: boxX + el * (0.5 + (Math.random() - 0.5) * 0.85),
        // Spawned just under the mark and thrown clear of it, so the plume
        // never smothers the thing it is coming off.
        y: boxY + boxH * (0.9 + Math.random() * 0.16),
        vx: (Math.random() - 0.5) * 46 * u,
        vy: -(20 + Math.random() * 44) * u,
        age: 0,
        life: 1000 + Math.random() * 1300,
        // Sized off the element itself, so a 34px icon gets grains that are
        // still a couple of pixels across instead of sub-pixel specks.
        radius: el * (0.014 + Math.random() * 0.038),
        seed: Math.random() * Math.PI * 2,
      })
    }

    let last = 0
    let emitCarry = 0

    const frame = (now: number) => {
      const dt = Math.min(now - last, 48)
      last = now
      const u = unit()

      if (activeRef.current && particles.length < 420) {
        // Emission rate scales with the element's footprint.
        emitCarry += (dt / 1000) * (65 + 105 * u)
        while (emitCarry >= 1) {
          spawn()
          emitCarry -= 1
        }
      } else {
        emitCarry = 0
      }

      ctx.clearRect(0, 0, width, height)

      const seconds = dt / 1000

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.age += dt

        if (p.age >= p.life) {
          particles.splice(i, 1)
          continue
        }

        // Rising dust: light gravity lets the plume hang and settle slowly
        // instead of dropping, and a sine drift breaks up the straight jet.
        p.vy += 14 * u * seconds
        p.vx += Math.sin(now / 420 + p.seed) * 9 * u * seconds
        p.vx *= 0.985
        p.vy *= 0.985
        p.x += p.vx * seconds
        p.y += p.vy * seconds

        const t = p.age / p.life
        // Fade in over the first 15% of life, then back out.
        const alpha = (t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85) * 0.4
        if (alpha <= 0) continue

        const r = p.radius * (1 + t * 1.6)
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r)
        gradient.addColorStop(0, `rgba(${DUST_RGB}, ${alpha})`)
        gradient.addColorStop(1, `rgba(${DUST_RGB}, 0)`)

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
        ctx.fill()
      }

      // Keep running after hover ends so the last plume settles instead of
      // being cut off mid-air.
      if (activeRef.current || particles.length > 0) {
        raf = requestAnimationFrame(frame)
      } else {
        ctx.clearRect(0, 0, width, height)
        raf = 0
      }
    }

    const start = () => {
      if (raf) return
      last = performance.now()
      raf = requestAnimationFrame(frame)
    }

    startRef.current = start
    if (activeRef.current) start()

    return () => {
      startRef.current = null
      observer.disconnect()
      if (raf) cancelAnimationFrame(raf)
      particles.length = 0
    }
  }, [])

  // Restart the loop on hover; it winds itself down once the dust has settled.
  useEffect(() => {
    activeRef.current = active
    if (active) startRef.current?.()
  }, [active])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute"
      style={{
        left: `${-CANVAS_OFFSET}%`,
        top: `${-CANVAS_OFFSET}%`,
        width: `${CANVAS_SCALE * 100}%`,
        height: `${CANVAS_SCALE * 100}%`,
      }}
    />
  )
}
