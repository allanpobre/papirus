/**
 * Onde ficam as marcações de segredo e de spoiler num texto, para o campo de escrita
 * mostrar cada trecho destacado (e as marcas apagadas) e para desfazer uma marca.
 */
const SECRET = /\[segredo\]([\s\S]*?)\[\/segredo\]/gi
const REVEAL = /\[a partir de(?:\s+"[^"\]]*")?(?:\s+#[0-9a-z-]{4,})?\s*\]([\s\S]*?)\[\/a partir\]/gi

export interface MarkRange {
  kind: 'secret' | 'reveal'
  /** Começo da marca de abertura. */
  start: number
  innerStart: number
  innerEnd: number
  /** Fim da marca de fechamento. */
  end: number
}

export function markRanges(text: string): MarkRange[] {
  const out: MarkRange[] = []
  for (const [kind, re, close] of [
    ['secret', SECRET, '[/segredo]'.length],
    ['reveal', REVEAL, '[/a partir]'.length],
  ] as const) {
    for (const m of text.matchAll(re)) {
      const end = m.index + m[0].length
      const innerEnd = end - close
      out.push({ kind, start: m.index, innerStart: innerEnd - m[1].length, innerEnd, end })
    }
  }
  return out.sort((a, b) => a.start - b.start)
}

export interface MarkSegment {
  text: string
  /** Pedaço da própria marca ([segredo], [/a partir]…). */
  tag: boolean
  secret: boolean
  reveal: boolean
}

/** O texto em pedaços, cada um com o que vale para ele. */
export function markSegments(text: string, ranges = markRanges(text)): MarkSegment[] {
  const cuts = new Set([0, text.length])
  for (const r of ranges) for (const p of [r.start, r.innerStart, r.innerEnd, r.end]) cuts.add(p)
  const points = [...cuts].sort((a, b) => a - b)
  const out: MarkSegment[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const [a, b] = [points[i], points[i + 1]]
    if (a === b) continue
    const inside = ranges.filter((r) => a >= r.start && b <= r.end)
    const seg: MarkSegment = {
      text: text.slice(a, b),
      tag: inside.some((r) => b <= r.innerStart || a >= r.innerEnd),
      secret: inside.some((r) => r.kind === 'secret'),
      reveal: inside.some((r) => r.kind === 'reveal'),
    }
    const last = out[out.length - 1]
    if (last && last.tag === seg.tag && last.secret === seg.secret && last.reveal === seg.reveal) last.text += seg.text
    else out.push(seg)
  }
  return out
}

/** A marca (mais de dentro) em que o cursor está. */
export function markAt(text: string, pos: number, kind: MarkRange['kind']): MarkRange | undefined {
  return markRanges(text)
    .filter((r) => r.kind === kind && pos >= r.start && pos <= r.end)
    .sort((a, b) => a.end - a.start - (b.end - b.start))[0]
}

/** Tira a marca e deixa o trecho como texto comum. */
export function unwrapMark(text: string, r: MarkRange): { text: string; cursor: number } {
  const inner = text.slice(r.innerStart, r.innerEnd)
  return { text: text.slice(0, r.start) + inner + text.slice(r.end), cursor: r.start + inner.length }
}
