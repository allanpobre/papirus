import type { Universe } from '../model/schema'
import { idToRef, imageIdsIn, isImageRef } from './ref'
import { imageDataUrl } from './resolve'

/** Imagens das cenas já prontas para ir dentro do livro (PDF, e-book), como data URLs. */
const ready = new Map<string, string>()

/** Prepara as imagens das cenas antes de montar o livro (que é montado de forma síncrona). */
export async function prepareBookImages(universe: Universe): Promise<void> {
  for (const id of imageIdsIn(universe.scenes)) {
    const ref = idToRef(id)
    if (ready.has(ref)) continue
    const data = await imageDataUrl(ref).catch(() => null)
    if (data) ready.set(ref, data)
  }
}

/** O endereço da imagem para o livro (ou `null` se ela não está disponível). */
export function bookImageSrc(src: unknown): string | null {
  if (typeof src !== 'string') return null
  if (isImageRef(src)) return ready.get(src) ?? null
  return src.startsWith('data:image/') ? src : null
}
