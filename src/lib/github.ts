import { SITE } from "@/lib/site"

export type GitHubProfile = {
  login: string
  name: string | null
  bio: string | null
  location: string | null
  blog: string | null
  company: string | null
  avatarUrl: string
  publicRepos: number
  followers: number
  following: number
}

const FALLBACK: GitHubProfile = {
  login: SITE.handle,
  name: SITE.name,
  bio: SITE.role,
  location: SITE.location,
  blog: null,
  company: null,
  avatarUrl: `https://github.com/${SITE.handle}.png`,
  publicRepos: 0,
  followers: 0,
  following: 0,
}

/**
 * Public profile data for the GitHub hover card. Revalidated hourly — the
 * unauthenticated API allows 60 requests/hour per IP.
 */
export async function getGitHubProfile(): Promise<GitHubProfile> {
  try {
    const res = await fetch(`https://api.github.com/users/${SITE.handle}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": SITE.handle,
        ...(process.env.GITHUB_TOKEN
          ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
          : {}),
      },
      next: { revalidate: 3600 },
    })

    if (!res.ok) return FALLBACK

    const data = await res.json()

    return {
      login: data.login ?? FALLBACK.login,
      name: data.name,
      bio: data.bio,
      location: data.location,
      blog: data.blog || null,
      company: data.company,
      avatarUrl: data.avatar_url ?? FALLBACK.avatarUrl,
      publicRepos: data.public_repos ?? 0,
      followers: data.followers ?? 0,
      following: data.following ?? 0,
    }
  } catch {
    return FALLBACK
  }
}
