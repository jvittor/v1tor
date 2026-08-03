import { NextResponse } from "next/server"

import { listTracks } from "@/lib/music"

// Re-read the folder on every request so newly dropped videos show up.
export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  const tracks = await listTracks()
  return NextResponse.json({ tracks }, { headers: { "Cache-Control": "no-store" } })
}
