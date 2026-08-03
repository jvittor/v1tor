const KEY = "v1tor.consent"

export type Consent = "granted" | "denied"

/**
 * Browsers refuse audible playback until the visitor has interacted with the
 * page, so accepting the toast doubles as that interaction. Any other click
 * counts too — the flag just tracks whether sound is allowed to start.
 */
let allowed = false
const listeners = new Set<() => void>()

function notify() {
  for (const fn of listeners) fn()
}

export function readStoredConsent(): Consent | null {
  if (typeof window === "undefined") return null
  try {
    const v = window.localStorage.getItem(KEY)
    return v === "granted" || v === "denied" ? v : null
  } catch {
    return null
  }
}

export function isMediaAllowed() {
  return allowed
}

export function grantConsent() {
  allowed = true
  try {
    window.localStorage.setItem(KEY, "granted")
  } catch {
    // Private mode — the choice just won't persist.
  }
  notify()
}

export function denyConsent() {
  try {
    window.localStorage.setItem(KEY, "denied")
  } catch {
    // Ignore.
  }
  notify()
}

export function onConsentChange(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

if (typeof window !== "undefined") {
  if (readStoredConsent() === "granted") allowed = true

  // A click anywhere already satisfies the autoplay policy.
  const mark = () => {
    allowed = true
    notify()
  }
  window.addEventListener("pointerdown", mark, { once: true, capture: true })
  window.addEventListener("keydown", mark, { once: true, capture: true })
}
