import { namesOf, type Entity } from '../model/universe'
import { escapeRegExp, fold } from './text'

export interface Mention {
  entityId: string
  from: number
  to: number
  /** O nome ou apelido que foi encontrado. */
  name: string
}

const WORD = '[\\p{L}\\p{N}]'

/**
 * Procura, num texto, os nomes e apelidos das fichas conhecidas. Ignora acentos e
 * maiúsculas, respeita limites de palavra e prefere o nome mais longo
 * ("Casa de Vaelor" antes de "Vaelor"). Nunca cria fatos: só aponta onde estão.
 */
export class MentionMatcher {
  private readonly regex: RegExp | null
  private readonly owner = new Map<string, { entityId: string; name: string }>()

  constructor(entities: Entity[]) {
    for (const e of entities) {
      for (const name of namesOf(e)) {
        const key = fold(name)
        // Com nomes repetidos, a primeira ficha vence; ambiguidade fica para o autor resolver.
        if (key.length >= 2 && !this.owner.has(key)) this.owner.set(key, { entityId: e.id, name })
      }
    }
    const keys = [...this.owner.keys()].sort((a, b) => b.length - a.length)
    this.regex = keys.length
      ? new RegExp(`(?<!${WORD})(?:${keys.map(escapeRegExp).join('|')})(?!${WORD})`, 'gu')
      : null
  }

  get isEmpty() {
    return this.regex === null
  }

  find(text: string): Mention[] {
    if (!this.regex) return []
    const folded = fold(text)
    const out: Mention[] = []
    for (const m of folded.matchAll(this.regex)) {
      const owner = this.owner.get(m[0])
      if (owner) out.push({ entityId: owner.entityId, from: m.index, to: m.index + m[0].length, name: owner.name })
    }
    return out
  }
}

export interface Candidate {
  text: string
  count: number
  /** Primeira ocorrência, para mostrar contexto. */
  index: number
}

/** Conectores que podem aparecer no meio de um nome próprio. */
const CONNECTORS = new Set(['de', 'da', 'do', 'das', 'dos', 'del', 'of', 'the', 'van', 'von', 'di'])

/** Palavras que costumam aparecer com maiúscula sem serem nomes. */
const COMMON = new Set(
  [
    'eu', 'tu', 'ele', 'ela', 'nós', 'vós', 'eles', 'elas', 'você', 'vocês', 'senhor', 'senhora',
    'sim', 'não', 'mas', 'e', 'o', 'a', 'os', 'as', 'um', 'uma', 'de', 'que', 'se', 'quem', 'como',
    'onde', 'quando', 'por', 'para', 'deus', 'i', 'he', 'she', 'it', 'we', 'they', 'you', 'the', 'mr',
    'mrs', 'ms', 'dr', 'capítulo', 'cena', 'parte', 'livro', 'ato',
  ].map(fold),
)

/**
 * Encontra possíveis nomes próprios ainda não cadastrados: sequências de palavras
 * com inicial maiúscula que aparecem pelo menos uma vez no meio de uma frase.
 * É uma heurística simples: pode errar e deixar passar nomes.
 */
export function findCandidates(text: string, known: Entity[], ignored: string[] = []): Candidate[] {
  const skip = new Set([...known.flatMap(namesOf), ...ignored].map(fold))
  const tokens = [...text.matchAll(/[\p{L}][\p{L}\p{N}'’-]*|[.!?…:;—–"“”«»\n]/gu)]
  const found = new Map<string, Candidate & { midSentence: boolean }>()

  let sentenceStart = true
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i][0]
    if (!/^\p{L}/u.test(tok)) {
      sentenceStart = /[.!?…:—–"“«\n]/.test(tok) ? true : sentenceStart
      continue
    }
    if (!/^\p{Lu}/u.test(tok)) {
      sentenceStart = false
      continue
    }

    // Junta palavras capitalizadas seguidas, permitindo conectores entre elas.
    const start = i
    let end = i
    let j = i + 1
    while (j < tokens.length) {
      const t = tokens[j][0]
      const gapOk = text.slice(tokens[j - 1].index + tokens[j - 1][0].length, tokens[j].index).trim() === ''
      if (!gapOk) break
      if (/^\p{Lu}/u.test(t)) {
        // No início da frase, a primeira palavra pode ser só um verbo ("Viu Kael"):
        // ela fica separada do nome seguinte.
        if (sentenceStart && j === start + 1) break
        end = j
        j++
      } else if (CONNECTORS.has(fold(t)) && j + 1 < tokens.length && /^\p{Lu}/u.test(tokens[j + 1][0])) {
        j++
      } else break
    }

    const from = tokens[start].index
    const to = tokens[end].index + tokens[end][0].length
    const phrase = text.slice(from, to)
    const isMid = !sentenceStart
    i = end
    sentenceStart = false

    const words = phrase.split(/\s+/)
    if (words.length === 1 && COMMON.has(fold(phrase))) continue
    const key = fold(phrase)
    if (skip.has(key) || key.length < 2) continue

    const entry = found.get(key)
    if (entry) {
      entry.count++
      entry.midSentence ||= isMid
    } else {
      found.set(key, { text: phrase, count: 1, index: from, midSentence: isMid })
    }
  }

  return [...found.values()]
    .filter((c) => c.midSentence || c.count >= 3)
    .sort((a, b) => b.count - a.count || a.index - b.index)
    .map(({ text, count, index }) => ({ text, count, index }))
}
