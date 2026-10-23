/**
 * Trechos secretos dentro de um texto livre: tudo entre [segredo] e [/segredo].
 * Só o autor vê; Codex dos jogadores nunca mostra, e o Archivist só recebe se o
 * autor pedir.
 */
const SECRET = /\[segredo\]([\s\S]*?)\[\/segredo\]/gi
const OPEN = '[segredo]'
const CLOSE = '[/segredo]'

export interface TextPart {
  secret: boolean
  text: string
}

/** Divide o texto em partes públicas e secretas, para exibir com destaque. */
export function splitSecrets(text: string): TextPart[] {
  const parts: TextPart[] = []
  let last = 0
  for (const m of text.matchAll(SECRET)) {
    if (m.index > last) parts.push({ secret: false, text: text.slice(last, m.index) })
    parts.push({ secret: true, text: m[1] })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ secret: false, text: text.slice(last) })
  return parts
}

/** Texto sem os trechos secretos (e sem linhas em branco sobrando). */
export function stripSecrets(text: string): string {
  return text
    .replace(SECRET, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ {2,}/g, ' ')
    .trim()
}

/** Texto sem as marcações, mantendo os trechos (para o autor). */
export function unmarkSecrets(text: string): string {
  return text.replace(SECRET, '$1')
}

export const countSecrets = (text: string) => [...text.matchAll(SECRET)].length

/** Envolve o trecho [start, end) com as marcações de segredo. */
export function wrapSecret(text: string, start: number, end: number): { text: string; cursor: number } {
  if (start === end) {
    const inserted = `${OPEN}${CLOSE}`
    return { text: text.slice(0, start) + inserted + text.slice(end), cursor: start + OPEN.length }
  }
  const wrapped = `${OPEN}${text.slice(start, end)}${CLOSE}`
  return { text: text.slice(0, start) + wrapped + text.slice(end), cursor: start + wrapped.length }
}
