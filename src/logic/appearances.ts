import type { Entity, Scene, Universe } from '../model/schema'
import { cachedBy, identityCache } from '../model/memo'
import { manuscriptOrder } from '../model/universe'
import { MentionMatcher } from './detection'
import { mentionIdsInDoc } from './doc'

/** O jeito como a ficha está numa cena, do mais forte para o mais fraco. */
export type AppearanceRole = 'pov' | 'presente' | 'local' | 'mencionado'

export const APPEARANCE_LABEL: Record<AppearanceRole, string> = {
  pov: 'ponto de vista',
  presente: 'presente',
  local: 'local da cena',
  mencionado: 'mencionado',
}

/** Onde a ficha aparece no manuscrito: ponto de vista, presente, local ou só mencionada. */
export function appearancesOf(universe: Universe, e: Entity) {
  const matcher = new MentionMatcher([e])
  return manuscriptOrder(universe)
    .map((s) => {
      const found = matcher.find(s.text)
      const roles = [
        s.povId === e.id && 'pov',
        s.presentIds.includes(e.id) && 'presente',
        s.placeId === e.id && 'local',
        (found.length > 0 || mentionIdsInDoc(s.doc).has(e.id)) && 'mencionado',
      ].filter(Boolean) as AppearanceRole[]
      return { scene: s, roles, found }
    })
    .filter((a) => a.roles.length > 0)
}

export type Appearance = ReturnType<typeof appearancesOf>[number]

/** Um pedaço do trecho mostrado: o nome (e os apelidos) ficam marcados. */
export interface SnippetPart {
  text: string
  mark: boolean
}

/**
 * O trecho em volta de uma menção, com todas as menções que caem dentro dele marcadas (para o nome
 * aparecer em destaque, e não sumir no meio). As reticências dizem que o texto continua.
 */
export function snippetParts(text: string, hits: { from: number; to: number }[], focus: number, radius = 60): SnippetPart[] {
  const hit = hits[focus]
  if (!hit) return []
  let start = Math.max(0, hit.from - radius)
  let end = Math.min(text.length, hit.to + radius)
  // Não corta palavra no meio.
  while (start > 0 && /\S/.test(text[start - 1])) start--
  while (end < text.length && /\S/.test(text[end])) end++
  const parts: SnippetPart[] = []
  const push = (t: string, mark: boolean) => {
    const clean = t.replace(/\s+/g, ' ')
    if (!clean) return
    const last = parts.at(-1)
    if (last && last.mark === mark) last.text += clean
    else parts.push({ text: clean, mark })
  }
  if (start > 0) push('…', false)
  let at = start
  for (const h of hits) {
    if (h.to <= start || h.from >= end) continue
    const from = Math.max(h.from, start)
    if (from > at) push(text.slice(at, from), false)
    push(text.slice(from, Math.min(h.to, end)), true)
    at = Math.min(h.to, end)
  }
  if (end > at) push(text.slice(at, end), false)
  if (end < text.length) push('…', false)
  // Sem espaço sobrando nas pontas.
  if (parts.length) {
    parts[0].text = parts[0].text.replace(/^\s+/, '')
    parts[parts.length - 1].text = parts[parts.length - 1].text.replace(/\s+$/, '')
  }
  return parts.filter((p) => p.text)
}

/** Uma cena na tira de presença: onde ela está no livro e o papel mais forte da ficha ali (ou nenhum). */
export interface PresenceDot {
  scene: Scene
  role: AppearanceRole | null
  /** A posição da cena na ordem de leitura (o livro todo). */
  position: number
}

/**
 * A tira de presença: todas as cenas do manuscrito, na ordem de leitura, separadas por livro, com o
 * papel mais forte da ficha em cada uma. Mostra de relance onde o personagem está no livro.
 */
export function presenceStrip(universe: Universe, appearances: Appearance[]): { storyId: string | null; title: string; dots: PresenceDot[] }[] {
  const role = new Map(appearances.map((a) => [a.scene.id, a.roles[0] ?? null]))
  const groups: { storyId: string | null; title: string; dots: PresenceDot[] }[] = []
  for (const [position, scene] of manuscriptOrder(universe).entries()) {
    let g = groups.at(-1)
    if (!g || g.storyId !== scene.storyId) {
      const story = universe.stories.find((st) => st.id === scene.storyId)
      g = { storyId: scene.storyId, title: story ? story.title || 'Sem título' : 'Sem capítulo', dots: [] }
      groups.push(g)
    }
    g.dots.push({ scene, role: role.get(scene.id) ?? null, position })
  }
  return groups
}

/**
 * Em quantas cenas cada ficha aparece (de qualquer jeito: ponto de vista, presente, local ou
 * mencionada), numa passada só pelo manuscrito. A parte do iceberg que está à vista.
 */
const countsCache = identityCache()

/**
 * Guardado enquanto as cenas, as histórias e as fichas forem as mesmas: Fichas, Ligações, Linha do tempo, Mapas e
 * o Início dividem a mesma conta (num livro inteiro, ela é a parte mais pesada). Não altere o resultado.
 */
export function sceneCounts(universe: Universe): Map<string, number> {
  return cachedBy(countsCache, [universe.scenes, universe.stories, universe.entities], () => {
    const matcher = new MentionMatcher(universe.entities)
    const counts = new Map<string, number>()
    for (const s of manuscriptOrder(universe)) {
      const ids = new Set<string>([...matcher.find(s.text).map((m) => m.entityId), ...mentionIdsInDoc(s.doc), ...s.presentIds])
      if (s.povId) ids.add(s.povId)
      if (s.placeId) ids.add(s.placeId)
      for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    return counts
  })
}
