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
