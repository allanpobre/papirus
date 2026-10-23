/**
 * Remove acentos e passa para minúsculas, mantendo o mesmo comprimento do texto
 * original, para que as posições encontradas no texto normalizado valham no original.
 */
export function fold(text: string): string {
  if (text.length > LONG) {
    const hit = longCache.get(text)
    if (hit !== undefined) return hit
  }
  let out = ''
  let run = 0
  // Trechos ASCII vão de uma vez; só os outros caracteres passam pela normalização.
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code < 128) continue
    if (i > run) out += text.slice(run, i).toLowerCase()
    const ch = code >= 0xd800 && code <= 0xdbff && i + 1 < text.length ? text.slice(i, i + 2) : text[i]
    out += foldChar(ch)
    i += ch.length - 1
    run = i + 1
  }
  if (run < text.length) out += text.slice(run).toLowerCase()
  if (text.length > LONG) {
    if (longCache.size >= LONG_CACHE_SIZE) longCache.delete(longCache.keys().next().value!)
    longCache.set(text, out)
  }
  return out
}

/** Textos longos (cenas) são normalizados muitas vezes iguais: busca, presença, detecção. */
const LONG = 400
const LONG_CACHE_SIZE = 3000
const longCache = new Map<string, string>()
const charCache = new Map<string, string>()

function foldChar(ch: string): string {
  let r = charCache.get(ch)
  if (r === undefined) {
    const base = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const lower = (base || ch).toLowerCase()
    // Mantém exatamente um caractere (ou par substituto) por caractere original.
    r = lower.length === ch.length ? lower : ch.toLowerCase().slice(0, ch.length).padEnd(ch.length)
    charCache.set(ch, r)
  }
  return r
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
