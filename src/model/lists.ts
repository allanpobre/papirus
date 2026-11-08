import { fold } from '../logic/text'
import type { Entity, Relation, Universe } from './schema'
import { byId, draftRelation, insert, newId, patch, remove } from './universe'

/**
 * Listas: qualquer ficha junta outras com o nome que a pessoa quiser ("Raças", "Criaturas",
 * "Membros", "Fiéis"). Quem entra numa lista vira uma ligação "faz parte de" com o id da lista,
 * e recebe o que a lista diz que todos têm ("Todos têm: Idioma · ostriano").
 */
export interface EntityList {
  id: string
  name: string
  /** Que tipos de ficha entram (vazio: qualquer um). */
  accepts: string[]
  /** O que todos da lista têm: passa para a ficha de cada um. */
  shared: { key: string; value: string }[]
}

export const MEMBER_TYPE = 'faz parte de'

/** Lugares continuam com "Fica dentro de" (cidade no reino); o resto usa listas. */
export const PLACE_KINDS = ['lugar', 'reino']

/** As listas que cada tipo já traz (a pessoa pode mudar em Ajustes › Universo). */
export const DEFAULT_LIST_TEMPLATES: Record<string, string[]> = {
  reino: ['Raças', 'Criaturas', 'Habitantes'],
  lugar: ['Habitantes'],
  faccao: ['Membros'],
  especie: ['Quem é desta espécie', 'Subespécies'],
  religiao: ['Fiéis'],
  cultura: ['Povo'],
  magia: ['Quem usa'],
}

/** O que cada lista sugerida aceita, quando dá para saber. */
const DEFAULT_ACCEPTS: Record<string, string[]> = {
  Raças: ['especie'],
  Criaturas: ['especie'],
  Subespécies: ['especie'],
  Habitantes: ['personagem'],
  Membros: ['personagem'],
  Fiéis: ['personagem'],
  'Quem é desta espécie': ['personagem'],
}

export const listsOf = (e: Entity | undefined): EntityList[] => e?.lists ?? []

export const listTemplatesFor = (u: Universe, kind: string): string[] => u.settings.listTemplates?.[kind] ?? DEFAULT_LIST_TEMPLATES[kind] ?? []

export const isMembership = (r: Relation) => Boolean(r.listId)

/** Ex-membro: a ligação tem um fim ("até 340"). */
export const isPast = (r: Relation) => r.scope.kind === 'periodo' && r.scope.toYear !== null

/** Cria uma lista na ficha. */
export function addList(u: Universe, ownerId: string, name: string, accepts?: string[]): [Universe, EntityList] {
  const list: EntityList = { id: newId(), name: name.trim() || 'Lista', accepts: accepts ?? DEFAULT_ACCEPTS[name.trim()] ?? [], shared: [] }
  const owner = byId(u, 'entities', ownerId)
  if (!owner) return [u, list]
  return [patch(u, 'entities', ownerId, { lists: [...listsOf(owner), list] }), list]
}

export function updateList(u: Universe, ownerId: string, listId: string, changes: Partial<Omit<EntityList, 'id'>>): Universe {
  const owner = byId(u, 'entities', ownerId)
  if (!owner) return u
  return patch(u, 'entities', ownerId, { lists: listsOf(owner).map((l) => (l.id === listId ? { ...l, ...changes } : l)) })
}

/** Tira a lista; quem estava nela deixa de fazer parte (as fichas ficam). */
export function removeList(u: Universe, ownerId: string, listId: string): Universe {
  const owner = byId(u, 'entities', ownerId)
  if (!owner) return u
  const next = patch(u, 'entities', ownerId, { lists: listsOf(owner).filter((l) => l.id !== listId) })
  return { ...next, relations: next.relations.filter((r) => !(r.toId === ownerId && r.listId === listId)) }
}

/** Quem está numa lista, na ordem em que entrou; os ex-membros por último. */
export function membersOf(u: Universe, ownerId: string, listId: string): { relation: Relation; member: Entity }[] {
  return u.relations
    .filter((r) => r.toId === ownerId && r.listId === listId)
    .flatMap((r) => {
      const member = byId(u, 'entities', r.fromId)
      return member ? [{ relation: r, member }] : []
    })
    .sort((a, b) => Number(isPast(a.relation)) - Number(isPast(b.relation)))
}

/** De que listas uma ficha faz parte. */
export function membershipsOf(u: Universe, entityId: string): { relation: Relation; owner: Entity; list: EntityList }[] {
  return u.relations
    .filter((r) => r.fromId === entityId && r.listId)
    .flatMap((r) => {
      const owner = byId(u, 'entities', r.toId)
      const list = listsOf(owner).find((l) => l.id === r.listId)
      return owner && list ? [{ relation: r, owner, list }] : []
    })
}

/** Põe várias fichas numa lista de uma vez (quem já está não entra de novo). */
export function addMembers(u: Universe, ownerId: string, listId: string, memberIds: string[], opts: { role?: string; fromYear?: number | null } = {}): Universe {
  const already = new Set(u.relations.filter((r) => r.toId === ownerId && r.listId === listId).map((r) => r.fromId))
  const role = opts.role?.trim() ?? ''
  const scope = opts.fromYear != null ? { kind: 'periodo' as const, fromYear: opts.fromYear, toYear: null, storyIds: [], sceneIds: [] } : undefined
  return [...new Set(memberIds)]
    .filter((id) => id !== ownerId && !already.has(id))
    .reduce((acc, id) => insert(acc, 'relations', { ...draftRelation(id, ownerId, MEMBER_TYPE), listId, ...(role ? { role } : {}), ...(scope ? { scope } : {}) })[0], u)
}

