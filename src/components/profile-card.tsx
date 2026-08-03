import { SocialLinks } from "@/components/social-links"
import type { GitHubProfile } from "@/lib/github"
import { SITE } from "@/lib/site"

export function ProfileCard({ profile }: { profile: GitHubProfile }) {
  return (
    <div
      className="stage-card rise"
      style={{ "--delay": "540ms" } as React.CSSProperties}
    >
      {/* `relative` makes this the anchor the hover windows open from. */}
      <div className="glass relative rounded-[1.35rem] px-[1.15em] py-[0.95em] text-ink">
        <p
          className="leading-[1.1] font-semibold tracking-[-0.02em]"
          style={{ fontSize: "var(--name-size)" }}
        >
          {SITE.fullName}
        </p>

        <p
          className="mt-[0.3em] leading-tight font-medium text-ink/60"
          style={{ fontSize: "var(--role-size)" }}
        >
          {SITE.role}
        </p>

        <div className="my-[0.85em] h-px bg-ink/12" />

        <SocialLinks profile={profile} />
      </div>
    </div>
  )
}
