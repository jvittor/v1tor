import Image from "next/image"

import { LinkedInIcon } from "@/components/icons"
import { LINKEDIN_PROFILE, LINKS } from "@/lib/site"

export function LinkedInPreview() {
  return (
    <div>
      {/* Cover strip, echoing the profile banner. */}
      <div className="relative h-16 bg-[linear-gradient(120deg,#c9c9c7_0%,#e7e7e5_50%,#c9c9c7_100%)]">
        <div className="absolute inset-0 opacity-60">
          <Image
            src="/background1.png"
            alt=""
            fill
            sizes="320px"
            className="object-cover object-[50%_28%] grayscale"
          />
        </div>
        <LinkedInIcon className="absolute top-3 right-3 size-4 text-ink/70" />
      </div>

      <div className="px-4 pb-4">
        {/* The portrait is 16:9, so a square `object-cover` crop ignores the
            vertical position entirely. Zooming via background-size is the only
            way to actually frame the face. */}
        <div
          className="-mt-7 mb-3 size-14 rounded-full bg-no-repeat ring-2 ring-white"
          style={{
            backgroundImage: "url(/background1.png)",
            backgroundSize: "auto 300%",
            backgroundPosition: "50% 24%",
          }}
        />

        <p className="text-[15px] leading-tight font-semibold text-ink">
          {LINKEDIN_PROFILE.name}
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink/80">
          {LINKEDIN_PROFILE.headline}
        </p>

        <p className="mt-2 text-[11px] text-ash">
          {LINKEDIN_PROFILE.location}
          <span className="px-1.5 text-ash/60">·</span>
          <span className="text-ink/60">
            {LINKEDIN_PROFILE.connections} connections
          </span>
        </p>

        <p className="mt-3 truncate border-t border-ink/10 pt-3 font-mono text-[11px] text-ash">
          {LINKS.linkedin.replace("https://", "")}
        </p>
      </div>
    </div>
  )
}
