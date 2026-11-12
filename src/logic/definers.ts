import { KIND_LABEL } from '../model/labels'
import { addList, addMembers, isPast, listsOf, membersOf, membershipsOf, removeMembership, updateList, type EntityList } from '../model/lists'
import type { Entity, Universe } from '../model/schema'
import { byId, draftEntity, insert, newId } from '../model/universe'
import { fold } from './text'

/*
 * "Quem é": o que define alguém neste mundo. Cada mundo escolhe os seus itens ("Espécie",
 * "Corpo", "Lua de nascimento", "Regime" para reinos) e as opções de cada um, que são fichas
 * ("Meio-ciborgue", "Lua cheia"). Cada opção diz o que passa para quem é assim; a ficha escolhe a
 * opção e herda. Uma ficha pode ser exceção: muda ou tira algo que herdaria.
 *
 * Por baixo, é o "o que todos têm" das listas: a opção ganha uma lista marcada com o item, e
 * escolher é entrar nela. Assim a herança, o grafo e os bônus "No jogo" já funcionam.
 */

export type Definer = NonNullable<Universe['settings']['definers']>[number]

export const definersOf = (u: Universe): Definer[] => u.settings.definers ?? []

/** Os itens que definem uma ficha deste tipo. */
export const definersFor = (u: Universe, kind: string): Definer[] => definersOf(u).filter((d) => d.appliesTo.includes(kind))

/** Os tipos que são opções de algum item (Espécie, Corpo…): ganham "O que passa" e "No jogo". */
export const optionKinds = (u: Universe): string[] => [...new Set(definersOf(u).map((d) => d.kind))]

/** O tipo das opções a partir do nome: "Espécie" usa o tipo de sempre; "Corpo" vira um tipo próprio. */
export function kindForName(name: string): string {
  const clean = name.trim()
  const known = Object.entries(KIND_LABEL).find(([, label]) => fold(label) === fold(clean))
  return known ? known[0] : clean
}

/** As opções de um item: as fichas do tipo dele. */
export const optionsOf = (u: Universe, d: Definer): Entity[] =>
  u.entities.filter((e) => e.kind === d.kind).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

/** A lista da opção para este item (a "Quem é desta espécie" de antes também vale para Espécie). */
export function definerListOf(option: Entity | undefined, d: Definer): EntityList | undefined {
  const lists = listsOf(option)
  return lists.find((l) => l.definer === d.id) ?? (d.kind === 'especie' ? lists.find((l) => !l.definer && fold(l.name) === fold('Quem é desta espécie')) : undefined)
}

/** A opção escolhida por uma ficha neste item (a ligação de lista que a faz ser assim). */
export function chosenOf(u: Universe, entityId: string, d: Definer): { option: Entity; relationId: string } | null {
  for (const m of membershipsOf(u, entityId)) {
    if (isPast(m.relation) || m.owner.kind !== d.kind) continue
    if (definerListOf(m.owner, d)?.id === m.list.id) return { option: m.owner, relationId: m.relation.id }
  }
  return null
}

/** Garante a lista da opção para este item e devolve o id dela. */
function ensureList(u: Universe, optionId: string, d: Definer): [Universe, string] {
  const option = byId(u, 'entities', optionId)
  const found = definerListOf(option, d)
  if (found) return [u, found.id]
  const [next, list] = addList(u, optionId, `Quem é ${option?.name || 'assim'}`, d.appliesTo)
  return [updateList(next, optionId, list.id, { definer: d.id }), list.id]
}

/** Escolhe (ou tira, com `null`) a opção de uma ficha neste item. */
export function choose(u: Universe, entityId: string, d: Definer, optionId: string | null): Universe {
  const current = chosenOf(u, entityId, d)
  let next = current ? removeMembership(u, current.relationId) : u
  if (!optionId) return next
  let listId: string
  ;[next, listId] = ensureList(next, optionId, d)
  return addMembers(next, optionId, listId, [entityId])
}

/** Quantas fichas são assim agora. */
export function membersCount(u: Universe, option: Entity, d: Definer): number {
  const l = definerListOf(option, d)
  return l ? membersOf(u, option.id, l.id).filter((m) => !isPast(m.relation)).length : 0
}

