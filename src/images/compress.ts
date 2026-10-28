/** Tamanhos máximos (lado maior, em pixels) por uso. */
export const IMAGE_SIZES = { retrato: 800, capa: 1600, cena: 1600, mapa: 2400 } as const
export type ImageUse = keyof typeof IMAGE_SIZES

/** Imagens maiores que isto, mesmo depois de encolher, não entram (o servidor recusa acima de 3 MB). */
export const MAX_IMAGE_BYTES = 2.5 * 1024 * 1024

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file)
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() }
    } catch {
      // Alguns formatos só abrem pelo <img>.
    }
  }
  const url = URL.createObjectURL(file)
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = () => reject(new Error('Não foi possível ler esta imagem.'))
    i.src = url
  })
  return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/**
 * Encolhe a imagem neste aparelho antes de guardar: lado maior até `maxSide`, em WebP
 * (ou JPEG, onde o navegador não gera WebP). Uma foto de celular de 4 MB vira ~150 KB.
 */
export async function compressImage(file: Blob, use: ImageUse): Promise<{ blob: Blob; width: number; height: number }> {
  if (!file.type.startsWith('image/')) throw new Error('Esse arquivo não é uma imagem.')
  const img = await decode(file)
  try {
    const scale = Math.min(1, IMAGE_SIZES[use] / Math.max(img.width, img.height))
    const width = Math.max(1, Math.round(img.width * scale))
    const height = Math.max(1, Math.round(img.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Não foi possível ler esta imagem.')
    ctx.drawImage(img.source, 0, 0, width, height)
    let blob = await toBlob(canvas, 'image/webp', 0.82)
    if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', 0.85)
    if (!blob) throw new Error('Não foi possível preparar esta imagem.')
    // Já pequena e num formato bom: fica a original, se for menor.
    if (scale === 1 && file.size < blob.size && /^image\/(webp|jpeg|png)$/.test(file.type)) blob = file
    if (blob.size > MAX_IMAGE_BYTES) throw new Error('Imagem grande demais, mesmo reduzida. Tente outra.')
    return { blob, width, height }
  } finally {
    img.close()
  }
}
