import { Press_Start_2P } from "next/font/google"
import { preload } from "react-dom"

import { GameBoy } from "@/components/gameboy/game-boy"
import { EXPERIENCIAS } from "@/content/curriculo"
import { PROJETOS } from "@/content/projetos"
import { getGitHubProfile } from "@/lib/github"
import { LINKS, SITE } from "@/lib/site"

const pixel = Press_Start_2P({
  weight: "400",
  subsets: ["latin", "latin-ext"],
  display: "block",
})

export default async function Page() {
  // O modelo começa a baixar junto com o HTML, sem esperar o JavaScript.
  preload("/models/gameboy.glb", { as: "fetch", crossOrigin: "anonymous" })
  const profile = await getGitHubProfile()

  return (
    <main
      className={`${pixel.className} retro relative h-svh w-full overflow-hidden select-none`}
    >
      {/* O canvas não é lido por leitor de tela nem por buscador. */}
      <div className="sr-only">
        <h1>
          {SITE.fullName}, {SITE.role}
        </h1>
        <h2>Projetos</h2>
        <ul>
          {PROJETOS.map((p) => (
            <li key={p.repo}>
              <a href={p.repo}>{p.nome}</a>: {p.sobre}
            </li>
          ))}
        </ul>
        <h2>Experiência</h2>
        <ul>
          {EXPERIENCIAS.map((e) => (
            <li key={e.nome}>
              {e.nome}, {e.cargo}, {e.periodo}. {e.texto}
            </li>
          ))}
        </ul>
        <a href={LINKS.github}>GitHub</a> <a href={LINKS.linkedin}>LinkedIn</a>
      </div>

      <GameBoy profile={profile} font={pixel.style.fontFamily} />
    </main>
  )
}
