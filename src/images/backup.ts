import { restoreImage } from './add'
import { imageIdsIn } from './ref'
import { blobToDataUrl, imagesChanged } from './resolve'
import { loadImage, saveImage } from './store'

/** As imagens que o valor cita, como data URLs, para irem dentro do arquivo de backup. */
export async function embeddedImages(value: unknown): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const id of imageIdsIn(value)) {
    const img = await loadImage(id)
    if (img) out[id] = await blobToDataUrl(img.blob)
  }
  return out
}

/** Restaura as imagens que vêm dentro de um backup (campo "images"). Devolve quantas entraram. */
export async function restoreEmbeddedImages(raw: unknown): Promise<number> {
  const images = (raw as { images?: unknown } | null)?.images
  if (!images || typeof images !== 'object') return 0
  let n = 0
  for (const [id, data] of Object.entries(images as Record<string, unknown>)) {
    if (/^[0-9a-f]{32}$/.test(id) && typeof data === 'string' && data.startsWith('data:image/') && (await restoreImage(id, data))) n++
  }
  if (n) imagesChanged()
  return n
}

const EXT: Record<string, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif' }
export const IMAGE_EXTS = Object.values(EXT)
export const imageFileName = (id: string, type: string) => `${id}.${EXT[type] ?? 'webp'}`

/** Blob da imagem guardada neste aparelho (para escrever na pasta). */
export async function storedBlob(id: string): Promise<Blob | null> {
  return (await loadImage(id))?.blob ?? null
}

/** Guarda uma imagem lida de uma pasta (o id é o nome do arquivo). */
export async function saveFolderImage(id: string, blob: Blob) {
  await saveImage({ id, blob, width: 0, height: 0 })
}

export { imagesChanged }
