import { compressImage, type ImageUse } from './compress'
import { idToRef } from './ref'
import { imagesChanged } from './resolve'
import { imageId, saveImage } from './store'

/** Encolhe, guarda neste aparelho e devolve a referência para pôr no universo ("img:…"). */
export async function addImage(file: Blob, use: ImageUse): Promise<{ ref: string; width: number; height: number }> {
  const { blob, width, height } = await compressImage(file, use)
  const id = await imageId(blob)
  await saveImage({ id, blob, width, height })
  imagesChanged()
  return { ref: idToRef(id), width, height }
}

/** Guarda uma imagem que já vem pronta (de um backup), conferindo o id pelo conteúdo. */
export async function restoreImage(id: string, dataUrl: string): Promise<boolean> {
  try {
    const blob = await (await fetch(dataUrl)).blob()
    if ((await imageId(blob)) !== id) return false
    let size = { width: 0, height: 0 }
    try {
      const b = await createImageBitmap(blob)
      size = { width: b.width, height: b.height }
      b.close()
    } catch {
      // Sem medidas: não faz falta para mostrar.
    }
    await saveImage({ id, blob, ...size })
    return true
  } catch {
    return false
  }
}
