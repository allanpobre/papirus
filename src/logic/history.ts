import type { CollectionKey, HistoryEntry, TrashItem, TrashRef, Universe } from '../model/schema'
import { newId } from '../model/universe'

/**
 * Lixeira e histórico. Não dependem de cada tela: comparam o universo antes e depois
 * de cada mudança feita aqui. Assim nada apagado some de vez (30 dias na lixeira) e
 * dá para ver quem mudou o quê, e voltar atrás.
 */
export const TRACKED: CollectionKey[] = ['stories', 'scenes', 'entities', 'groups', 'sessions', 'maps', 'seeds', 'events', 'facts', 'relations', 'knowledge', 'revelations', 'systems', 'sheets', 'tables', 'monsters', 'inbox', 'books']

export const TRASH_DAYS = 30
const HISTORY_MAX = 150
/** Só as entradas mais recentes guardam a versão anterior (para o universo não pesar). */
const HISTORY_WITH_BEFORE = 40
/** Edições seguidas no mesmo item, pela mesma pessoa, viram uma linha só. */
const COALESCE_MS = 15 * 60 * 1000

export const KIND_NAME: Record<string, string> = {
  stories: 'a história',
  scenes: 'a cena',
  entities: 'a ficha',
  groups: 'o grupo',
  sessions: 'a sessão',
  maps: 'o mapa',
  seeds: 'a trama',
  events: 'o evento',
  facts: 'o fato',
  relations: 'a ligação',
  knowledge: 'o conhecimento',
  revelations: 'a revelação',
  systems: 'o sistema',
  sheets: 'a ficha de jogo',
  tables: 'a tabela',
  monsters: 'o inimigo',
  inbox: 'a ideia',
  books: 'o livro',
}

const PLURAL: Record<string, [string, string]> = {
  stories: ['história', 'histórias'],
  scenes: ['cena', 'cenas'],
  entities: ['ficha', 'fichas'],
  facts: ['fato', 'fatos'],
  relations: ['ligação', 'ligações'],
  events: ['evento', 'eventos'],
  knowledge: ['conhecimento', 'conhecimentos'],
  revelations: ['revelação', 'revelações'],
  sessions: ['sessão', 'sessões'],
  sheets: ['ficha de jogo', 'fichas de jogo'],
}

type Item = { id: string } & Record<string, unknown>

export function recordLabel(_kind: string, r: Record<string, unknown>): string {
  const text =
    (typeof r.name === 'string' && r.name) ||
    (typeof r.title === 'string' && r.title) ||
    (typeof r.text === 'string' && r.text) ||
    (typeof r.type === 'string' && r.type) ||
    (typeof r.predicate === 'string' && [r.predicate, r.value].filter(Boolean).join(' ')) ||
    ''
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean ? (clean.length > 60 ? `${clean.slice(0, 57)}…` : clean) : 'Sem título'
}

const list = (u: Universe, k: CollectionKey) => u[k] as unknown as Item[]

