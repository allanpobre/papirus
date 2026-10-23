import { kindLabel } from '../model/labels'
import type { Universe } from '../model/schema'
import { factSentence } from './codex'
import { fold, snippet } from './text'

export type SearchKind = 'ficha' | 'cena' | 'evento' | 'fato' | 'semente' | 'sessao' | 'historia'

export interface SearchResult {
  kind: SearchKind
  id: string
  title: string
  detail: string
  score: number
}

/** Busca simples em todo o universo, sem acentos e sem diferenciar maiúsculas. */
export function searchUniverse(universe: Universe, query: string, limit = 30): SearchResult[] {
  const q = fold(query.trim())
  if (!q) return []
  const results: SearchResult[] = []

  const score = (title: string, ...rest: string[]) => {
    const t = fold(title)
    if (t === q) return 100
    if (t.startsWith(q)) return 80
    if (t.includes(q)) return 60
    return rest.some((r) => fold(r).includes(q)) ? 30 : 0
  }

  for (const e of universe.entities) {
    const s = Math.max(score(e.name), ...e.aliases.map((a) => score(a) - 5), score('', e.summary, e.description, e.tags.join(' ')))
    if (s > 0) results.push({ kind: 'ficha', id: e.id, title: e.name || 'Sem nome', detail: kindLabel(e.kind) + (e.summary ? ` · ${e.summary}` : ''), score: s + 15 })
  }
  for (const st of universe.stories) {
    const s = score(st.title, st.synopsis)
    if (s > 0) results.push({ kind: 'historia', id: st.id, title: st.title || 'Sem título', detail: 'História', score: s })
  }
  for (const sc of universe.scenes) {
    const s = score(sc.title, sc.synopsis, sc.text)
    if (s === 0) continue
    const i = fold(sc.text).indexOf(q)
    results.push({
      kind: 'cena',
      id: sc.id,
      title: sc.title || 'Sem título',
      detail: i >= 0 ? snippet(sc.text, i, i + q.length, 40) : sc.synopsis || 'Cena',
      score: s,
    })
  }
  for (const ev of universe.events) {
    const s = score(ev.title, ev.description)
    if (s > 0) results.push({ kind: 'evento', id: ev.id, title: ev.title, detail: `Ano ${ev.year}`, score: s })
  }
  for (const f of universe.facts) {
    const sentence = factSentence(universe, f)
    const s = score(sentence, f.quote, f.note)
    if (s > 0) results.push({ kind: 'fato', id: f.id, title: sentence, detail: f.quote ? `“${f.quote}”` : 'Fato', score: s - 10 })
  }
  for (const sd of universe.seeds) {
    const s = score(sd.title, sd.description)
    if (s > 0) results.push({ kind: 'semente', id: sd.id, title: sd.title, detail: sd.kind === 'misterio' ? 'Mistério' : 'Semente', score: s })
  }
  for (const se of universe.sessions) {
    const s = score(se.title, se.prep, se.log.map((l) => l.text).join(' '))
    if (s > 0) results.push({ kind: 'sessao', id: se.id, title: se.title, detail: `Sessão ${se.number}`, score: s })
  }

  return results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'pt')).slice(0, limit)
}
