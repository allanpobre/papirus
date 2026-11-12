import type { Universe } from '../model/schema'
import type { View } from '../state/workspace'

/** Uma coisa que falta no mundo, com quantas e para onde ir resolver. */
export interface WorldGap {
  key: string
  count: number
  text: string
  hint: string
  view: View
  /** A primeira ficha (ou evento) que pede o olhar, para abrir direto nela. */
  id: string | null
  /** Só aparece no nível Completo. */
  full?: boolean
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * O que falta no mundo, do mais simples ao mais fino: fichas sem resumo, fichas soltas (sem
 * nenhuma ligação), lugares fora do mapa, personagens sem ano de nascimento e eventos sem ninguém.
 * Os outros apps guardam o que você escreve; este aponta o que ainda não está lá.
 */
export function worldGaps(u: Universe, { full = true }: { full?: boolean } = {}): WorldGap[] {
  const all = u.entities
  const noSummary = all.filter((e) => !e.summary.trim())
  const linked = new Set<string>()
  for (const r of u.relations) {
    linked.add(r.fromId)
    linked.add(r.toId)
    for (const v of r.via) linked.add(v.entityId)
  }
  for (const e of all)
    if (e.parentId) {
      linked.add(e.id)
      linked.add(e.parentId)
    }
  const loose = all.length > 1 ? all.filter((e) => !linked.has(e.id)) : []
  const pinned = new Set(u.maps.flatMap((m) => m.pins.map((p) => p.entityId)))
  const offMap = u.maps.length ? all.filter((e) => e.kind === 'lugar' && !pinned.has(e.id)) : []
  const noBirth = u.events.length ? all.filter((e) => e.kind === 'personagem' && e.startYear === null) : []
  const lonelyEvents = u.events.filter((ev) => !ev.entityIds.length && !ev.placeId)

  const gaps: WorldGap[] = [
    { key: 'resumo', count: noSummary.length, text: plural(noSummary.length, 'ficha sem resumo', 'fichas sem resumo'), hint: 'Uma frase basta: é o que aparece nas listas e na wiki.', view: 'fichas', id: noSummary[0]?.id ?? null },
    { key: 'soltas', count: loose.length, text: plural(loose.length, 'ficha solta, sem nenhuma ligação', 'fichas soltas, sem nenhuma ligação'), hint: 'Ligue a alguém, a um lugar ou a uma facção.', view: 'fichas', id: loose[0]?.id ?? null },
    { key: 'mapa', count: offMap.length, text: plural(offMap.length, 'lugar fora do mapa', 'lugares fora do mapa'), hint: 'Marque no mapa, para a wiki e a mesa acharem.', view: 'atlas', id: null },
    { key: 'nascimento', count: noBirth.length, text: plural(noBirth.length, 'personagem sem ano de nascimento', 'personagens sem ano de nascimento'), hint: 'Com o ano, a idade aparece sozinha em cada momento.', view: 'fichas', id: noBirth[0]?.id ?? null, full: true },
    { key: 'eventos', count: lonelyEvents.length, text: plural(lonelyEvents.length, 'evento sem ninguém ligado', 'eventos sem ninguém ligado'), hint: 'Diga quem estava lá ou onde foi.', view: 'timeline', id: null, full: true },
  ]
  return gaps.filter((g) => g.count > 0 && (full || !g.full))
}

/** Quantas fichas de cada tipo, dos tipos mais cheios para os mais vazios. */
export function kindCounts(u: Universe): { kind: string; count: number }[] {
  const by = new Map<string, number>()
  for (const e of u.entities) by.set(e.kind, (by.get(e.kind) ?? 0) + 1)
  return [...by].map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count)
}
