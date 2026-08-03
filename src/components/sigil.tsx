"use client"

import Image from "next/image"
import { useState } from "react"

import { SpinDust } from "@/components/spin-dust"
import { SITE } from "@/lib/site"

export function Sigil() {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="stage-logo rise"
      style={{ "--delay": "300ms" } as React.CSSProperties}
      onPointerEnter={(e) => {
        if (e.pointerType !== "touch") setHovered(true)
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== "touch") setHovered(false)
      }}
      onPointerDown={() => setHovered(true)}
    >
      <SpinDust active={hovered} speed={400} className="w-full">
        <Image
          src="/sigil.png"
          alt={SITE.name}
          width={512}
          height={512}
          priority
          className="h-auto w-full select-none"
          draggable={false}
        />
      </SpinDust>
    </div>
  )
}
