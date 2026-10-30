import type { Entity, Universe } from '../model/schema'
import { manuscriptOrder } from '../model/universe'
import { MentionMatcher } from './detection'
import { mentionIdsInDoc } from './doc'

/** Onde a ficha aparece no manuscrito: ponto de vista, presente, local ou só mencionada. */
export function appearancesOf(universe: Universe, e: Entity) {
  const matcher = new MentionMatcher([e])
  return manuscriptOrder(universe)
    .map((s) => {
      const found = matcher.find(s.text)
      const roles = [
        s.povId === e.id && 'POV',
        s.presentIds.includes(e.id) && 'presente',
        s.placeId === e.id && 'local',
        (found.length > 0 || mentionIdsInDoc(s.doc).has(e.id)) && 'mencionado',
      ].filter(Boolean) as string[]
      return { scene: s, roles, found }
    })
    .filter((a) => a.roles.length > 0)
}

/**
 * Em quantas cenas cada ficha aparece (de qualquer jeito: ponto de vista, presente, local ou
 * mencionada), numa passada só pelo manuscrito. A parte do iceberg que está à vista.
 */
export function sceneCounts(universe: Universe): Map<string, number> {
  const matcher = new MentionMatcher(universe.entities)
  const counts = new Map<string, number>()
  for (const s of manuscriptOrder(universe)) {
    const ids = new Set<string>([...matcher.find(s.text).map((m) => m.entityId), ...mentionIdsInDoc(s.doc), ...s.presentIds])
    if (s.povId) ids.add(s.povId)
    if (s.placeId) ids.add(s.placeId)
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return counts
}
