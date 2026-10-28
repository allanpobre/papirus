/** Medidas comuns aos tours: achar o alvo na tela e onde pôr o balão para não cobri-lo. */

export const TOUR_GAP = 12
export const TOUR_CARD_W = 330

/** O elemento do passo, se estiver na tela (escondido ou sem tamanho não conta). */
export function findTarget(selector: string | undefined): HTMLElement | null {
  if (!selector) return null
  const el = document.querySelector<HTMLElement>(selector)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 ? el : null
}

/**
 * Onde fica o balão: ao lado do alvo, embaixo ou em cima; sem alvo, no centro
 * (ou embaixo, quando a tela atrás é o assunto do passo).
 */
export function placeCard(rect: DOMRect | null, cardH: number, docked = false): { left: number; top: number; width: number } {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const w = Math.min(TOUR_CARD_W, vw - 24)
  let pos: { left: number; top: number }
  if (!rect && docked) pos = { left: (vw - w) / 2, top: vh - cardH - 16 }
  else if (!rect) pos = { left: (vw - w) / 2, top: Math.max(12, (vh - cardH) / 2) }
  else if (rect.right + TOUR_GAP + w < vw - 12 && rect.width < vw / 2) pos = { left: rect.right + TOUR_GAP, top: rect.top + rect.height / 2 - cardH / 2 }
  else if (rect.bottom + TOUR_GAP + cardH < vh - 12) pos = { left: rect.left + rect.width / 2 - w / 2, top: rect.bottom + TOUR_GAP }
  else if (rect.top - TOUR_GAP - cardH > 12) pos = { left: rect.left + rect.width / 2 - w / 2, top: rect.top - TOUR_GAP - cardH }
  else pos = { left: (vw - w) / 2, top: Math.max(12, vh - cardH - 12) }
  return { left: Math.max(12, Math.min(pos.left, vw - w - 12)), top: Math.max(12, Math.min(pos.top, vh - cardH - 12)), width: w }
}
