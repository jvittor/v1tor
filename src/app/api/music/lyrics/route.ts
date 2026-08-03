import { NextResponse } from "next/server"

import { getLyrics, listTracks } from "@/lib/music"

export async function GET(request: Request) {
  const file = new URL(request.url).searchParams.get("file")
  if (!file) {
    return NextResponse.json({ error: "missing file" }, { status: 400 })
  }

  // Resolve against the real listing rather than trusting the query, which
  // also keeps path traversal out of the picture.
  const track = (await listTracks()).find((t) => t.file === file)
  if (!track) {
    return NextResponse.json({ error: "unknown track" }, { status: 404 })
  }

  const lines = await getLyrics(track)

  return NextResponse.json(
    { lines: lines ?? [], synced: Boolean(lines?.length) },
    { headers: { "Cache-Control": "public, s-maxage=86400" } }
  )
}
