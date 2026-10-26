import type { Universe } from '../model/schema'
import { manuscriptOrder } from '../model/universe'
import { countWords, wordCount } from '../persistence/repository'
import { MentionMatcher } from './detection'

export const todayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Palavras escritas hoje, a partir do total registrado no início do dia. */
export function wordsToday(universe: Universe): number {
  const start = universe.dailyStart[todayKey()]
  return start === undefined ? 0 : Math.max(0, countWords(universe) - start)
}

/** Garante que o total do início de hoje esteja registrado. */
export function withDailyStart(universe: Universe): Universe {
  const key = todayKey()
  if (universe.dailyStart[key] !== undefined) return universe
  // Guarda os últimos 140 dias com registro (o calendário de escrita mostra 16 semanas).
  const kept = Object.entries(universe.dailyStart)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 139)
  return { ...universe, dailyStart: { ...Object.fromEntries(kept), [key]: countWords(universe) } }
}

export type Presence = 'pov' | 'presente' | 'mencionado' | null

/** Matriz cenas × personagens: quem é POV, quem está presente, quem só é mencionado. */
export function presenceMatrix(universe: Universe, kinds = ['personagem']) {
  const scenes = manuscriptOrder(universe)
  const people = universe.entities.filter((e) => kinds.includes(e.kind))
  const matcher = new MentionMatcher(people)
  const rows = scenes.map((scene) => {
    const mentioned = new Set(matcher.find(scene.text).map((m) => m.entityId))
    const cells = new Map<string, Presence>()
    for (const p of people) {
      cells.set(
        p.id,
        scene.povId === p.id ? 'pov' : scene.presentIds.includes(p.id) ? 'presente' : mentioned.has(p.id) ? 'mencionado' : null,
      )
    }
    return { scene, words: wordCount(scene.text), cells }
  })
  // Só personagens que aparecem em alguma cena, mais aparecidos primeiro.
  const appearances = new Map(people.map((p) => [p.id, rows.filter((r) => r.cells.get(p.id)).length]))
  const columns = people
    .filter((p) => appearances.get(p.id)! > 0)
    .sort((a, b) => appearances.get(b.id)! - appearances.get(a.id)!)
  return { rows, columns, appearances }
}

/** Maior sequência de cenas seguidas em que o personagem não aparece. */
export function longestAbsence(rows: { cells: Map<string, Presence> }[], entityId: string): number {
  let best = 0
  let run = 0
  let seen = false
  for (const r of rows) {
    if (r.cells.get(entityId)) {
      if (seen) best = Math.max(best, run)
      seen = true
      run = 0
    } else run++
  }
  return best
}

/**
 * Palavras escritas em cada um dos últimos `days` dias (o último é hoje), a partir
 * do total registrado no início de cada dia. Dias sem registro contam como zero.
 */
export function wordsByDay(universe: Universe, days = 7, now = new Date()): { day: string; words: number }[] {
  const keys = Array.from({ length: days }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - (days - 1 - i))
    return todayKey(d)
  })
  const starts = universe.dailyStart
  const sorted = Object.keys(starts).sort()
  const total = countWords(universe)
  return keys.map((day) => {
    if (starts[day] === undefined) return { day, words: 0 }
    // O fim do dia é o início do próximo dia registrado (ou o total atual, se for o último).
    const next = sorted.find((k) => k > day)
    const end = next === undefined ? total : starts[next]
    return { day, words: Math.max(0, end - starts[day]) }
  })
}
