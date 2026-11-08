import type { Node as PMNode } from '@tiptap/pm/model'

/** Como procurar: palavra inteira ("mar" não acha "amar") e maiúsculas iguais ("Rei" não acha "rei"). */
export interface FindOptions {
  wholeWord: boolean
  matchCase: boolean
}

export interface Range {
  from: number
  to: number
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** A expressão de busca, ou `null` sem nada para procurar. */
export function searchPattern(query: string, opts: FindOptions): RegExp | null {
  if (!query) return null
  let body = escape(query)
  // Letras com acento contam como letras: "mar" inteira não acha "amará".
  if (opts.wholeWord) body = `(?<![\\p{L}\\p{N}_])${body}(?![\\p{L}\\p{N}_])`
  return new RegExp(body, `gu${opts.matchCase ? '' : 'i'}`)
}

/** Onde a busca aparece num texto. */
export function findRanges(text: string, query: string, opts: FindOptions): Range[] {
  const re = searchPattern(query, opts)
  if (!re) return []
  const out: Range[] = []
  for (const m of text.matchAll(re)) {
    if (m[0].length === 0) continue
    out.push({ from: m.index, to: m.index + m[0].length })
  }
  return out
}

/**
 * Sem "maiúsculas iguais", o que entra segue o que estava: "Espada" no começo da frase vira "Lâmina",
 * "ESPADA" vira "LÂMINA". Com a opção ligada, entra exatamente o que foi digitado.
 */
export function followCase(found: string, replacement: string, opts: FindOptions): string {
  if (opts.matchCase || !replacement) return replacement
  const letters = found.replace(/[^\p{L}]/gu, '')
  if (letters.length > 1 && letters === letters.toLocaleUpperCase('pt-BR') && letters !== letters.toLocaleLowerCase('pt-BR')) return replacement.toLocaleUpperCase('pt-BR')
  const first = found.match(/\p{L}/u)?.[0]
  if (first && first !== first.toLocaleLowerCase('pt-BR')) return replacement.charAt(0).toLocaleUpperCase('pt-BR') + replacement.slice(1)
  return replacement
}

/** Texto de um bloco e a posição no documento de cada caractere (o que não é texto vira quebra de linha). */
function blockText(node: PMNode, start: number) {
  let text = ''
  const positions: number[] = []
  node.forEach((child, offset) => {
    if (child.isText) {
      for (let i = 0; i < child.text!.length; i++) positions.push(start + offset + i)
      text += child.text
    } else {
      positions.push(start + offset)
      text += '\n'
    }
  })
  return { text, positions }
}

export interface DocHit extends Range {
  /** O texto do bloco (parágrafo) e onde o achado está nele, para mostrar o trecho em volta. */
  block: string
  at: number
}

/** Os achados num documento do editor, na ordem do texto. Um achado não atravessa parágrafos. */
export function findInDoc(doc: PMNode, query: string, opts: FindOptions): DocHit[] {
  const out: DocHit[] = []
  if (!query) return out
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true
    const { text, positions } = blockText(node, pos + 1)
    for (const r of findRanges(text, query, opts)) out.push({ from: positions[r.from], to: positions[r.to - 1] + 1, block: text, at: r.from })
    return false
  })
  return out
}
