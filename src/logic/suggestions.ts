import { chosenOf, definersOf, optionsOf } from './definers'
import { fold } from './text'
import type { Entity, Universe } from '../model/schema'

/*
 * O texto alimenta o mundo, só com regras (sem IA). As sugestões sempre se propõem: nada muda sem um toque.
 * - Apelido pelo primeiro nome: "Ilvani" no texto, a ficha é "Ilvani Saren" e ninguém mais começa assim.
 * - Quem é por um padrão simples: "Ilvani, uma dunmer" quando "Dunmer" é uma opção (espécie, cultura…) e a
 *   ficha ainda não escolheu nada naquele item.
 */

export type Suggestion =
  | { kind: 'apelido'; key: string; entityId: string; alias: string; count: number }
  | { kind: 'quem-e'; key: string; entityId: string; definerId: string; definerName: string; optionId: string; quote: string }

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const firstWord = (name: string) => name.trim().split(/\s+/)[0] ?? ''
/** Nomes de pessoa e de grupo: só os que costumam ter nome e sobrenome. */
const NAMED = ['personagem', 'faccao', 'reino', 'lugar']

/** Quem atende por este nome (o nome, um apelido ou o primeiro nome, se for só de uma ficha). */
function whoIs(u: Universe, name: string): Entity | undefined {
  const f = fold(name.trim())
  if (!f) return undefined
  const exact = u.entities.filter((e) => fold(e.name) === f || e.aliases.some((a) => fold(a) === f))
  if (exact.length === 1) return exact[0]
  if (exact.length) return undefined
  const byFirst = u.entities.filter((e) => e.kind === 'personagem' && fold(firstWord(e.name)) === f)
  return byFirst.length === 1 ? byFirst[0] : undefined
}

/** Apelidos que o texto pede: o primeiro nome, sozinho, de uma ficha de nome composto. */
export function aliasSuggestions(u: Universe, text: string): Suggestion[] {
  const out: Suggestion[] = []
  const taken = new Map<string, number>()
  for (const e of u.entities) {
    taken.set(fold(e.name.trim()), (taken.get(fold(e.name.trim())) ?? 0) + 1)
    for (const a of e.aliases) taken.set(fold(a.trim()), (taken.get(fold(a.trim())) ?? 0) + 1)
  }
  const firsts = new Map<string, number>()
  for (const e of u.entities) if (NAMED.includes(e.kind)) firsts.set(fold(firstWord(e.name)), (firsts.get(fold(firstWord(e.name))) ?? 0) + 1)
  for (const e of u.entities) {
    if (!NAMED.includes(e.kind)) continue
    const name = e.name.trim()
    const first = firstWord(name)
    if (first === name || first.length < 3 || first[0] !== first[0].toLocaleUpperCase('pt-BR') || first[0] === first[0].toLocaleLowerCase('pt-BR')) continue
    const f = fold(first)
    if (taken.has(f) || (firsts.get(f) ?? 0) > 1) continue
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${esc(first)}(?![\\p{L}\\p{N}])`, 'gu')
    let count = 0
    for (const m of text.matchAll(re)) if (!text.startsWith(name, m.index)) count++
    if (count) out.push({ kind: 'apelido', key: `apelido:${e.id}:${f}`, entityId: e.id, alias: first, count })
  }
  return out
}

/** "Fulano, um/uma X" quando X é uma opção do Quem é e Fulano ainda não escolheu nada nesse item. */
export function whoIsSuggestions(u: Universe, text: string): Suggestion[] {
  const out: Suggestion[] = []
  const seen = new Set<string>()
  for (const d of definersOf(u)) {
    const options = new Map(optionsOf(u, d).filter((o) => o.name.trim().length >= 3).map((o) => [fold(o.name.trim()), o]))
    if (!options.size) continue
    for (const m of text.matchAll(/,\s+(?:um|uma|o|a)\s+(\p{L}[\p{L}'-]*(?:\s\p{L}[\p{L}'-]*)?)/gu)) {
      const words = m[1].split(/\s/)
      const option = options.get(fold(m[1])) ?? options.get(fold(words[0]))
      if (!option) continue
      const before = text.slice(0, m.index).match(/(\p{Lu}[\p{L}'-]*(?:\s\p{Lu}[\p{L}'-]*)*)$/u)
      if (!before) continue
      const who = whoIs(u, before[1])
      if (!who || !d.appliesTo.includes(who.kind) || chosenOf(u, who.id, d)) continue
      const key = `quem-e:${who.id}:${d.id}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ kind: 'quem-e', key, entityId: who.id, definerId: d.id, definerName: d.name, optionId: option.id, quote: `${before[1]}${m[0]}` })
    }
  }
  return out
}

/** As sugestões de uma cena, sem as que a pessoa já recusou. */
export const sceneSuggestions = (u: Universe, text: string, ignored: string[] = []): Suggestion[] =>
  [...aliasSuggestions(u, text), ...whoIsSuggestions(u, text)].filter((s) => !ignored.includes(s.key))
