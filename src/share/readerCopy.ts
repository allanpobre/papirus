import { stripSecrets } from '../logic/secrets'
import type { Universe } from '../model/schema'

const MARK = /\[segredo\]/i

/** Tira os trechos [segredo] de todo texto livre, em qualquer profundidade. */
function stripDeep<T>(value: T): T {
  if (typeof value === 'string') return (MARK.test(value) ? stripSecrets(value) : value) as T
  if (Array.isArray(value)) return value.map(stripDeep) as T
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stripDeep(v)])) as T
  return value
}

/**
 * O universo como quem só pode ver o recebe. É isto que vai para a cópia de leitura
 * no servidor: o resto nunca sai do Papirus de quem edita.
 * - sempre fora: a Inbox (ideias soltas do autor) e as chaves do Codex ao vivo;
 * - sem `showSecrets`: fichas, relações, eventos e fatos secretos, e os trechos [segredo].
 */
export function readerCopy(universe: Universe, showSecrets: boolean): Universe {
  const base: Universe = {
    ...universe,
    inbox: [],
    groups: universe.groups.map((g) => ({ ...g, share: null })),
  }
  if (showSecrets) return base

  const hidden = new Set(universe.entities.filter((e) => e.canon === 'secreto').map((e) => e.id))
  const gone = (id: string | null) => id !== null && hidden.has(id)
  const facts = base.facts.filter((f) => f.canon !== 'secreto' && !gone(f.subjectId) && !gone(f.objectId) && !gone(f.speakerId))
  const factIds = new Set(facts.map((f) => f.id))

  return stripDeep({
    ...base,
    entities: base.entities.filter((e) => !hidden.has(e.id)).map((e) => (gone(e.parentId) ? { ...e, parentId: null } : e)),
    relations: base.relations
      .filter((r) => r.canon !== 'secreto' && !gone(r.fromId) && !gone(r.toId))
      .map((r) => ({ ...r, via: r.via.filter((v) => !gone(v.entityId)) })),
    events: base.events
      .filter((e) => e.canon !== 'secreto')
      .map((e) => ({ ...e, placeId: gone(e.placeId) ? null : e.placeId, entityIds: e.entityIds.filter((id) => !gone(id)) })),
    revelations: base.revelations.filter((r) => !gone(r.targetId)),
    sheets: base.sheets.map((s) => (gone(s.entityId) ? { ...s, entityId: null } : s)),
    maps: base.maps.map((m) => ({ ...m, pins: m.pins.filter((p) => !gone(p.entityId)) })),
    facts,
    knowledge: base.knowledge.filter((k) => factIds.has(k.factId) && !gone(k.holderId)),
    scenes: base.scenes.map((s) => ({
      ...s,
      povId: gone(s.povId) ? null : s.povId,
      placeId: gone(s.placeId) ? null : s.placeId,
      presentIds: s.presentIds.filter((id) => !gone(id)),
    })),
    seeds: base.seeds.map((s) => ({ ...s, entityIds: s.entityIds.filter((id) => !gone(id)) })),
  })
}
