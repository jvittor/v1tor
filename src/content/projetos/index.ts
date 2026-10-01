/*
 * A pasta PROJETOS do Game Boy. Pra adicionar um projeto, crie um arquivo
 * aqui seguindo o tipo em ./tipo.ts e coloque ele na lista abaixo, na ordem
 * em que deve aparecer na tela.
 */
import { batteryMonitor } from "./battery-monitor"
import { brixel } from "./brixel"
import { catalogoIa } from "./catalogo-ia"
import { muralCameras } from "./mural-cameras"
import type { Projeto } from "./tipo"
import { urpiabr } from "./urpiabr"
import { v1tor } from "./v1tor"

export type { Projeto }

export const PROJETOS: Projeto[] = [
  brixel,
  catalogoIa,
  batteryMonitor,
  muralCameras,
  urpiabr,
  v1tor,
]