/** Acompanha uma mudança feita aqui: o que sumiu vai para a lixeira, o resto para o histórico. */
export function track(before: Universe, after: Universe, by: string | null, now = new Date()): Universe {
  // Mudanças que já cuidam do histórico (recuperar, voltar, desfazer) não são contadas de novo.
  if (before === after || before.history !== after.history || before.trash !== after.trash) return after
  const at = now.toISOString()
  const removed: Record<string, Item[]> = {}
  const created: [CollectionKey, Item][] = []
  const edited: [CollectionKey, Item, Item][] = []

  for (const k of TRACKED) {
    const a = list(before, k)
    const b = list(after, k)
    if (a === b) continue
    const old = new Map(a.map((x) => [x.id, x]))
    const ids = new Set<string>()
    for (const x of b) {
      ids.add(x.id)
      const prev = old.get(x.id)
      if (!prev) created.push([k, x])
      else if (prev !== x) edited.push([k, x, prev])
    }
    if (b.length - created.length < a.length) {
      const gone = a.filter((x) => !ids.has(x.id))
      if (gone.length) removed[k] = gone
    }
  }

  if (!created.length && !edited.length && !Object.keys(removed).length) return after

  let trash = after.trash
  let history = after.history
  const removedKinds = TRACKED.filter((k) => removed[k])
  if (removedKinds.length) {
    const main = removedKinds[0]
    const first = removed[main][0]
    const extra = removedKinds.flatMap((k) => {
      const n = removed[k].length - (k === main ? 1 : 0)
      if (!n) return []
      const [one, many] = PLURAL[k] ?? ['item', 'itens']
      return [`${n} ${n === 1 ? one : many}`]
    })
    const label = `${recordLabel(main, first)}${extra.length ? ` (e ${extra.join(', ')})` : ''}`
    // O que mudou nos outros registros só por causa da exclusão, e onde cada item estava: para voltar como era.
    const refs = refChanges(edited)
    const index: Record<string, number[]> = {}
    for (const k of removedKinds) {
      const where = new Map(list(before, k).map((x, i) => [x.id, i]))
      index[k] = removed[k].map((x) => where.get(x.id) ?? 0)
    }
    const item: TrashItem = { id: newId(), kind: main, label, records: removed as TrashItem['records'], deletedAt: at, by, ...(refs.length ? { refs } : {}), index }
    trash = [item, ...trash]
    history = [entry('apagou', main, first.id, recordLabel(main, first), at, by, null), ...history]
  }

  // Ao apagar, as outras fichas e cenas mudam só para tirar as referências: não é edição de ninguém.
  if (removedKinds.length) return { ...after, trash, history: trimHistory(history) }

  for (const [k, x] of created) {
    history = [entry('criou', k, x.id, recordLabel(k, x), at, by, null), ...history]
  }

  for (const [k, x, prev] of edited) {
    const last = history.find((h) => h.recordId === x.id)
    const label = recordLabel(k, x)
    if (last && last.by === by && (last.action === 'editou' || last.action === 'criou') && Date.parse(at) - Date.parse(last.at) < COALESCE_MS) {
      history = history.map((h) => (h === last ? { ...h, at, label } : h))
      continue
    }
    history = [entry('editou', k, x.id, label, at, by, prev), ...history]
  }

  return { ...after, trash, history: trimHistory(history) }
}

function entry(action: HistoryEntry['action'], kind: string, recordId: string, label: string, at: string, by: string | null, before: Item | null): HistoryEntry {
  return { id: newId(), action, kind, recordId, label, at, since: at, by, before }
}

function trimHistory(history: HistoryEntry[]): HistoryEntry[] {
  return history.slice(0, HISTORY_MAX).map((h, i) => (i >= HISTORY_WITH_BEFORE && h.before ? { ...h, before: null } : h))
}

/** Tira da lixeira o que passou de 30 dias. */
export function purgeTrash(u: Universe, now = Date.now()): Universe {
  const keep = u.trash.filter((t) => now - Date.parse(t.deletedAt) < TRASH_DAYS * 86400000)
  return keep.length === u.trash.length ? u : { ...u, trash: keep }
}

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b)

/** O que mudou, campo a campo, em cada registro que continuou existindo (menos a data de mexida). */
function refChanges(edited: [CollectionKey, Item, Item][]): TrashRef[] {
  const out: TrashRef[] = []
  for (const [kind, now, prev] of edited) {
    const changes: TrashRef['changes'] = {}
    for (const key of Object.keys(prev)) {
      if (key === 'updatedAt' || now[key] === prev[key] || same(now[key], prev[key])) continue
      changes[key] = { before: prev[key], after: now[key] }
    }
    if (Object.keys(changes).length) out.push({ kind, id: now.id, changes })
  }
  return out
}

/**
 * Põe de volta as referências que a exclusão tirou. Só desfaz o que ainda está como a exclusão deixou: se a pessoa
 * mexeu depois, o que ela fez fica; nas listas (quem estava na cena, por exemplo), só soma de volta o que faltar.
 */
function applyRefs(next: Record<string, unknown>, refs: TrashRef[], at: string) {
  const byKind = new Map<string, TrashRef[]>()
  for (const r of refs) byKind.set(r.kind, [...(byKind.get(r.kind) ?? []), r])
  for (const [kind, of] of byKind) {
    const current = next[kind]
    if (!Array.isArray(current)) continue
    const changesOf = new Map(of.map((r) => [r.id, r.changes]))
    next[kind] = (current as Item[]).map((rec) => {
      const changes = changesOf.get(rec.id)
      if (!changes) return rec
      const patch: Record<string, unknown> = {}
      for (const [key, { before, after }] of Object.entries(changes)) {
        const cur = rec[key]
        if (same(cur, after)) patch[key] = before
        else if (Array.isArray(before) && Array.isArray(after) && Array.isArray(cur)) {
          const lost = before.filter((x) => !after.some((y) => same(x, y)))
          const add = lost.filter((x) => !cur.some((y) => same(x, y)))
          if (add.length) patch[key] = [...cur, ...add]
        }
      }
      return Object.keys(patch).length ? { ...rec, ...patch, ...('updatedAt' in rec ? { updatedAt: at } : {}) } : rec
    })
  }
}

