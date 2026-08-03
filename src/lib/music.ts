import fs from "node:fs/promises"
import path from "node:path"

export type Track = {
  file: string
  src: string
  artist: string
  title: string
}

export type LyricLine = { time: number; text: string }

const MUSIC_DIR = path.join(process.cwd(), "public", "music")
const VIDEO_EXT = new Set([".mp4", ".webm", ".mov", ".m4v"])

/**
 * Filenames are the only metadata we have, and they follow the usual
 * "Artist - Title (Some Video Tag)" download convention.
 */
function parseName(file: string): { artist: string; title: string } {
  const base = path
    .basename(file, path.extname(file))
    // Drop "(Official Video)", "[HD]" and friends.
    .replace(/[([][^)\]]*[)\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  const parts = base.split(" - ").map((s) => s.trim()).filter(Boolean)
  if (parts.length < 2) return { artist: "", title: base }

  const artist = parts[0]
  let title = parts.slice(1).join(" - ")

  // Some files repeat the artist ("The Beatles - The Beatles - A Day...").
  if (title.toLowerCase().startsWith(artist.toLowerCase() + " - ")) {
    title = title.slice(artist.length + 3).trim()
  }

  return { artist, title }
}

/**
 * Read at request time rather than baked in at build, so dropping a new video
 * into public/music is all it takes to add a track.
 */
export async function listTracks(): Promise<Track[]> {
  try {
    const files = await fs.readdir(MUSIC_DIR)
    return files
      .filter((f) => !f.startsWith(".") && VIDEO_EXT.has(path.extname(f).toLowerCase()))
      .sort()
      .map((file) => ({
        file,
        src: `/music/${encodeURIComponent(file)}`,
        ...parseName(file),
      }))
  } catch {
    return []
  }
}

/** `[mm:ss.xx] text` — one entry per timestamp, blank lines kept out. */
function parseLrc(lrc: string): LyricLine[] {
  const lines: LyricLine[] = []

  for (const raw of lrc.split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g)]
    if (!stamps.length) continue

    const text = raw.replace(/\[[^\]]*\]/g, "").trim()
    if (!text) continue

    for (const s of stamps) {
      const fraction = s[3] ? Number(`0.${s[3]}`) : 0
      lines.push({ time: Number(s[1]) * 60 + Number(s[2]) + fraction, text })
    }
  }

  return lines.sort((a, b) => a.time - b.time)
}

/**
 * Prefers a hand-placed `.lrc` sitting next to the video, so a bad automatic
 * match can always be overridden; otherwise asks LRCLIB, a free community
 * database of synced lyrics.
 */
export async function getLyrics(track: Track): Promise<LyricLine[] | null> {
  const local = path.join(
    MUSIC_DIR,
    path.basename(track.file, path.extname(track.file)) + ".lrc"
  )

  try {
    const lrc = await fs.readFile(local, "utf8")
    const lines = parseLrc(lrc)
    if (lines.length) return lines
  } catch {
    // No local override — fall through to the lookup.
  }

  if (!track.artist || !track.title) return null

  try {
    const url =
      "https://lrclib.net/api/search?" +
      new URLSearchParams({
        artist_name: track.artist,
        track_name: track.title,
      })

    const res = await fetch(url, {
      headers: { "User-Agent": "v1tor.com (personal site)" },
      next: { revalidate: 86400 },
    })

    if (!res.ok) return null

    const results = (await res.json()) as {
      syncedLyrics?: string | null
      instrumental?: boolean
    }[]

    const hit = results.find((r) => r.syncedLyrics && !r.instrumental)
    if (!hit?.syncedLyrics) return null

    const lines = parseLrc(hit.syncedLyrics)
    return lines.length ? lines : null
  } catch {
    return null
  }
}
