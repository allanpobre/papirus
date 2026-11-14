/*
 * Recortar a imagem antes de guardar. Tudo em pixels da imagem original. O retrato é quadrado (arrasta e dá zoom dentro
 * de um quadrado); o mapa é livre (arrasta o retângulo e as bordas). Contas puras, sem tela: ver `CropDialog`.
 */

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** O menor lado que um recorte pode ter (em pixels da imagem). */
export const MIN_CROP = 32

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi))

/** O maior quadrado possível (zoom 1) ou menor, centrado em (cx, cy) e sempre dentro da imagem. */
export function squareRect(imgW: number, imgH: number, zoom: number, cx: number, cy: number): Rect {
  const side = Math.max(Math.min(MIN_CROP, imgW, imgH), Math.min(imgW, imgH) / Math.max(1, zoom))
  return { x: clamp(cx - side / 2, 0, imgW - side), y: clamp(cy - side / 2, 0, imgH - side), w: side, h: side }
}

/** A imagem inteira, sem recortar. */
export const wholeRect = (imgW: number, imgH: number): Rect => ({ x: 0, y: 0, w: imgW, h: imgH })

/** Move o recorte (sem sair da imagem). */
export function moveRect(r: Rect, dx: number, dy: number, imgW: number, imgH: number): Rect {
  return { ...r, x: clamp(r.x + dx, 0, imgW - r.w), y: clamp(r.y + dy, 0, imgH - r.h) }
}

export type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

/** Arrasta uma borda ou canto do recorte livre: nunca sai da imagem nem fica menor que `min`. */
export function resizeRect(r: Rect, handle: Handle, dx: number, dy: number, imgW: number, imgH: number, min = MIN_CROP): Rect {
  let left = r.x
  let top = r.y
  let right = r.x + r.w
  let bottom = r.y + r.h
  if (handle.includes('w')) left = clamp(left + dx, 0, right - min)
  if (handle.includes('e')) right = clamp(right + dx, left + min, imgW)
  if (handle.includes('n')) top = clamp(top + dy, 0, bottom - min)
  if (handle.includes('s')) bottom = clamp(bottom + dy, top + min, imgH)
  return { x: left, y: top, w: right - left, h: bottom - top }
}

/** O recorte, arredondado para pixels inteiros e dentro da imagem. */
export function pixelRect(r: Rect, imgW: number, imgH: number): Rect {
  const x = clamp(Math.round(r.x), 0, imgW - 1)
  const y = clamp(Math.round(r.y), 0, imgH - 1)
  return { x, y, w: clamp(Math.round(r.w), 1, imgW - x), h: clamp(Math.round(r.h), 1, imgH - y) }
}

/** É a imagem inteira (nada a recortar)? */
export const isWhole = (r: Rect, imgW: number, imgH: number): boolean => Math.round(r.x) === 0 && Math.round(r.y) === 0 && Math.round(r.w) >= imgW && Math.round(r.h) >= imgH