export function setRole(u: Universe, relationId: string, role: string): Universe {
  return patch(u, 'relations', relationId, { role: role.trim() })
}

/** "Saiu no ano 340": vira ex-membro (sem ano, volta a ser membro). */
export function endMembership(u: Universe, relationId: string, toYear: number | null): Universe {
  const r = byId(u, 'relations', relationId)
  if (!r) return u
  const scope = toYear === null ? (r.scope.fromYear === null ? { ...r.scope, kind: 'geral' as const, toYear: null } : { ...r.scope, toYear: null }) : { ...r.scope, kind: 'periodo' as const, toYear }
  return patch(u, 'relations', relationId, { scope })
}

export const removeMembership = (u: Universe, relationId: string): Universe => remove(u, 'relations', relationId)

/** Uma linha que algo passa adiante, com de onde veio ("de Elfo", "de Ostria, pelo Clã do Corvo"). */
export interface Inherited {
  key: string
  value: string
  /** A ficha dona da lista que diz "todos têm". */
  ownerId: string
  listId: string
  /** O caminho até aqui, quando veio de uma lista dentro de outra. */
  via: string[]
}

/**
 * O que uma ficha recebe das listas em que está: o "todos têm" de cada lista e, se a dona da
 * lista também está em outras listas, o que ela recebe (lista dentro de lista). Ex-membros não
 * recebem. Linhas iguais aparecem uma vez; a primeira que chega vale (as diretas antes das que
 * vêm de longe).
 */
export function inheritedFields(u: Universe, entityId: string): Inherited[] {
  const out: Inherited[] = []
  const seenKey = new Set<string>()
  const visited = new Set<string>([entityId])
  let frontier: { id: string; via: string[] }[] = [{ id: entityId, via: [] }]
  while (frontier.length) {
    const next: { id: string; via: string[] }[] = []
    for (const { id, via } of frontier) {
      for (const m of membershipsOf(u, id)) {
        if (isPast(m.relation)) continue
        for (const s of m.list.shared) {
          if (!s.key.trim()) continue
          const k = fold(s.key.trim())
          if (seenKey.has(k)) continue
          seenKey.add(k)
          out.push({ key: s.key, value: s.value, ownerId: m.owner.id, listId: m.list.id, via })
        }
        if (!visited.has(m.owner.id)) {
          visited.add(m.owner.id)
          next.push({ id: m.owner.id, via: [...via, m.owner.id] })
        }
      }
    }
    frontier = next
  }
  return out
}

/** Quando duas listas diretas dizem coisas diferentes sobre o mesmo campo. */
export function inheritedConflicts(u: Universe, entityId: string): { key: string; owners: string[] }[] {
  const byKey = new Map<string, { key: string; values: Set<string>; owners: string[] }>()
  for (const m of membershipsOf(u, entityId)) {
    if (isPast(m.relation)) continue
    for (const s of m.list.shared) {
      if (!s.key.trim()) continue
      const k = fold(s.key.trim())
      const cur = byKey.get(k) ?? { key: s.key, values: new Set<string>(), owners: [] }
      cur.values.add(fold(s.value.trim()))
      if (!cur.owners.includes(m.owner.id)) cur.owners.push(m.owner.id)
      byKey.set(k, cur)
    }
  }
  return [...byKey.values()].filter((c) => c.values.size > 1).map((c) => ({ key: c.key, owners: c.owners }))
}

/**
 * "Fica dentro de" fica só para lugares. Quem não é lugar e estava "dentro de" outra ficha passa
 * para uma lista dela (Membros numa facção, Habitantes num lugar), sem perder nada.
 */
export function migrateParents(u: Universe): Universe {
  const moving = u.entities.filter((e) => e.parentId && !PLACE_KINDS.includes(e.kind))
  if (!moving.length) return u
  let next = u
  for (const e of moving) {
    const owner = byId(next, 'entities', e.parentId!)
    if (!owner) {
      next = patch(next, 'entities', e.id, { parentId: null })
      continue
    }
    const name = PLACE_KINDS.includes(owner.kind) ? 'Habitantes' : 'Membros'
    let list = listsOf(owner).find((l) => fold(l.name) === fold(name))
    if (!list) [next, list] = addList(next, owner.id, name, [])
    next = addMembers(next, owner.id, list.id, [e.id])
    next = patch(next, 'entities', e.id, { parentId: null })
  }
  return next
}

/** Ações em várias fichas de uma vez (a seleção do Mundo). */
export function addTagToMany(u: Universe, ids: string[], tag: string): Universe {
  const t = tag.trim()
  if (!t) return u
  return ids.reduce((acc, id) => {
    const e = byId(acc, 'entities', id)
    return e && !e.tags.some((x) => fold(x) === fold(t)) ? patch(acc, 'entities', id, { tags: [...e.tags, t] }) : acc
  }, u)
}

export function setKindOfMany(u: Universe, ids: string[], kind: string): Universe {
  return ids.reduce((acc, id) => patch(acc, 'entities', id, { kind }), u)
}
