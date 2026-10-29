import type { Scene, Seed, STORY_STRUCTURES, Universe } from '../model/schema'
import { scenesOf } from '../model/universe'
import { wordCount } from '../persistence/repository'
import { presenceMatrix } from './stats'

/*
 * O Mapa da história, sem IA: o app não lê se a cena "funciona". Ele usa o que o autor marca
 * (o cartão e a virada) e o que dá para contar (palavras, quem aparece, onde as pistas estão),
 * e transforma isso em atos, linhas e perguntas.
 */

export type Structure = (typeof STORY_STRUCTURES)[number]

export const STRUCTURE_LABEL: Record<Structure, string> = {
  livre: 'Livre',
  'tres-atos': 'Três atos',
  'save-the-cat': 'Save the Cat',
  jornada: 'Jornada do herói',
}

/** Um momento do modelo: onde ele costuma cair (0 = começo, 1 = fim do livro). */
export interface Beat {
  name: string
  at: number
}

export interface Act {
  name: string
  from: number
  to: number
}

export const STRUCTURES: Record<Structure, { acts: Act[]; beats: Beat[] }> = {
  livre: { acts: [], beats: [] },
  'tres-atos': {
    acts: [
      { name: 'Ato I', from: 0, to: 0.25 },
      { name: 'Ato II', from: 0.25, to: 0.75 },
      { name: 'Ato III', from: 0.75, to: 1 },
    ],
    beats: [
      { name: 'Gancho', at: 0 },
      { name: 'Virada 1', at: 0.25 },
      { name: 'Meio', at: 0.5 },
      { name: 'Tudo perdido', at: 0.75 },
      { name: 'Clímax', at: 0.9 },
    ],
  },
  'save-the-cat': {
    acts: [
      { name: 'Ato I', from: 0, to: 0.2 },
      { name: 'Ato II', from: 0.2, to: 0.8 },
      { name: 'Ato III', from: 0.8, to: 1 },
    ],
    beats: [
      { name: 'Imagem de abertura', at: 0 },
      { name: 'Tema', at: 0.05 },
      { name: 'Catalisador', at: 0.1 },
      { name: 'Debate', at: 0.15 },
      { name: 'Entrada no Ato II', at: 0.2 },
      { name: 'História B', at: 0.22 },
      { name: 'Diversão', at: 0.3 },
      { name: 'Ponto central', at: 0.5 },
      { name: 'Os vilões se aproximam', at: 0.62 },
      { name: 'Tudo perdido', at: 0.75 },
      { name: 'Noite escura', at: 0.77 },
      { name: 'Entrada no Ato III', at: 0.8 },
      { name: 'Final', at: 0.9 },
      { name: 'Imagem final', at: 0.99 },
    ],
  },
  jornada: {
    acts: [
      { name: 'Partida', from: 0, to: 0.25 },
      { name: 'Iniciação', from: 0.25, to: 0.75 },
      { name: 'Retorno', from: 0.75, to: 1 },
    ],
    beats: [
      { name: 'Mundo comum', at: 0 },
      { name: 'Chamado', at: 0.08 },
      { name: 'Recusa', at: 0.12 },
      { name: 'Mentor', at: 0.17 },
      { name: 'Travessia', at: 0.25 },
      { name: 'Provas e aliados', at: 0.35 },
      { name: 'Caverna', at: 0.45 },
      { name: 'Provação', at: 0.5 },
      { name: 'Recompensa', at: 0.6 },
      { name: 'Caminho de volta', at: 0.75 },
      { name: 'Ressurreição', at: 0.88 },
      { name: 'Retorno com o elixir', at: 0.97 },
    ],
  },
}

/** Uma cena no Mapa: onde ela começa e termina no livro (pelas palavras) e os momentos que caem nela. */
export interface MapScene {
  scene: Scene
  words: number
  from: number
  to: number
  /** O ato em que a cena começa (-1 sem modelo). */
  act: number
  beats: string[]
}

/** As cenas da história com a posição de cada uma. Sem palavras ainda, conta cenas. */
export function storyMap(universe: Universe, storyId: string | null, structure: Structure): MapScene[] {
  const scenes = scenesOf(universe, storyId)
  const words = scenes.map((s) => wordCount(s.text))
  const total = words.reduce((a, b) => a + b, 0)
  const size = (i: number) => (total > 0 ? words[i] / total : 1 / scenes.length)
  const { acts, beats } = STRUCTURES[structure]
  let at = 0
  return scenes.map((scene, i) => {
    const from = at
    const to = i === scenes.length - 1 ? 1 : at + size(i)
    at = to
    const act = acts.findIndex((a) => from >= a.from - 1e-9 && from < a.to)
    return {
      scene,
      words: words[i],
      from,
      to,
      act: acts.length ? (act === -1 ? acts.length - 1 : act) : -1,
      beats: beats.filter((b) => b.at >= from && (b.at < to || (i === scenes.length - 1 && b.at <= 1))).map((b) => b.name),
    }
  })
}

/** Uma promessa (pista ou mistério) como linha: onde foi plantada, onde avançou e onde foi paga. */
export interface PromiseLine {
  seed: Seed
  points: { kind: 'plantada' | 'pista' | 'paga'; at: number; sceneId: string }[]
  /** Plantada, sem nada depois, e já ficou para trás (passou um quarto do livro ou mais). */
  stalled: boolean
}

