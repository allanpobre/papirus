/**
 * Mover e aproximar um desenho (a Árvore da família, e o que mais precisar): contas sem tela.
 * A vista é {x, y, k}: um ponto (px, py) do desenho aparece em (x + k·px, y + k·py) na tela.
 */
export interface PanZoomView {
  x: number
  y: number
  k: number
}

export interface Area {
  /** O tamanho da tela onde o desenho aparece. */
  width: number
  height: number
  /** O tamanho do desenho (na escala 1). */
  contentW: number
  contentH: number
}

/** Pode sair da tela, mas sempre sobra um pedaço do desenho à vista (`margin`). */
export function clampView(v: PanZoomView, { width, height, contentW, contentH }: Area, margin = 48): PanZoomView {
  const range = (pos: number, size: number, content: number) => Math.max(Math.min(0, size - content) - margin, Math.min(Math.max(0, size - content) + margin, pos))
  return { k: v.k, x: range(v.x, width, contentW * v.k), y: range(v.y, height, contentH * v.k) }
}

/** Aproxima (ou afasta) em volta de um ponto da tela, que fica parado debaixo do dedo. */
export function zoomAt(v: PanZoomView, factor: number, fx: number, fy: number, minK: number, maxK: number): PanZoomView {
  const k = Math.min(maxK, Math.max(minK, v.k * factor))
  const r = k / v.k
  return { k, x: fx - (fx - v.x) * r, y: fy - (fy - v.y) * r }
}

/** O desenho inteiro na tela, no meio, sem passar do tamanho natural (`maxK`). */
export function fitView(a: Area, pad = 12, maxK = 1): PanZoomView {
  const k = Math.max(0.05, Math.min(maxK, (a.width - 2 * pad) / a.contentW, (a.height - 2 * pad) / a.contentH))
  return { k, x: (a.width - a.contentW * k) / 2, y: (a.height - a.contentH * k) / 2 }
}

/**
 * Como o desenho abre: inteiro, se couber com letra legível (`minReadable`); senão, no menor
 * tamanho legível, no canto de cima à esquerda, para a pessoa arrastar até o resto.
 */
export function openingView(a: Area, pad = 12, minReadable = 0.9): PanZoomView {
  const fit = fitView(a, pad)
  if (fit.k >= minReadable) return fit
  const k = minReadable
  return { k, x: pad, y: Math.max(pad, (a.height - a.contentH * k) / 2) }
}

/** A altura da área do desenho: a do desenho aberto, entre `min` e `max`. */
export function stageHeight(width: number, contentW: number, contentH: number, max: number, pad = 12, min = 160, minReadable = 0.9): number {
  const open = openingView({ width, height: max, contentW, contentH }, pad, minReadable)
  return Math.round(Math.max(min, Math.min(max, contentH * open.k + 2 * pad)))
}

/** Mexe o mínimo para a caixa (do desenho) aparecer inteira na tela, com `margin` de folga. */
export function revealBox(v: PanZoomView, box: { x: number; y: number; w: number; h: number }, a: Area, margin = 16): PanZoomView {
  const shift = (view: number, start: number, size: number, room: number) => {
    const lo = view + start * v.k
    const hi = lo + size * v.k
    if (lo < margin) return view + (margin - lo)
    if (hi > room - margin) return view - (hi - (room - margin))
    return view
  }
  return { k: v.k, x: shift(v.x, box.x, box.w, a.width), y: shift(v.y, box.y, box.h, a.height) }
}
