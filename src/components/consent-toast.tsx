"use client"

import { useEffect, useState } from "react"

import { denyConsent, grantConsent, readStoredConsent } from "@/lib/media-consent"
import { cn } from "@/lib/utils"

/** Let the entrance animation finish before sliding this in. */
const APPEAR_DELAY = 2200

export function ConsentToast() {
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (readStoredConsent()) return
    const id = window.setTimeout(() => setVisible(true), APPEAR_DELAY)
    return () => window.clearTimeout(id)
  }, [])

  const dismiss = (accepted: boolean) => {
    if (accepted) grantConsent()
    else denyConsent()

    setLeaving(true)
    window.setTimeout(() => setVisible(false), 300)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Preferências"
      className={cn(
        "fixed bottom-5 left-5 z-40 w-[min(22rem,calc(100vw-2.5rem))]",
        "transition-[opacity,transform] duration-300 ease-out",
        leaving ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100"
      )}
    >
      <div className="glass rounded-2xl px-4 py-3.5 text-ink">
        <p className="text-[13px] leading-relaxed">
          Guardar sua preferência neste navegador e liberar o som das músicas?
        </p>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => dismiss(true)}
            className="rounded-full bg-ink px-3.5 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-85"
          >
            Aceitar
          </button>
          <button
            type="button"
            onClick={() => dismiss(false)}
            className="rounded-full px-3.5 py-1.5 text-[12px] font-medium text-ink/60 transition-colors hover:text-ink"
          >
            Agora não
          </button>
        </div>
      </div>
    </div>
  )
}
