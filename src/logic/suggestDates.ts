import type { Universe } from '../model/schema'

/*
 * Anos escritos nas fichas (auditoria 26, Duda): quem trouxe notas escreveu “a tempestade de 340” ou “nasceu em
 * 1752”. Aqui achamos esses anos e PROPOMOS um evento na Linha do tempo, ligado à ficha, com um título tirado da
 * própria frase. Nada entra na linha do tempo sem o toque do autor.
 */

export interface SuggestedDate {
  entityId: string
  year: number
  /** Título sugerido, tirado das palavras antes do ano (“A tempestade”). */
  title: string
  /** A frase de onde veio. */
  quote: string
}

// “de/em/desde/até/no ano… 340”, com 3 ou 4 algarismos (2 seriam idades e quantidades demais), e sem uma unidade
// logo depois (“de 300 soldados”, “em 120 dias”).
const YEAR = /\b(em|de|desde|até|no ano de|no ano|o ano de|ano|por volta de|antes de|depois de)\s+(\d{3,4})\b(?!\s*(?:anos?|dias?|mes(?:es)?|semanas?|horas?|homens|mulheres|pessoas|soldados|guerreiros|navios|léguas|metros|passos|quilômetros|km|moedas|vezes|%|º|ª))/gi
const SKIP = new Set(['desde', 'em', 'de', 'do', 'da', 'no', 'na', 'a', 'o', 'os', 'as', 'um', 'uma', 'que', 'e', 'foi', 'era', 'é', 'tem', 'antes', 'depois', 'por', 'volta', 'até', 'ano'])

const textOf = (e: Universe['entities'][number]) => [e.summary, e.description, ...e.fields.map((f) => f.value)].filter(Boolean).join('\n')

const CUT = new Set(['desde', 'em', 'de', 'do', 'da', 'no', 'na', 'antes', 'depois', 'até', 'por', 'com', 'para'])
const ARTICLES = new Set(['a', 'o', 'os', 'as', 'um', 'uma'])

function titleFrom(before: string): string {
  let words = before.split(/\s+/).filter(Boolean).slice(-4)
  // Começa depois da última preposição: “medo do mar desde a tempestade” → “a tempestade”.
  for (let i = words.length - 2; i >= 0; i--)
    if (CUT.has(words[i].toLowerCase())) {
      words = words.slice(i + 1)
      break
    }
  while (words.length && SKIP.has(words[0].toLowerCase()) && !ARTICLES.has(words[0].toLowerCase())) words.shift()
  const t = words.join(' ').replace(/[,;:]+$/, '').trim()
  return t ? t[0].toUpperCase() + t.slice(1) : ''
}

export function suggestDates(u: Universe): SuggestedDate[] {
  const out: SuggestedDate[] = []
  const seen = new Set<string>()
  for (const e of u.entities) {
    if (e.canon === 'secreto') continue
    const text = textOf(e)
    if (!text) continue
    for (const sentence of text.split(/(?<=[.!?])\s+|\n+/)) {
      for (const m of sentence.matchAll(YEAR)) {
        const year = Number(m[2])
        const key = `${e.id}:${year}`
        if (seen.has(key)) continue
        // Já está na linha do tempo, ligado a esta ficha.
        if (u.events.some((ev) => ev.year === year && ev.entityIds.includes(e.id))) continue
        if (e.startYear === year || e.endYear === year) continue
        seen.add(key)
        const title = titleFrom(sentence.slice(0, m.index ?? 0)) || `${e.name}, ${year}`
        out.push({ entityId: e.id, year, title, quote: sentence.trim().slice(0, 160) })
      }
    }
  }
  return out.sort((a, b) => a.year - b.year)
}
