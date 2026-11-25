/**
 * Trechos secretos dentro de um texto livre: tudo entre [segredo] e [/segredo].
 * Só o autor vê; Codex dos jogadores nunca mostra, e o Archivist só recebe se o
 * autor pedir.
 *
 * Falha para o lado seguro: a marca aceita maiúsculas, espaços e plural ("[ Segredos ]"), e uma marca
 * aberta sem fechar esconde até o fim do parágrafo (antes, vazava o texto inteiro para a wiki e o leitor).
 */
const TAG = /\[\s*(\/?)\s*segredos?\s*\]/gi
const OPEN = '[segredo]'
const CLOSE = '[/segredo]'

export interface TextPart {
  secret: boolean
  text: string
}

/** O texto tem alguma marca de segredo (de qualquer jeito que foi escrita)? */
export const hasSecretMark = (text: string): boolean => /\[\s*\/?\s*segredos?\s*\]/i.test(text)

/** Divide o texto em partes públicas e secretas, para exibir com destaque. */
export function splitSecrets(text: string): TextPart[] {
  const parts: TextPart[] = []
  const push = (secret: boolean, t: string) => {
    if (!t) return
    const prev = parts.at(-1)
    if (prev && prev.secret === secret) prev.text += t
    else parts.push({ secret, text: t })
  }
  const tags = [...text.matchAll(TAG)]
  let last = 0
  for (let k = 0; k < tags.length; k++) {
    const t = tags[k]
    push(false, text.slice(last, t.index))
    // Uma marca de fechar sem abertura: só some.
    if (t[1]) {
      last = t.index + t[0].length
      continue
    }
    const start = t.index + t[0].length
    let j = k + 1
    while (j < tags.length && !tags[j][1]) j++
    if (j < tags.length) {
      // Fechada: tudo até o fechamento (aberturas repetidas no meio também somem).
      push(true, text.slice(start, tags[j].index).replace(TAG, ''))
      last = tags[j].index + tags[j][0].length
      k = j
    } else {
      // Aberta sem fechar: esconde até o fim do parágrafo.
      const nl = text.indexOf('\n', start)
      const end = nl < 0 ? text.length : nl
      push(true, text.slice(start, end).replace(TAG, ''))
      last = end
      while (k + 1 < tags.length && tags[k + 1].index < end) k++
    }
  }
  push(false, text.slice(last))
  return parts
}

/** Marcas de segredo abertas e não fechadas (escondem só até o fim do parágrafo). */
export function unclosedSecrets(text: string): number {
  let open = 0
  let count = 0
  for (const t of text.matchAll(TAG)) {
    if (!t[1]) {
      if (open) count++
      open = 1
    } else open = 0
  }
  return count + open
}

/** Marcas que parecem de segredo mas não são ("[segrdo]", "[sergedo]"): o texto delas sai para o leitor. */
export function nearMissSecretMarks(text: string): string[] {
  const out: string[] = []
  for (const m of text.matchAll(/\[\s*\/?\s*([a-zà-ú]{5,9})\s*\]/gi)) {
    const w = m[1].toLowerCase()
    if (/^segredos?$/.test(w)) continue
    if (close(w, 'segredo')) out.push(m[0])
  }
  return out
}

/** Duas palavras quase iguais (no máximo duas letras de diferença). */
function close(a: string, b: string): boolean {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[a.length][b.length] <= 2
}

/** Texto sem os trechos secretos (e sem linhas em branco sobrando). */
export function stripSecrets(text: string): string {
  return splitSecrets(text)
    .filter((p) => !p.secret)
    .map((p) => p.text)
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ {2,}/g, ' ')
    .trim()
}

export const countSecrets = (text: string) => splitSecrets(text).filter((p) => p.secret).length

/** Envolve o trecho [start, end) com as marcações de segredo. */
export function wrapSecret(text: string, start: number, end: number): { text: string; cursor: number } {
  if (start === end) {
    const inserted = `${OPEN}${CLOSE}`
    return { text: text.slice(0, start) + inserted + text.slice(end), cursor: start + OPEN.length }
  }
  const wrapped = `${OPEN}${text.slice(start, end)}${CLOSE}`
  return { text: text.slice(0, start) + wrapped + text.slice(end), cursor: start + wrapped.length }
}

/**
 * Os pedaços de texto de um mesmo parágrafo (o negrito e o itálico partem o texto em vários): tira os segredos
 * levando junto o "estou dentro de um segredo" de um pedaço para o outro, para uma marca aberta num pedaço e
 * fechada noutro não vazar o meio.
 */
export function stripSecretsAcross(pieces: string[]): string[] {
  const joined = pieces.join('\u0000')
  if (!hasSecretMark(joined)) return pieces
  // Marca cada caractere como secreto ou não, no texto inteiro do parágrafo, e devolve cada pedaço sem os secretos.
  const keep: boolean[] = []
  for (const p of splitSecretsKeepingLength(joined)) for (let i = 0; i < p.length; i++) keep.push(p.keep)
  const out: string[] = []
  let at = 0
  for (const piece of pieces) {
    let t = ''
    for (let i = 0; i < piece.length; i++) if (keep[at + i]) t += piece[i]
    out.push(t)
    at += piece.length + 1
  }
  return out
}

/** Como `splitSecrets`, mas guardando o tamanho de cada parte (marcas contam como "não guardar"). */
function splitSecretsKeepingLength(text: string): { keep: boolean; length: number }[] {
  const out: { keep: boolean; length: number }[] = []
  const tags = [...text.matchAll(TAG)]
  let last = 0
  const add = (keep: boolean, to: number) => {
    if (to > last) out.push({ keep, length: to - last })
    last = Math.max(last, to)
  }
  for (let k = 0; k < tags.length; k++) {
    const t = tags[k]
    add(true, t.index)
    if (t[1]) {
      add(false, t.index + t[0].length)
      continue
    }
    let j = k + 1
    while (j < tags.length && !tags[j][1]) j++
    if (j < tags.length) {
      add(false, tags[j].index + tags[j][0].length)
      k = j
    } else {
      const nl = text.indexOf('\n', t.index)
      const end = nl < 0 ? text.length : nl
      add(false, end)
      while (k + 1 < tags.length && tags[k + 1].index < end) k++
    }
  }
  add(true, text.length)
  return out
}
