import type { TimelineEvent, Universe } from '../model/schema'
import { byId, manuscriptOrder } from '../model/universe'

/*
 * Linha do tempo em faixas (como Aeon Timeline e Crusader Kings): uma faixa por personagem, grupo ou lugar,
 * com os eventos de cada um no ano. Mais causa → consequência e o ano em que a história está.
 */

export type LaneBy = 'personagem' | 'grupo' | 'lugar'
export const LANE_KINDS: Record<LaneBy, string[]> = {
  personagem: ['personagem'],
  grupo: ['reino', 'faccao', 'religiao', 'cultura', 'especie'],
  lugar: ['lugar'],
}
export const LANE_LABEL: Record<LaneBy, string> = { personagem: 'Personagens', grupo: 'Reinos e grupos', lugar: 'Lugares' }

export interface Lane {
  /** Id da ficha; '' para a faixa "Mundo" (eventos sem ninguém daquele tipo). */
  id: string
  name: string
  events: TimelineEvent[]
}

/** As faixas: cada ficha do tipo que aparece nos eventos (participante ou lugar), na ordem do primeiro evento. */
export function lanesOf(u: Universe, events: TimelineEvent[], by: LaneBy): Lane[] {
  const kinds = LANE_KINDS[by]
  const lanes = new Map<string, Lane>()
  const world: Lane = { id: '', name: 'Mundo', events: [] }
  for (const ev of [...events].sort((a, b) => a.year - b.year)) {
    const ids = [...new Set([...ev.entityIds, ...(ev.placeId ? [ev.placeId] : [])])].filter((id) => {
      const e = byId(u, 'entities', id)
      return e && kinds.includes(e.kind) && e.canon !== 'secreto'
    })
    if (!ids.length) world.events.push(ev)
    for (const id of ids) {
      if (!lanes.has(id)) lanes.set(id, { id, name: byId(u, 'entities', id)!.name, events: [] })
      lanes.get(id)!.events.push(ev)
    }
  }
  return [...(world.events.length ? [world] : []), ...lanes.values()]
}

export interface OutOfOrder {
  cause: TimelineEvent
  effect: TimelineEvent
}

/** Consequências que vêm antes da causa (o ano da consequência é menor). */
export function outOfOrder(events: TimelineEvent[]): OutOfOrder[] {
  const by = new Map(events.map((e) => [e.id, e]))
  const out: OutOfOrder[] = []
  for (const effect of events)
    for (const id of effect.causes ?? []) {
      const cause = by.get(id)
      if (cause && cause.year > effect.year) out.push({ cause, effect })
    }
  return out
}

/** O ano em que a história está: a data da cena escolhida, ou da última cena com data antes dela. */
export function storyYear(u: Universe, sceneId: string | null): number | null {
  if (!sceneId) return null
  const order = manuscriptOrder(u)
  const at = order.findIndex((s) => s.id === sceneId)
  for (let i = at; i >= 0; i--) if (order[i].date) return order[i].date!.year
  return null
}

/** Os eventos que este causou (o caminho inverso de `causes`). */
export const effectsOf = (events: TimelineEvent[], id: string) => events.filter((e) => e.causes?.includes(id))
