export const SITE = {
  url: "https://v1tor.com",
  name: "v1tor",
  fullName: "Vítor Silv",
  handle: "jvittor",
  title: "v1tor",
  role: "Software Engineer",
  location: "Worldwide",
  description: "Vítor Silv, Software Engineer. Portfólio dentro de um Game Boy.",
} as const

export const LINKS = {
  github: "https://github.com/jvittor",
  linkedin: "https://linkedin.com/in/jvittor",
  spotify: "https://open.spotify.com/user/jvittor",
} as const

/**
 * LinkedIn has no public profile API and blocks unauthenticated requests
 * (every fetch answers HTTP 999), so the preview card is rendered from these
 * values. Edit them to match the live profile.
 */
export const LINKEDIN_PROFILE = {
  name: SITE.fullName,
  headline: SITE.role,
  location: SITE.location,
  connections: "500+",
} as const
