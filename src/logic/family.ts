import type { Universe } from '../model/schema'
import { fold } from './text'

/**
 * Árvore da família a partir das relações que o autor já escreveu ("pai de", "filha de",
 * "casado com", "irmã de", "avô de"…). Nada novo para preencher.
 */
export type FamilyLink = { kind: 'pais' | 'casal' | 'irmaos' | 'avos'; a: string; b: string }

const RULES: [RegExp, FamilyLink['kind'], boolean][] = [
  // [tipo da relação, ligação, inverte (o "de" é o mais velho)]
  [/^(pai|mae|genitor[a]?|progenitor[a]?)( de)?$/, 'pais', false],
  [/^(filh[oa]|enteado|enteada)( de)?$/, 'pais', true],
  [/^(avo|avoa|avó)( de)?$/, 'avos', false],
  [/^(net[oa])( de)?$/, 'avos', true],
  [/^(casad[oa]|esposa|esposo|marido|conjuge|mulher)( com| de)?$/, 'casal', false],
  [/^(irma|irmao|meio-irma|meio-irmao|meia-irma|gemeo|gemea)( de)?$/, 'irmaos', false],
]

export function familyLinks(universe: Universe): FamilyLink[] {
  const out: FamilyLink[] = []
  for (const r of universe.relations) {
    const t = fold(r.type.trim())
    const rule = RULES.find(([re]) => re.test(t))
    if (!rule) continue
    const [, kind, invert] = rule
    // Em "pais"/"avos", a = o mais velho.
    out.push(invert ? { kind, a: r.toId, b: r.fromId } : { kind, a: r.fromId, b: r.toId })
  }
  return out
}

export interface FamilyNode {
  id: string
  gen: number
  x: number
}

/** Gerações (pais acima, filhos abaixo) e ordem em cada geração, com casais e irmãos lado a lado. */
export function familyLayout(links: FamilyLink[]): { nodes: FamilyNode[]; generations: number } {
  const ids = [...new Set(links.flatMap((l) => [l.a, l.b]))]
  const gen = new Map<string, number>()
  const delta = (l: FamilyLink) => (l.kind === 'pais' ? 1 : l.kind === 'avos' ? 2 : 0)
  for (const start of ids) {
    if (gen.has(start)) continue
    gen.set(start, 0)
    const queue = [start]
    while (queue.length) {
      const id = queue.shift()!
      const g = gen.get(id)!
      for (const l of links) {
        if (l.a === id && !gen.has(l.b)) {
          gen.set(l.b, g + delta(l))
          queue.push(l.b)
        } else if (l.b === id && !gen.has(l.a)) {
          gen.set(l.a, g - delta(l))
          queue.push(l.a)
        }
      }
    }
  }
  const min = Math.min(...gen.values())
  for (const [id, g] of gen) gen.set(id, g - min)
  const generations = Math.max(...gen.values()) + 1
  // Ordem: cada geração pela média da posição dos pais; casais e irmãos juntos.
  const rows: string[][] = Array.from({ length: generations }, () => [])
  for (const id of ids) rows[gen.get(id)!].push(id)
  const pos = new Map<string, number>()
  rows.forEach((row, g) => {
    const score = (id: string) => {
      const parents = links.filter((l) => (l.kind === 'pais' || l.kind === 'avos') && l.b === id).map((l) => pos.get(l.a) ?? 0)
      return parents.length ? parents.reduce((a, b) => a + b, 0) / parents.length : g === 0 ? ids.indexOf(id) : 1e6 + ids.indexOf(id)
    }
    row.sort((a, b) => score(a) - score(b))
    // Junta casais e irmãos: quem tem par na mesma geração vai para o lado dele.
    const placed: string[] = []
    for (const id of row) {
      if (placed.includes(id)) continue
      placed.push(id)
      for (const l of links) {
        const other = l.kind === 'casal' || l.kind === 'irmaos' ? (l.a === id ? l.b : l.b === id ? l.a : null) : null
        if (other && row.includes(other) && !placed.includes(other)) placed.push(other)
      }
    }
    placed.forEach((id, i) => pos.set(id, i))
    rows[g] = placed
  })
  return { nodes: ids.map((id) => ({ id, gen: gen.get(id)!, x: pos.get(id)! })), generations }
}
