/**
 * Imagens do universo ficam fora do JSON: o universo guarda só uma referência
 * curta ("img:" + o resumo do conteúdo) e a imagem em si fica neste navegador
 * e, com conta, no servidor. Campos antigos com a imagem embutida (data URL)
 * continuam valendo.
 */
export const IMAGE_REF = /^img:([0-9a-f]{32})$/

export const isImageRef = (v: unknown): boolean => typeof v === 'string' && IMAGE_REF.test(v)
export const refToId = (ref: string): string => ref.slice(4)
export const idToRef = (id: string): string => `img:${id}`

/** Todas as imagens citadas em qualquer lugar do valor (universo inteiro, lixeira e histórico inclusos). */
export function imageIdsIn(value: unknown, out = new Set<string>()): Set<string> {
  if (typeof value === 'string') {
    if (value.length === 36 && isImageRef(value)) out.add(refToId(value))
  } else if (Array.isArray(value)) {
    for (const v of value) imageIdsIn(v, out)
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) imageIdsIn(v, out)
  }
  return out
}
