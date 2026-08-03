import Image from "next/image"

import { GitHubIcon } from "@/components/icons"
import type { GitHubProfile } from "@/lib/github"

export function GitHubPreview({ profile }: { profile: GitHubProfile }) {
  return (
    <div className="p-4">
      <div className="flex items-start gap-3">
        <Image
          src={profile.avatarUrl}
          alt=""
          width={48}
          height={48}
          className="size-12 shrink-0 rounded-full ring-1 ring-ink/10"
          unoptimized
        />

        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] leading-tight font-semibold text-ink">
            {profile.name ?? profile.login}
          </p>
          <p className="truncate font-mono text-xs text-ash">
            @{profile.login}
          </p>
        </div>

        <GitHubIcon className="size-4 shrink-0 text-ink/70" />
      </div>

      {profile.bio && (
        <p className="mt-3 text-[13px] leading-relaxed text-ink/80">
          {profile.bio}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ash">
        {profile.location && <span>{profile.location}</span>}
        {profile.blog && (
          <span className="truncate text-ink/60">{profile.blog}</span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-4 border-t border-ink/10 pt-3 text-[11px] text-ash">
        <Stat value={profile.publicRepos} label="repos" />
        <Stat value={profile.followers} label="followers" />
        <Stat value={profile.following} label="following" />
      </div>
    </div>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <span>
      <span className="font-mono font-medium text-ink">{value}</span>{" "}
      <span>{label}</span>
    </span>
  )
}
