import type { Universe } from '../model/schema'
import { byId, manuscriptOrder } from '../model/universe'
import { factSentence } from './codex'
import { MentionMatcher } from './detection'
import { activeAt, relationSentence } from './relations'
import { revealIndex, splitReveals } from './reveals'
import type { Presence } from './stats'

export type ArcMomentKind = 'entra' | 'relacao-comeca' | 'relacao-termina' | 'fato' | 'sabe' | 'revela'

export interface ArcMoment {
  kind: ArcMomentKind
  text: string
}

export interface ArcStep {
  sceneId: string
  title: string
  /** Número da cena no manuscrito (1, 2, 3…). */
  n: number
  presence: Presence
  moments: ArcMoment[]
}

export interface Arc {
  steps: ArcStep[]
  /** Cenas em que está (POV ou presente) e em que só é citado. */
  present: number
  mentioned: number
  first: ArcStep | null
  last: ArcStep | null
  /** Maior sequência de cenas sem aparecer, entre a primeira e a última. */
  longestAbsence: number
}

const KNOW_VERB = { sabe: 'passa a saber', suspeita: 'passa a suspeitar', acredita: 'passa a acreditar', esqueceu: 'esquece' } as const

/**
 * O arco de uma ficha ao longo do manuscrito: onde aparece, e o que muda a cada cena
 * (ligações que começam ou acabam, fatos, o que passa a saber, o que o leitor descobre).
 */
export function characterArc(universe: Universe, entityId: string): Arc {
  const entity = byId(universe, 'entities', entityId)
  const scenes = manuscriptOrder(universe)
  const matcher = new MentionMatcher(entity ? [entity] : [])
  const mine = universe.relations.filter((r) => r.fromId === entityId || r.toId === entityId || r.via.some((v) => v.entityId === entityId))
  // O que o leitor descobre: trechos "a partir de" na descrição e nos campos.
  const reveals = new Map<number, string[]>()
  if (entity) {
    for (const part of [entity.description, ...entity.fields.map((f) => `${f.key}: ${f.value}`)].flatMap(splitReveals)) {
      if (part.sceneTitle === null) continue
      const i = revealIndex(part, scenes)
      if (i !== null) reveals.set(i, [...(reveals.get(i) ?? []), part.text.trim()])
    }
  }

  let seen = false
  const steps = scenes.map((scene, i): ArcStep => {
    const presence: Presence =
      scene.povId === entityId ? 'pov' : scene.presentIds.includes(entityId) ? 'presente' : matcher.find(scene.text).length ? 'mencionado' : null
    const moments: ArcMoment[] = []
    if (presence && !seen) {
      seen = true
      moments.push({ kind: 'entra', text: presence === 'mencionado' ? 'Primeira vez que é citado' : 'Entra na história' })
    }
    const prev = i > 0 ? scenes[i - 1] : null
    for (const r of mine) {
      if (r.scope.kind === 'geral') continue
      const now = activeAt(r, scene)
      const before = prev ? activeAt(r, prev) : false
      if (now && !before) moments.push({ kind: 'relacao-comeca', text: relationSentence(universe, r) })
      if (!now && before) moments.push({ kind: 'relacao-termina', text: relationSentence(universe, r) })
    }
    for (const f of universe.facts) {
      if (f.sourceSceneId === scene.id && (f.subjectId === entityId || f.objectId === entityId)) moments.push({ kind: 'fato', text: factSentence(universe, f) })
    }
    for (const k of universe.knowledge) {
      if (k.holderId !== entityId || k.sinceSceneId !== scene.id) continue
      const f = byId(universe, 'facts', k.factId)
      if (f) moments.push({ kind: 'sabe', text: `${KNOW_VERB[k.state]}: ${factSentence(universe, f)}` })
    }
    for (const text of reveals.get(i) ?? []) moments.push({ kind: 'revela', text })
    return { sceneId: scene.id, title: scene.title || 'Sem título', n: i + 1, presence, moments }
  })

  const shown = steps.filter((s) => s.presence)
  const firstIdx = steps.findIndex((s) => s.presence)
  const lastIdx = steps.length - 1 - [...steps].reverse().findIndex((s) => s.presence)
  let longest = 0
  let run = 0
  if (firstIdx >= 0)
    for (const s of steps.slice(firstIdx, lastIdx + 1)) {
      if (s.presence) run = 0
      else longest = Math.max(longest, ++run)
    }
  return {
    steps,
    present: shown.filter((s) => s.presence !== 'mencionado').length,
    mentioned: shown.filter((s) => s.presence === 'mencionado').length,
    first: firstIdx >= 0 ? steps[firstIdx] : null,
    last: firstIdx >= 0 ? steps[lastIdx] : null,
    longestAbsence: longest,
  }
}
