import { ConsentToast } from "@/components/consent-toast"
import { ProfileCard } from "@/components/profile-card"
import { Sigil } from "@/components/sigil"
import { getGitHubProfile } from "@/lib/github"
import { SITE } from "@/lib/site"

export default async function Page() {
  const profile = await getGitHubProfile()

  return (
    <main className="stage relative h-svh w-full overflow-hidden bg-paper">
      <h1 className="sr-only">
        {SITE.name} — {SITE.role}
      </h1>

      <div className="settle absolute inset-0">
        <img
          src="/background1.png"
          sizes="100vw"
          alt=""
          fetchPriority="high"
          decoding="async"
          className="size-full object-cover object-center"
        />
      </div>

      <Sigil />
      <ProfileCard profile={profile} />
      <ConsentToast />

      {/* Lifts away once the first paint lands. */}
      <div
        aria-hidden
        className="curtain pointer-events-none fixed inset-0 z-50 bg-paper"
      />
    </main>
  )
}