/** As chaves que vêm do "Quem é" desta ficha (as exceções delas são editadas lá, não em Campos). */
export function whoIsKeys(u: Universe, e: Entity): Set<string> {
  return new Set(whoIs(u, e).flatMap((r) => r.traits.map((t) => fold(t.key.trim()))))
}

/** O que a opção passa para quem é assim. */
export const passesOf = (option: Entity | undefined, d: Definer) => definerListOf(option, d)?.shared ?? []

/** Muda o que a opção passa (cria a lista dela se ainda não tem). */
export function setPasses(u: Universe, optionId: string, d: Definer, shared: { key: string; value: string }[]): Universe {
  const [next, listId] = ensureList(u, optionId, d)
  return updateList(next, optionId, listId, { shared })
}

/** Uma linha herdada, com a exceção da ficha, se houver. */
export interface Trait {
  key: string
  value: string
  /** A ficha muda isso: o valor dela (vazio = não tem). */
  exception: string | null
}

/** O que uma ficha é em cada item que a define, e o que herda de cada opção (com as exceções). */
export function whoIs(u: Universe, e: Entity): { definer: Definer; option: Entity | null; traits: Trait[] }[] {
  const own = new Map(e.fields.filter((f) => f.key.trim()).map((f) => [fold(f.key.trim()), f]))
  return definersFor(u, e.kind).map((definer) => {
    const option = chosenOf(u, e.id, definer)?.option ?? null
    const traits = passesOf(option ?? undefined, definer)
      .filter((p) => p.key.trim())
      .map((p) => {
        const mine = own.get(fold(p.key.trim()))
        return { key: p.key, value: p.value, exception: mine ? mine.value : null }
      })
    return { definer, option, traits }
  })
}

/** Os ids das listas de "Quem é" (para não repetir a herança delas em "Campos"). */
export function definerListIds(u: Universe): Set<string> {
  const ids = new Set<string>()
  for (const d of definersOf(u)) for (const o of optionsOf(u, d)) {
    const l = definerListOf(o, d)
    if (l) ids.add(l.id)
  }
  return ids
}

/** Abre uma exceção: a ficha passa a ter o campo, com o valor que quiser (começa vazio). */
export function addException(e: Entity, key: string, value = ''): Entity['fields'] {
  const k = fold(key.trim())
  if (e.fields.some((f) => fold(f.key.trim()) === k)) return e.fields.map((f) => (fold(f.key.trim()) === k ? { ...f, exception: true } : f))
  return [...e.fields, { key, value, exception: true }]
}

/** Desfaz a exceção: volta a valer o que a opção passa. */
export const removeException = (e: Entity, key: string): Entity['fields'] => e.fields.filter((f) => fold(f.key.trim()) !== fold(key.trim()))

/** Cria um item ("Corpo", para personagens). As opções serão fichas do tipo com esse nome. */
export function addDefiner(u: Universe, name: string, appliesTo: string[]): [Universe, Definer] {
  const d: Definer = { id: newId(), name: name.trim(), kind: kindForName(name), appliesTo }
  return [{ ...u, settings: { ...u.settings, definers: [...definersOf(u), d] } }, d]
}

export function updateDefiner(u: Universe, id: string, changes: Partial<Omit<Definer, 'id' | 'kind'>>): Universe {
  return { ...u, settings: { ...u.settings, definers: definersOf(u).map((d) => (d.id === id ? { ...d, ...changes } : d)) } }
}

/** Tira o item. As opções e quem estava nelas ficam (como fichas e listas comuns). */
export function removeDefiner(u: Universe, id: string): Universe {
  const rest = definersOf(u).filter((d) => d.id !== id)
  return { ...u, settings: { ...u.settings, definers: rest.length ? rest : undefined } }
}

/** Cria uma opção nova (uma ficha do tipo do item) e devolve o id. */
export function addOption(u: Universe, d: Definer, name: string): [Universe, string] {
  const [next, e] = insert(u, 'entities', draftEntity(d.kind, name.trim()))
  return [next, e.id]
}
