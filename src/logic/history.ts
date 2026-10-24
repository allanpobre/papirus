import type { CollectionKey, HistoryEntry, TrashItem, Universe } from '../model/schema'
import { newId } from '../model/universe'

/**
 * Lixeira e histórico. Não dependem de cada tela: comparam o universo antes e depois
 * de cada mudança feita aqui. Assim nada apagado some de vez (30 dias na lixeira) e
 * dá para ver quem mudou o quê, e voltar atrás.
 */
export const TRACKED: CollectionKey[] = ['stories', 'scenes', 'entities', 'groups', 'sessions', 'maps', 'seeds', 'events', 'facts', 'relations', 'knowledge', 'revelations', 'systems', 'sheets', 'tables', 'inbox', 'books']

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
  groups: 'a mesa',
  sessions: 'a sessão',
  maps: 'o mapa',
  seeds: 'a trama',
  events: 'o evento',
  facts: 'o fato',
  relations: 'a relação',
  knowledge: 'o conhecimento',
  revelations: 'a revelação',
  systems: 'o sistema',
  sheets: 'a ficha de jogo',
  tables: 'a tabela',
  inbox: 'a ideia',
  books: 'o livro',
}

const PLURAL: Record<string, [string, string]> = {
  stories: ['história', 'histórias'],
  scenes: ['cena', 'cenas'],
  entities: ['ficha', 'fichas'],
  facts: ['fato', 'fatos'],
  relations: ['relação', 'relações'],
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
    const item: TrashItem = { id: newId(), kind: main, label, records: removed as TrashItem['records'], deletedAt: at, by }
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

/** Devolve ao universo o que estava na lixeira (sem duplicar o que já voltou). */
export function restoreTrash(u: Universe, trashId: string, by: string | null): Universe {
  const item = u.trash.find((t) => t.id === trashId)
  if (!item) return u
  const at = new Date().toISOString()
  const next: Record<string, unknown> = { ...u }
  for (const [k, records] of Object.entries(item.records)) {
    if (!TRACKED.includes(k as CollectionKey)) continue
    const current = list(u, k as CollectionKey)
    const have = new Set(current.map((x) => x.id))
    next[k] = [...current, ...records.filter((r) => !have.has(r.id))]
  }
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
