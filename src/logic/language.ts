import type { Entity, Universe } from '../model/schema'
import { chosenOf, definersFor } from './definers'
import { fold } from './text'

/**
 * Idioma de um povo ou cultura: sílabas com que se montam nomes. "kar-" só abre um nome, "-dor" só o fecha,
 * e as sem traço valem em qualquer lugar. Os nomes saem sempre feitos só dessas sílabas.
 */
export type Language = NonNullable<Entity['language']>

/** "Kar-, ul thor, -dor" vira ['kar-', 'ul', 'thor', '-dor']: sem repetir, em minúsculas, de 1 a 6 letras. */
export function parseSyllables(text: string): string[] {
  const out: string[] = []
  for (const raw of text.split(/[\s,;/]+/)) {
    const lead = raw.startsWith('-')
    const trail = raw.endsWith('-') && raw.length > 1
    const letters = raw.replace(/^-+|-+$/g, '').toLocaleLowerCase('pt-BR')
    if (!/^[\p{L}']{1,6}$/u.test(letters)) continue
    const s = `${lead ? '-' : ''}${letters}${trail ? '-' : ''}`
    if (!out.includes(s)) out.push(s)
  }
  return out
}

/** Tem sílabas que bastem para montar nomes? */
export const hasLanguage = (e: Pick<Entity, 'language'>): boolean => (e.language?.syllables.length ?? 0) >= 2

const pieces = (syllables: string[]) => ({
  start: syllables.filter((s) => s.endsWith('-')).map((s) => s.slice(0, -1)),
  end: syllables.filter((s) => s.startsWith('-')).map((s) => s.slice(1)),
  any: syllables.filter((s) => !s.startsWith('-') && !s.endsWith('-')),
})

/** Gera `count` nomes no idioma: de duas ou três sílabas, sem repetir a mesma duas vezes seguidas, e fora de `avoid`. */
export function languageNames(lang: Language, count = 6, random = Math.random, avoid: string[] = []): string[] {
  const { start, end, any } = pieces(lang.syllables)
  const openers = [...start, ...any]
  const closers = [...end, ...any]
  if (!openers.length || !closers.length || openers.length + closers.length < 3) return []
  const taken = new Set(avoid.map((n) => fold(n)))
  const pick = <T,>(list: T[]) => list[Math.floor(random() * list.length)]
  const out = new Set<string>()
  for (let tries = 0; out.size < count && tries < count * 200; tries++) {
    // Três sílabas um terço das vezes; o meio é sempre uma sílaba livre.
    const parts = [pick(openers)]
    if (any.length && random() < 0.34) parts.push(pick(any))
    parts.push(pick(closers))
    if (parts.some((p, i) => i > 0 && p === parts[i - 1])) continue
    const name = parts.join('')
    if (name.length < 3 || name.length > 12) continue
    const pretty = name.charAt(0).toLocaleUpperCase('pt-BR') + name.slice(1)
    if (taken.has(fold(pretty))) continue
    out.add(pretty)
  }
  return [...out]
}

/** As fichas com idioma, pelo nome. */
export const languagesOf = (u: Universe): Entity[] => u.entities.filter(hasLanguage).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

/** O povo ou cultura (com idioma) a que a ficha pertence, pelo "Quem é". */
export function cultureOf(u: Universe, entityId: string): Entity | null {
  const e = u.entities.find((x) => x.id === entityId)
  if (!e) return null
  for (const d of definersFor(u, e.kind)) {
    const option = chosenOf(u, entityId, d)?.option
    if (option && hasLanguage(option)) return option
  }
  return null
}

/* ---------------------------------------------------------------- Língua de verdade: sons, nomes, dicionário */

/** Cartas de som: cada uma traz sílabas que soam de um jeito. Tocar numa carta junta as sílabas dela. */
export const SOUND_CARDS: { id: string; name: string; hint: string; syllables: string[] }[] = [
  { id: 'aspero', name: 'Som áspero', hint: 'k, r, g, th: duro, de montanha', syllables: ['kar-', 'gro-', 'thor', 'ur', 'krag', '-dur', '-gath', '-rok'] },
  { id: 'macio', name: 'Som macio', hint: 'l, n, v: fluido, de floresta', syllables: ['el-', 'lia-', 'vel', 'na', 'lin', '-wen', '-iel', '-ael'] },
  { id: 'vogais', name: 'Muitas vogais', hint: 'aberto, cantado, de ilha', syllables: ['ao-', 'ia', 'oe', 'ua', 'ei', '-oa', '-ae', '-ui'] },
  { id: 'sibilante', name: 'Sibilante', hint: 's, z, x: sussurrado, de deserto', syllables: ['sa-', 'zah-', 'is', 'shi', 'xar', '-sir', '-az', '-ess'] },
  { id: 'curto', name: 'Curto e seco', hint: 'sílabas fechadas, de gelo', syllables: ['bjo-', 'sig-', 'ulf', 'har', 'ste', '-vik', '-dr', '-holm'] },
  { id: 'nobre', name: 'Nobre e longo', hint: 'para impérios e linhagens', syllables: ['aure-', 'vala-', 'mer', 'ion', 'ost', '-anor', '-erion', '-ius'] },
]

/** Junta as sílabas de uma carta às que já existem, sem repetir. */
export function addSoundCard(syllables: string[], cardId: string): string[] {
  const card = SOUND_CARDS.find((c) => c.id === cardId)
  return card ? [...syllables, ...card.syllables.filter((s) => !syllables.includes(s))] : syllables
}

export type NameKind = 'pessoa' | 'lugar' | 'familia'

/** Nomes de pessoa, de lugar (com o fim de lugar do idioma) ou de família (com o começo de família). */
export function kindNames(lang: Language, kind: NameKind, count = 6, random = Math.random, avoid: string[] = []): string[] {
  const base = languageNames(lang, count, random, avoid)
  if (kind === 'lugar') {
    const end = (lang.placeEnding ?? '').trim().replace(/^-/, '')
    return end ? base.map((n) => (fold(n).endsWith(fold(end)) ? n : n + end.toLocaleLowerCase('pt-BR'))) : base
  }
  if (kind === 'familia') {
    const pre = lang.familyPrefix ?? ''
    // "Mac" vira "Mac Arel"; "O'" ou "al-" grudam no nome ("O'Arel", "al-Arel").
    const p = pre.trim()
    return p ? base.map((n) => `${p}${/['-]$/.test(p) ? '' : ' '}${n}`) : base
  }
  return base
}

/** Um número sempre igual para o mesmo texto, para a mesma palavra virar sempre a mesma tradução. */
function seeded(text: string): () => number {
  let h = 2166136261
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

/** Uma palavra nova no idioma para um significado: sempre a mesma para o mesmo significado, fora das que já existem. */
export function wordFor(lang: Language, meaning: string): string {
  const taken = (lang.words ?? []).map((w) => w.word)
  const [w] = languageNames(lang, 1, seeded(fold(meaning)), taken)
  return (w ?? '').toLocaleLowerCase('pt-BR')
}

/** Palavras pequenas que não se traduzem (artigos, preposições). */
const GLUE = new Set(['o', 'a', 'os', 'as', 'um', 'uma', 'de', 'do', 'da', 'dos', 'das', 'e', 'em', 'no', 'na', 'nos', 'nas', 'que', 'ao', 'à'])

export interface Translated {
  /** A palavra em português. */
  pt: string
  /** No idioma (vazio para as que não se traduzem). */
  word: string
  /** Já está no dicionário? Se não, é sugestão. */
  known: boolean
}

/** Traduz palavra a palavra: o que está no dicionário vale; o resto ganha uma sugestão (sempre a mesma). */
export function translate(lang: Language, phrase: string): Translated[] {
  const dict = new Map((lang.words ?? []).map((w) => [fold(w.meaning.trim()), w.word]))
  return phrase
    .split(/\s+/)
    .map((raw) => raw.replace(/[^\p{L}'-]/gu, ''))
    .filter(Boolean)
    .map((pt) => {
      const key = fold(pt)
      if (dict.has(key)) return { pt, word: dict.get(key)!, known: true }
      if (GLUE.has(pt.toLocaleLowerCase('pt-BR'))) return { pt, word: '', known: true }
      return { pt, word: wordFor(lang, key), known: false }
    })
}
