import type { Scene } from '../model/schema'

/**
 * Trechos que só se revelam ao leitor a partir de uma cena:
 *   [a partir de "A ponte" #3f2a9c]Mira é filha de Vaelor.[/a partir]
 * e o que o leitor lê **até** essa cena (a máscara, o que parece antes da revelação):
 *   [até "A ponte" #3f2a9c]Mira é órfã.[/até]
 * O nome deixa legível para o autor; o #id (começo do id da cena) mantém o vínculo
 * mesmo se a cena mudar de nome. Dá para escrever só o nome, à mão.
 */
const REVEAL = /\[(a partir de|até)(?:\s+"([^"\]]*)")?(?:\s+#([0-9a-z-]{4,}))?\s*\]([\s\S]*?)\[\/(a partir|até)\]/gi
const ID_CHARS = 6

const isUntil = (op: string) => op.toLowerCase() !== 'a partir de' && op.toLowerCase() !== 'a partir'

export interface RevealPart {
  /** `null` = texto comum. */
  sceneTitle: string | null
  sceneRef: string | null
  text: string
  /** Máscara: o leitor lê isto **até** a cena (depois, some). Sem isso, é o "a partir de". */
  until?: boolean
}

export function splitReveals(text: string): RevealPart[] {
  const parts: RevealPart[] = []
  let last = 0
  for (const m of text.matchAll(REVEAL)) {
    // Abre com "até" e fecha com "a partir" (ou o contrário): não é marcação, fica como texto.
    if (isUntil(m[1]) !== isUntil(m[5])) continue
    if (m.index > last) parts.push({ sceneTitle: null, sceneRef: null, text: text.slice(last, m.index) })
    parts.push({ sceneTitle: m[2] ?? '', sceneRef: m[3] ?? null, text: m[4], ...(isUntil(m[1]) ? { until: true } : {}) })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ sceneTitle: null, sceneRef: null, text: text.slice(last) })
  return parts
}

export const countReveals = (text: string) => splitReveals(text).filter((p) => p.sceneTitle !== null && !p.until).length

/**
 * Tira as marcações e deixa a verdade (para quem vê tudo: autor, Codex dos jogadores, wiki da história toda):
 * o que se revela fica, e a máscara (o que o leitor lia antes) sai.
 */
export const unmarkReveals = (text: string) =>
  text.replace(REVEAL, (all, op: string, _t, _r, body: string, close: string) => (isUntil(op) !== isUntil(close) ? all : isUntil(op) ? '' : body))

/** As máscaras de um texto, na ordem: o que o leitor lê até cada cena. */
export const masksOf = (text: string) => splitReveals(text).filter((p) => p.until)

/**
 * Põe (ou troca, ou tira com texto vazio) a máscara da revelação de número `nth` (contando só os "a partir de"):
 * o que o leitor lê até aquela cena. A máscara fica logo antes do trecho revelado.
 */
export function setMask(text: string, nth: number, mask: string): string {
  const matches = [...text.matchAll(REVEAL)].filter((m) => isUntil(m[1]) === isUntil(m[5]))
  const froms = matches.filter((m) => !isUntil(m[1]))
  const from = froms[nth]
  if (!from) return text
  const before = matches.find((m) => isUntil(m[1]) && m.index + m[0].length === from.index && (m[3] ?? m[2]) === (from[3] ?? from[2]))
  const title = (from[2] ?? '').replace(/["\]]/g, '')
  const tag = `[até${title ? ` "${title}"` : ''}${from[3] ? ` #${from[3]}` : ''}]`
  const clean = mask.replace(/\[\/?(até|a partir)[^\]]*\]/gi, '')
  const insert = clean.trim() ? `${tag}${clean}[/até]` : ''
  if (before) return text.slice(0, before.index) + insert + text.slice(before.index + before[0].length)
  return text.slice(0, from.index) + insert + text.slice(from.index)
}

/** Envolve o trecho [start, end) para se revelar a partir da cena. */
export function wrapReveal(text: string, start: number, end: number, scene: Pick<Scene, 'id' | 'title'>): { text: string; cursor: number } {
  const title = (scene.title || 'Sem título').replace(/["\]]/g, '')
  const open = `[a partir de "${title}" #${scene.id.slice(0, ID_CHARS)}]`
  const close = '[/a partir]'
  const inner = text.slice(start, end)
  const wrapped = `${open}${inner}${close}`
  return { text: text.slice(0, start) + wrapped + text.slice(end), cursor: start === end ? start + open.length : start + wrapped.length }
}

/** Posição da cena (no manuscrito) de um trecho marcado; `null` se não achou a cena. */
export function revealIndex(part: RevealPart, order: Scene[]): number | null {
  if (part.sceneRef) {
    const i = order.findIndex((s) => s.id.startsWith(part.sceneRef!))
    if (i >= 0) return i
  }
  const title = (part.sceneTitle ?? '').trim().toLowerCase()
  if (title) {
    const i = order.findIndex((s) => s.title.trim().toLowerCase() === title)
    if (i >= 0) return i
  }
  return null
}
