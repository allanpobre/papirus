/**
 * Quanto rolar por quadro quando se arrasta algo perto da borda de cima (negativo) ou de baixo (positivo) da área visível.
 * Zero no meio; cresce até `max` perto da borda e passa a valer `max` se o dedo sair da área.
 */
export function autoScrollSpeed(y: number, top: number, bottom: number, edge = 90, max = 16): number {
  if (bottom - top < edge * 2) return 0
  if (y < top + edge) return -Math.min(max, Math.max(1, Math.round(((top + edge - y) / edge) * max)))
  if (y > bottom - edge) return Math.min(max, Math.max(1, Math.round(((y - (bottom - edge)) / edge) * max)))
  return 0
}
