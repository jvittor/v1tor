"use client"

import { GitHubIcon, HeartIcon, LinkedInIcon } from "@/components/icons"
import { GitHubPreview } from "@/components/previews/github-preview"
import { LinkedInPreview } from "@/components/previews/linkedin-preview"
import { MusicPreview } from "@/components/previews/music-preview"
import { SocialLink } from "@/components/social-link"
import type { GitHubProfile } from "@/lib/github"
import { LINKS } from "@/lib/site"

export function SocialLinks({ profile }: { profile: GitHubProfile }) {
  return (
    <nav className="stage-links" aria-label="Elsewhere">
      <SocialLink
        href={LINKS.linkedin}
        label="LinkedIn"
        icon={<LinkedInIcon className="size-full" />}
        preview={() => <LinkedInPreview />}
      />

      <SocialLink
        href={LINKS.github}
        label="GitHub"
        icon={<GitHubIcon className="size-full" />}
        preview={() => <GitHubPreview profile={profile} />}
      />

      <SocialLink
        href={LINKS.spotify}
        label="Music"
        icon={<HeartIcon className="size-full object-contain" />}
        mode="beat"
        idealWidth={380}
        preview={(open) => <MusicPreview open={open} />}
      />
    </nav>
  )
}
