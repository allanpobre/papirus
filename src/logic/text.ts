/**
 * Remove acentos e passa para minúsculas, mantendo o mesmo comprimento do texto
 * original, para que as posições encontradas no texto normalizado valham no original.
 */
export function fold(text: string): string {
  let out = ''
  for (const ch of text) {
    const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '')
    const lower = (base || ch).toLowerCase()
    // Mantém exatamente um caractere (ou par substituto) por caractere original.
    out += lower.length === ch.length ? lower : ch.toLowerCase().slice(0, ch.length).padEnd(ch.length)
  }
  return out
}

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Trecho curto do texto ao redor de uma posição, para mostrar contexto. */
export function snippet(text: string, from: number, to: number, radius = 60): string {
  const start = Math.max(0, from - radius)
  const end = Math.min(text.length, to + radius)
  return (start > 0 ? '…' : '') + text.slice(start, end).replace(/\s+/g, ' ').trim() + (end < text.length ? '…' : '')
}