/**
 * Devolve ao universo o que estava na lixeira (sem duplicar o que já voltou), com as referências que a exclusão
 * tirou (cenas de volta no livro, ficha de volta nas cenas e no mapa…). Uma cena cujo livro também está na
 * lixeira traz o livro junto; se o livro foi apagado de vez, a cena volta solta, e não some.
 */
export function restoreTrash(u: Universe, trashId: string, by: string | null): Universe {
  const item = u.trash.find((t) => t.id === trashId)
  if (!item) return u
  const stories = new Set<string>(item.records.scenes?.flatMap((s) => (typeof s.storyId === 'string' ? [s.storyId] : [])) ?? [])
  for (const storyId of stories) {
    if (u.stories.some((s) => s.id === storyId)) continue
    const holder = u.trash.find((t) => t.id !== trashId && t.records.stories?.some((s) => s.id === storyId))
    if (holder) u = restoreTrash(u, holder.id, by)
  }
  const at = new Date().toISOString()
  const next: Record<string, unknown> = { ...u }
  for (const [k, records] of Object.entries(item.records)) {
    if (!TRACKED.includes(k as CollectionKey)) continue
    const merged = [...list(u, k as CollectionKey)]
    const have = new Set(merged.map((x) => x.id))
    const where = item.index?.[k]
    // Do primeiro para o último, cada um no lugar onde estava (ou no fim, se a lista encolheu).
    records
      .map((r, i) => [r, where?.[i] ?? merged.length] as const)
      .filter(([r]) => !have.has(r.id))
      .sort((a, b) => a[1] - b[1])
      .forEach(([r, i]) => merged.splice(Math.min(i, merged.length), 0, r as Item))
    next[k] = merged
  }
  if (item.refs?.length) applyRefs(next, item.refs, at)
  // Cena cujo livro não existe mais (foi apagado de vez): vira cena solta em vez de sumir da tela.
  const have = new Set((next.stories as Item[]).map((s) => s.id))
  const restoredScenes = new Set((item.records.scenes ?? []).map((s) => s.id))
  let order = Math.max(-1, ...(next.scenes as Item[]).filter((s) => s.storyId === null).map((s) => Number(s.order))) + 1
  next.scenes = (next.scenes as Item[]).map((s) => (restoredScenes.has(s.id) && typeof s.storyId === 'string' && !have.has(s.storyId) ? { ...s, storyId: null, order: order++, updatedAt: at } : s))
  const first = item.records[item.kind]?.[0]
  return {
    ...(next as Universe),
    trash: u.trash.filter((t) => t.id !== trashId),
    history: trimHistory([entry('recuperou', item.kind, first?.id ?? '', item.label, at, by, null), ...u.history]),
    updatedAt: at,
  }
}

export function removeFromTrash(u: Universe, trashId: string | 'tudo'): Universe {
  return { ...u, trash: trashId === 'tudo' ? [] : u.trash.filter((t) => t.id !== trashId), updatedAt: new Date().toISOString() }
}

/** Volta um item para como estava antes de uma edição do histórico. */
export function revertTo(u: Universe, historyId: string, by: string | null): Universe {
  const h = u.history.find((x) => x.id === historyId)
  if (!h?.before || !TRACKED.includes(h.kind as CollectionKey)) return u
  const current = list(u, h.kind as CollectionKey)
  const exists = current.some((x) => x.id === h.recordId)
  const at = new Date().toISOString()
  const restored = { ...h.before, updatedAt: at }
  return {
    ...u,
    [h.kind]: exists ? current.map((x) => (x.id === h.recordId ? restored : x)) : [...current, restored],
    history: trimHistory([entry('voltou', h.kind, h.recordId, recordLabel(h.kind, h.before), at, by, current.find((x) => x.id === h.recordId) ?? null), ...u.history]),
    updatedAt: at,
  }
}

const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export function timeAgo(iso: string, now = Date.now()): string {
  const min = Math.round((now - Date.parse(iso)) / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `há ${h} h`
  return dateFmt.format(new Date(iso))
}
