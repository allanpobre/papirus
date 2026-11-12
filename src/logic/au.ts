import type { Universe } from '../model/schema'
import { newId, now } from '../model/universe'
import { readerCopy } from '../share/readerCopy'

/*
 * Universo alternativo (AU): outra pessoa, com a permissão do autor, cria um universo a partir do
 * mundo dele. O AU recebe o mundo (fichas, ligações, datas, fatos e mapas) e as histórias, que
 * viram lore: dá para ler, não para mudar. Os segredos nunca vão. O autor original vê o que nasceu
 * no AU e escolhe o que vira canon.
 */

/** O que o AU acompanha do original. As histórias e as cenas são lore: só leitura. */
const TRACKED = ['entities', 'relations', 'events', 'facts', 'maps', 'stories', 'scenes'] as const
const LORE = ['stories', 'scenes'] as const
/** O que pode virar canon no original. */
const CANONIZABLE = ['entities', 'relations', 'events', 'facts'] as const

type Canonizable = (typeof CANONIZABLE)[number]
type Item = { id: string }
export type Origin = NonNullable<Universe['derivedFrom']>
export type OriginState = 'original' | 'mudou' | 'novo'

/** Texto estável de um objeto (chaves em ordem), sem as datas, que mudam sem o conteúdo mudar. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([k, v]) => v !== undefined && k !== 'updatedAt' && k !== 'createdAt')
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

/** Resumo curto do conteúdo de uma coisa (FNV-1a): igual se nada mudou. */
export function itemHash(item: unknown): string {
  const text = stable(item)
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

/** Resumo de um e-mail (SHA-256), para a lista de quem pode criar AU não mostrar os endereços. */
export async function emailHash(email: string): Promise<string> {
  const data = new TextEncoder().encode(email.trim().toLowerCase())
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Quem tem este e-mail pode criar um AU deste universo? */
export async function canCreateAU(universe: Universe, email: string | null | undefined): Promise<boolean> {
  const allowed = universe.settings.au?.allowed ?? []
  if (!email || !allowed.length) return false
  return allowed.includes(await emailHash(email))
}

/** Liga ou desliga a permissão de criar AU para um resumo de e-mail (veja `emailHash`). */
export function withAU(universe: Universe, hash: string, on: boolean): Universe {
  const allowed = new Set(universe.settings.au?.allowed ?? [])
  if (on) allowed.add(hash)
  else allowed.delete(hash)
  return { ...universe, settings: { ...universe.settings, au: allowed.size ? { allowed: [...allowed] } : undefined } }
}

/** Liga ou desliga a permissão de criar AU para um e-mail. */
export async function allowAU(universe: Universe, email: string, on: boolean): Promise<Universe> {
  return withAU(universe, await emailHash(email), on)
}

function hashes(u: Universe): Record<string, string> {
  const items: Record<string, string> = {}
  for (const key of TRACKED) for (const item of u[key] as Item[]) items[item.id] = itemHash(item)
  return items
}

/**
 * Cria o AU a partir da cópia do original. Os segredos saem sempre (mesmo que a cópia os tenha),
 * e fica de fora o que é só do autor: Ideias, lixeira, histórico, mesa, estante e a wiki.
 */
export function createAU(original: Universe, owner: { id: string; email: string }): Universe {
  const base = readerCopy(original, false)
  const t = now()
  const { wiki: _wiki, au: _au, ...settings } = base.settings
  return {
    ...base,
    id: newId(),
    name: `${original.name} (AU)`,
    groups: [],
    sessions: [],
    revelations: [],
    sheets: [],
    continuity: [],
    book: null,
    books: [],
    cloudCopyOf: null,
    versionKind: null,
    dailyStart: {},
    settings: { ...settings, deadline: null, nextNote: null, kind: undefined },
    derivedFrom: { ownerId: owner.id, ownerEmail: owner.email, universeId: original.id, name: original.name, at: t, items: hashes(base) },
    createdAt: t,
    updatedAt: t,
  }
}

/** De onde vem uma coisa do AU: igual ao original, mudada aqui, ou nascida aqui. Fora de um AU, nada. */
export function originState(universe: Universe, item: Item): OriginState | null {
  const from = universe.derivedFrom
  if (!from) return null
  const h = from.items[item.id]
  if (h === undefined) return 'novo'
  return itemHash(item) === h ? 'original' : 'mudou'
}

/** Cena ou história que veio do original: lore, só para ler. */
export function isLore(universe: Universe, id: string | null | undefined): boolean {
  const from = universe.derivedFrom
  if (!from || !id || from.items[id] === undefined) return false
  return universe.scenes.some((s) => s.id === id) || universe.stories.some((s) => s.id === id)
}

export interface PullResult {
  universe: Universe
  added: number
  updated: number
  /** Mudadas no AU: ficam como estão. */
  kept: number
  removed: number
}

/**
 * Traz as novidades do original. O que o AU não mexeu acompanha o original; o que o AU mudou fica
 * como está. A lore (histórias e cenas) sempre acompanha. O que o AU apagou não volta.
 */
export function pullOriginal(au: Universe, fresh: Universe): PullResult {
  const from = au.derivedFrom
  if (!from) return { universe: au, added: 0, updated: 0, kept: 0, removed: 0 }
  const source = readerCopy(fresh, false)
  const items = { ...from.items }
  const next = { ...au } as Universe
  let added = 0
  let updated = 0
  let kept = 0
  let removed = 0
  const alive = new Set<string>()
  for (const key of TRACKED) {
    const lore = (LORE as readonly string[]).includes(key)
    const mine = new Map((au[key] as Item[]).map((i) => [i.id, i]))
    const theirs = source[key] as Item[]
    const theirIds = new Set(theirs.map((i) => i.id))
    const out: Item[] = []
    // O que já existe no AU, na ordem do AU.
    for (const item of au[key] as Item[]) {
      const known = items[item.id]
      const fromThem = theirs.find((i) => i.id === item.id)
      if (known === undefined) {
        // Nascido aqui; se o autor canonizou, passa a ser do original.
        if (fromThem) items[item.id] = itemHash(fromThem)
        out.push(fromThem && itemHash(fromThem) === itemHash(item) ? fromThem : item)
        continue
      }
      const untouched = itemHash(item) === known
      if (!fromThem) {
        // O original tirou (ou virou segredo): some do AU, se o AU não mexeu.
        delete items[item.id]
        if (untouched || lore) removed++
        else out.push(item)
        continue
      }
      const h = itemHash(fromThem)
      if (untouched || lore) {
        if (h !== known) updated++
        items[item.id] = h
        out.push(fromThem)
      } else {
        if (h !== known) kept++
        out.push(item)
      }
    }
    // O que é novo no original (e o AU não apagou).
    for (const item of theirs) {
      if (mine.has(item.id)) continue
      if (items[item.id] !== undefined && !lore) continue
      items[item.id] = itemHash(item)
      out.push(item)
      added++
    }
    ;(next as unknown as Record<string, Item[]>)[key] = out
    for (const i of out) alive.add(i.id)
    for (const id of theirIds) alive.add(id)
  }
  // Resumos de coisas que não existem mais em nenhum dos dois lados.
  for (const id of Object.keys(items)) if (!alive.has(id)) delete items[id]
  next.derivedFrom = { ...from, items, ownerEmail: from.ownerEmail, name: fresh.name }
  return { universe: next, added, updated, kept, removed }
}

/** Uma coisa do AU que o autor original pode canonizar. */
export interface AUNews {
  key: Canonizable
  id: string
  state: 'novo' | 'mudou'
  label: string
}

const nameOf = (u: Universe, id: string | null | undefined) => (id ? (u.entities.find((e) => e.id === id)?.name ?? '?') : '?')

function labelOf(u: Universe, key: Canonizable, item: Item): string {
  if (key === 'entities') return (item as Universe['entities'][number]).name || 'Sem nome'
  if (key === 'events') return (item as Universe['events'][number]).title || 'Sem título'
  if (key === 'relations') {
    const r = item as Universe['relations'][number]
    return `${nameOf(u, r.fromId)} · ${r.type} · ${nameOf(u, r.toId)}`
  }
  const f = item as Universe['facts'][number]
  return [nameOf(u, f.subjectId), f.predicate, f.value || (f.objectId ? nameOf(u, f.objectId) : '')].filter(Boolean).join(' ')
}

/** O que nasceu ou mudou no AU e ainda não está igual no original. */
export function auNews(au: Universe, original: Universe): AUNews[] {
  if (!au.derivedFrom) return []
  const out: AUNews[] = []
  for (const key of CANONIZABLE) {
    const theirs = new Map((original[key] as Item[]).map((i) => [i.id, itemHash(i)]))
    for (const item of au[key] as Item[]) {
      const state = originState(au, item)
      if (state !== 'novo' && state !== 'mudou') continue
      if (theirs.get(item.id) === itemHash(item)) continue
      out.push({ key, id: item.id, state, label: labelOf(au, key, item) })
    }
  }
  return out
}

/** As fichas que uma coisa usa (para não canonizar uma ligação apontando para o nada). */
function entityRefs(key: Canonizable, item: Item): string[] {
  if (key === 'entities') return [(item as Universe['entities'][number]).parentId].filter((x): x is string => !!x)
  if (key === 'relations') {
    const r = item as Universe['relations'][number]
    return [r.fromId, r.toId, ...r.via.map((v) => v.entityId)]
  }
  if (key === 'events') {
    const e = item as Universe['events'][number]
    return [e.placeId, ...e.entityIds].filter((x): x is string => !!x)
  }
  const f = item as Universe['facts'][number]
  return [f.subjectId, f.objectId, f.speakerId].filter((x): x is string => !!x)
}

/**
 * Leva para o original o que o autor escolheu do AU. Se uma ligação, data ou fato usa uma ficha
 * que só existe no AU, ela vai junto. Devolve também o que foi junto.
 */
export function canonize(original: Universe, au: Universe, ids: string[]): { universe: Universe; extra: string[] } {
  const chosen = new Set(ids)
  const extra: string[] = []
  const known = new Set(original.entities.map((e) => e.id))
  const queue = [...chosen]
  while (queue.length) {
    const id = queue.pop()!
    for (const key of CANONIZABLE) {
      const item = (au[key] as Item[]).find((i) => i.id === id)
      if (!item) continue
      for (const ref of entityRefs(key, item)) {
        if (known.has(ref) || chosen.has(ref) || !au.entities.some((e) => e.id === ref)) continue
        chosen.add(ref)
        extra.push(ref)
        queue.push(ref)
      }
    }
  }
  const next = { ...original } as Universe
  const t = now()
  for (const key of CANONIZABLE) {
    const list = [...(original[key] as Item[])]
    for (const item of au[key] as Item[]) {
      if (!chosen.has(item.id)) continue
      const at = list.findIndex((i) => i.id === item.id)
      if (at >= 0) list[at] = item
      else list.push(item)
    }
    ;(next as unknown as Record<string, Item[]>)[key] = list
  }
  return { universe: { ...next, updatedAt: t }, extra }
}