export function promiseLines(universe: Universe, map: MapScene[]): PromiseLine[] {
  const where = new Map(map.map((m) => [m.scene.id, (m.from + m.to) / 2]))
  const end = map.length ? map[map.length - 1].to : 0
  return universe.seeds
    .filter((seed) => seed.status !== 'abandonada')
    .map((seed) => {
      const points: PromiseLine['points'] = []
      if (seed.setupSceneId && where.has(seed.setupSceneId)) points.push({ kind: 'plantada', at: where.get(seed.setupSceneId)!, sceneId: seed.setupSceneId })
      for (const c of seed.clues) if (c.sceneId && where.has(c.sceneId)) points.push({ kind: 'pista', at: where.get(c.sceneId)!, sceneId: c.sceneId })
      if (seed.payoffSceneId && where.has(seed.payoffSceneId)) points.push({ kind: 'paga', at: where.get(seed.payoffSceneId)!, sceneId: seed.payoffSceneId })
      points.sort((a, b) => a.at - b.at)
      const planted = points.find((p) => p.kind === 'plantada')
      const later = planted ? points.filter((p) => p.at > planted.at) : []
      const stalled = Boolean(planted && !later.length && seed.status !== 'resolvida' && end - planted.at >= 0.25)
      return { seed, points, stalled }
    })
    .filter((l) => l.points.length > 0)
}

const title = (s: Scene) => `“${s.title || 'Sem título'}”`
const NUM = ['', 'uma', 'duas', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez']
const count = (n: number) => (n <= 10 ? NUM[n] : String(n))

/** Uma pergunta do Mapa: o que o app notou, e a cena para abrir. */
export interface MapNotice {
  text: string
  sceneId: string | null
}

/**
 * O que vale olhar, em forma de pergunta. Só usa o que o autor marcou e o que dá para contar:
 * onde cai o meio, cenas marcadas como "igual", sequências na mesma direção, promessas paradas
 * e personagens que somem.
 */
export function mapNotices(universe: Universe, map: MapScene[], structure: Structure, promises: PromiseLine[]): MapNotice[] {
  const out: MapNotice[] = []
  if (map.length >= 3 && structure !== 'livre') {
    const mid = map.find((m) => m.from <= 0.5 && 0.5 < m.to) ?? map[map.length - 1]
    const mark = mid.scene.shift === 'igual' ? ', que está marcada como “igual”' : mid.scene.shift === '' ? ', que ainda não tem marca' : ''
    if (mid.scene.shift !== 'melhor' && mid.scene.shift !== 'pior') out.push({ text: `O meio da história cai em ${title(mid.scene)}${mark}. Ela é uma virada?`, sceneId: mid.scene.id })
  }
  for (const m of map) if (m.scene.shift === 'igual') out.push({ text: `${title(m.scene)} está marcada como “igual”. Alguma coisa muda nela?`, sceneId: m.scene.id })
  // Muitas cenas seguidas na mesma direção cansam o leitor (ou são de propósito).
  let run: MapScene[] = []
  const flush = () => {
    if (run.length >= 4)
      out.push({
        text: `${count(run.length)[0].toUpperCase()}${count(run.length).slice(1)} cenas seguidas terminam ${run[0].scene.shift} (de ${title(run[0].scene)} a ${title(run[run.length - 1].scene)}). É de propósito?`,
        sceneId: run[0].scene.id,
      })
    run = []
  }
  for (const m of map) {
    if ((m.scene.shift === 'melhor' || m.scene.shift === 'pior') && (!run.length || run[0].scene.shift === m.scene.shift)) run.push(m)
    else {
      flush()
      if (m.scene.shift === 'melhor' || m.scene.shift === 'pior') run.push(m)
    }
  }
  flush()
  for (const p of promises.filter((l) => l.stalled)) {
    const planted = map.find((m) => m.scene.id === p.points[0].sceneId)
    out.push({ text: `“${p.seed.title}” foi plantada em ${planted ? title(planted.scene) : 'uma cena'} e nenhuma pista dela aparece depois. Ela ainda vai avançar?`, sceneId: p.points[0].sceneId })
  }
  // Quem some: um personagem que aparece e depois fica quatro cenas ou mais sem aparecer.
  const ids = new Set(map.map((m) => m.scene.id))
  const { rows, columns } = presenceMatrix(universe)
  const here = rows.filter((r) => ids.has(r.scene.id))
  for (const c of columns.slice(0, 8)) {
    let last = -1
    let gap = 0
    let gapFrom = -1
    here.forEach((r, i) => {
      if (r.cells.get(c.id)) {
        if (last >= 0 && i - last - 1 > gap) {
          gap = i - last - 1
          gapFrom = last
        }
        last = i
      }
    })
    const trailing = last >= 0 ? here.length - 1 - last : 0
    if (trailing > gap) {
      gap = trailing
      gapFrom = last
    }
    if (gap >= 4 && gapFrom >= 0) out.push({ text: `${c.name} fica ${count(gap)} cenas sem aparecer depois de ${title(here[gapFrom].scene)}. O leitor ainda lembra?`, sceneId: here[gapFrom].scene.id })
  }
  return out
}

/** Cenas sem cartão (nenhum dos três campos preenchido). */
export const withoutCard = (map: MapScene[]) => map.filter((m) => !m.scene.want.trim() && !m.scene.obstacle.trim() && !m.scene.outcome.trim())
