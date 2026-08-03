import type { NextConfig } from "next"
import path from "path"

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  turbopack: {
    root: path.join(__dirname, "."),
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
  /*
   * The music API reads public/music at request time. Next only traces files
   * it sees imported, so the folder has to be named explicitly or the route
   * finds nothing once deployed.
   */
  outputFileTracingIncludes: {
    "/api/music": ["./public/music/**"],
    "/api/music/lyrics": ["./public/music/**"],
  },
}

export default nextConfig
