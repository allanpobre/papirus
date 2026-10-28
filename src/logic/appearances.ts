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
