import type { Scene } from '../model/schema'

/**
 * Trechos que só se revelam ao leitor a partir de uma cena:
 *   [a partir de "A ponte" #3f2a9c]Mira é filha de Vaelor.[/a partir]
 * O nome deixa legível para o autor; o #id (começo do id da cena) mantém o vínculo
 * mesmo se a cena mudar de nome. Dá para escrever só o nome, à mão.
 */
const REVEAL = /\[a partir de(?:\s+"([^"\]]*)")?(?:\s+#([0-9a-z-]{4,}))?\s*\]([\s\S]*?)\[\/a partir\]/gi
const ID_CHARS = 6

export interface RevealPart {
  /** `null` = texto comum. */
  sceneTitle: string | null
  sceneRef: string | null
  text: string
}

export function splitReveals(text: string): RevealPart[] {
  const parts: RevealPart[] = []
  let last = 0
  for (const m of text.matchAll(REVEAL)) {
    if (m.index > last) parts.push({ sceneTitle: null, sceneRef: null, text: text.slice(last, m.index) })
    parts.push({ sceneTitle: m[1] ?? '', sceneRef: m[2] ?? null, text: m[3] })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ sceneTitle: null, sceneRef: null, text: text.slice(last) })
  return parts
}

export const countReveals = (text: string) => [...text.matchAll(REVEAL)].length
export const hasReveals = (text: string) => countReveals(text) > 0

/** Tira as marcações e deixa os trechos (para quem vê tudo: autor, Codex dos jogadores). */
export const unmarkReveals = (text: string) => text.replace(REVEAL, '$3')

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
