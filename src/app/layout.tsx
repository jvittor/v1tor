import "@/styles/globals.css"

import { GeistMono } from "geist/font/mono"
import { GeistSans } from "geist/font/sans"
import type { Metadata, Viewport } from "next"

import { SITE } from "@/lib/site"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  alternates: { canonical: "/" },
  title: {
    default: `${SITE.name} — ${SITE.role}`,
    template: `%s — ${SITE.name}`,
  },
  description: SITE.description,
  authors: [{ name: SITE.name, url: SITE.url }],
  creator: SITE.name,
  openGraph: {
    type: "profile",
    url: "/",
    siteName: SITE.name,
    title: `${SITE.name} — ${SITE.role}`,
    description: SITE.description,
    username: SITE.handle,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} — ${SITE.role}`,
    description: SITE.description,
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#d9d9d8",
  colorScheme: "light",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={cn(GeistSans.variable, GeistMono.variable)}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  )
}
