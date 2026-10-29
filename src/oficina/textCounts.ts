import { fold } from '../logic/text'

/*
 * As contas da Oficina sobre um texto curto (um exercício): nada de IA, só o que dá para
 * contar. Quem escreveu olha os números e responde às perguntas; o app não dá nota.
 */

const WORD = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu

/** As palavras do texto, na ordem, com a posição de cada uma. */
export function wordsOf(text: string): { word: string; at: number }[] {
  return [...text.matchAll(WORD)].map((m) => ({ word: m[0], at: m.index }))
}

/** O tamanho (em palavras) de cada frase. Falas e quebras de parágrafo também fecham frase. */
export function sentenceLengths(text: string): number[] {
  return text
    .split(/(?<=[.!?…])\s+|\n+/u)
    .map((s) => (s.match(WORD) ?? []).length)
    .filter((n) => n > 0)
}

const DIALOGUE = /^\s*[—–\-“"«]/u

/** Quanto do texto (em palavras) está em parágrafos de fala, de 0 a 1. */
export function dialogueShare(text: string): number {
  const paragraphs = text.split(/\n+/).filter((p) => p.trim())
  const total = paragraphs.reduce((n, p) => n + (p.match(WORD) ?? []).length, 0)
  if (!total) return 0
  const spoken = paragraphs.filter((p) => DIALOGUE.test(p)).reduce((n, p) => n + (p.match(WORD) ?? []).length, 0)
  return spoken / total
}

const SPEECH = ['disse', 'perguntou', 'respondeu', 'gritou', 'sussurrou', 'murmurou', 'exclamou', 'retrucou', 'redarguiu', 'berrou', 'falou', 'indagou', 'replicou', 'vociferou', 'bradou', 'completou', 'continuou']

/** Os verbos de fala usados, do mais usado ao menos. */
export function speechVerbs(text: string): { verb: string; n: number }[] {
  const counts = new Map<string, number>()
  for (const { word } of wordsOf(text)) {
    const w = fold(word)
    if (SPEECH.includes(w)) counts.set(w, (counts.get(w) ?? 0) + 1)
  }
  return [...counts].map(([verb, n]) => ({ verb, n })).sort((a, b) => b.n - a.n || a.verb.localeCompare(b.verb))
}

/** Palavras em -mente que não são advérbio. */
const NOT_ADVERB = new Set(['mente', 'mentes', 'semente', 'sementes', 'demente', 'clemente', 'veemente', 'dormente', 'nascente'])

/** Os advérbios em -mente, como aparecem no texto. */
export function menteWords(text: string): string[] {
  return wordsOf(text)
    .map((w) => w.word)
    .filter((w) => {
      const f = fold(w)
      return f.length > 6 && f.endsWith('mente') && !NOT_ADVERB.has(f)
    })
}

/** Palavras comuns demais para contar como repetição. */
const COMMON = new Set(
  'quando porque porem entao entre sobre depois antes ainda mesmo muito pouco outra outro outras outros sempre nunca tinha tinham havia estava estavam seria seriam disse respondeu perguntou aquele aquela aqueles aquelas esse essa esses essas este esta estes estas isso isto aquilo tambem apenas assim agora tudo nada alguem ninguem nosso nossa seus suas dele dela deles delas pelo pela pelos pelas como mais menos onde coisa coisas'.split(
    ' ',
  ),
)

/** Palavras de 5 letras ou mais que voltam em menos de 30 palavras. */
export function nearRepeats(text: string, within = 30): string[] {
  const seen = new Map<string, number>()
  const found = new Set<string>()
  wordsOf(text).forEach(({ word }, i) => {
    const w = fold(word)
    if (w.length < 5 || COMMON.has(w) || w.endsWith('mente')) return
    const last = seen.get(w)
    if (last !== undefined && i - last <= within) found.add(word.toLowerCase())
    seen.set(w, i)
  })
  return [...found]
}

/**
 * As palavras proibidas que aparecem. Com 4 letras ou mais, vale o começo ("assust" pega
 * "assustada"); mais curtas, só a palavra inteira; com espaço, a expressão.
 */
export function forbiddenIn(text: string, forbid: string[]): string[] {
  if (!forbid.length) return []
  const words = wordsOf(text).map((w) => w.word)
  const folded = words.map(fold)
  const plain = ` ${folded.join(' ')} `
  const hits = new Set<string>()
  for (const entry of forbid) {
    const f = fold(entry)
    if (f.includes(' ')) {
      if (plain.includes(` ${f} `)) hits.add(entry)
      continue
    }
    folded.forEach((w, i) => {
      if (f.length < 4 ? w === f : w.startsWith(f)) hits.add(words[i].toLowerCase())
    })
  }
  return [...hits]
}
