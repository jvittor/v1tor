"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { SpinDust } from "@/components/spin-dust"
import { cn } from "@/lib/utils"

const OPEN_DELAY = 90
const CLOSE_DELAY = 160
const DEFAULT_WIDTH = 320
const MIN_WIDTH = 236
const EDGE_MARGIN = 16
const GAP = 12

type Placement = { side: "left" | "right"; width: number }

type SocialLinkProps = {
  href: string
  label: string
  icon: React.ReactNode
  /** "spin" rotates the icon on hover; "beat" pulses it. */
  mode?: "spin" | "beat"
  /** Preferred window width; some previews need more room than a data card. */
  idealWidth?: number
  /** Rendered inside the floating window. Receives whether it is visible. */
  preview: (open: boolean) => React.ReactNode
}

export function SocialLink({
  href,
  label,
  icon,
  mode = "spin",
  idealWidth = DEFAULT_WIDTH,
  preview,
}: SocialLinkProps) {
  const [hovered, setHovered] = useState(false)
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [placement, setPlacement] = useState<Placement>({
    side: "left",
    width: idealWidth,
  })
  const rootRef = useRef<HTMLDivElement>(null)
  const timer = useRef<number>(0)

  /**
   * The window opens beside the whole card, not the individual icon, so it
   * needs the card's box. Prefers the left — that is the open side of the
   * composition — and falls back to the right when there isn't room.
   */
  const measure = useCallback(() => {
    const card = rootRef.current?.closest(".stage-card")
    if (!card) return

    const r = card.getBoundingClientRect()
    const spaceLeft = r.left - GAP - EDGE_MARGIN
    const spaceRight = window.innerWidth - r.right - GAP - EDGE_MARGIN

    const side =
      spaceLeft >= Math.min(idealWidth, spaceRight) ? "left" : "right"
    const room = side === "left" ? spaceLeft : spaceRight

    setPlacement({
      side,
      width: Math.max(MIN_WIDTH, Math.min(idealWidth, room)),
    })
  }, [idealWidth])

  const schedule = useCallback((next: boolean) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(
      () => {
        setOpen(next)
        if (next) setMounted(true)
      },
      next ? OPEN_DELAY : CLOSE_DELAY
    )
  }, [])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  useEffect(() => {
    if (!open) return
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [open, measure])

  const enter = () => {
    measure()
    setHovered(true)
    schedule(true)
  }

  const leave = () => {
    setHovered(false)
    schedule(false)
  }

  return (
    // Deliberately not `relative`: the window anchors to .stage-card instead.
    <div
      ref={rootRef}
      className="flex"
      onPointerEnter={(e) => {
        // Touch taps should follow the link, not pin a window open.
        if (e.pointerType !== "touch") enter()
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== "touch") leave()
      }}
    >
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        aria-label={label}
        onFocus={enter}
        onBlur={leave}
        className={cn(
          // Colour is inherited from .stage-links so it can flip on portrait.
          "relative block rounded-full text-current outline-none",
          "transition-opacity duration-500 hover:opacity-70",
          "focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2"
        )}
        style={{ width: "var(--icon-size)", height: "var(--icon-size)" }}
      >
        <SpinDust
          active={hovered || open}
          mode={mode}
          speed={480}
          className="size-full"
        >
          <span className="block size-full">{icon}</span>
        </SpinDust>
      </a>

      {mounted && (
        <div
          className={cn(
            "absolute top-1/2 z-20 -translate-y-1/2",
            placement.side === "left" ? "right-full pr-3" : "left-full pl-3",
            open ? "" : "pointer-events-none"
          )}
        >
          <div
            className="mac-window overflow-hidden rounded-xl"
            style={{
              width: placement.width,
              // Scales out of the card the way a macOS window opens, on the
              // system's own easing curve.
              transformOrigin:
                placement.side === "left" ? "right center" : "left center",
              transform: open ? "scale(1)" : "scale(0.86)",
              opacity: open ? 1 : 0,
              transition: open
                ? "transform 360ms cubic-bezier(0.32, 0.72, 0, 1), opacity 240ms ease-out"
                : "transform 180ms cubic-bezier(0.4, 0, 1, 1), opacity 150ms ease-in",
            }}
          >
            <div className="mac-titlebar flex h-8 items-center px-3">
              <div className="flex items-center gap-[6px]">
                <TrafficLight color="#FF5F57" />
                <TrafficLight color="#FEBC2E" />
                <TrafficLight color="#28C840" />
              </div>
              <span className="flex-1 pr-12 text-center text-[11px] font-medium text-ink/55">
                {label}
              </span>
            </div>

            {preview(open)}
          </div>
        </div>
      )}
    </div>
  )
}

function TrafficLight({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="size-[11px] rounded-full"
      style={{
        backgroundColor: color,
        boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.14)",
      }}
    />
  )
}
