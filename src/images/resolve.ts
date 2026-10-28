import { useEffect, useState } from 'react'
import type { ServerConfig } from '../share/server'
import { publicImageUrl } from './cloud'
import { isImageRef, refToId } from './ref'
import { loadImage, saveImage } from './store'

/** Servidor de onde baixar imagens que não estão neste aparelho (o da conta ou o do link). */
let server: ServerConfig | null = null
export function setImageServer(s: ServerConfig | null) {
  server = s
}

const urls = new Map<string, string>()
const pending = new Map<string, Promise<string | null>>()
const listeners = new Set<() => void>()

/** Endereço local (blob:) da imagem: deste aparelho ou, se não estiver aqui, baixada do servidor e guardada. */
export function imageUrl(id: string): Promise<string | null> {
  const ready = urls.get(id)
  if (ready) return Promise.resolve(ready)
  let p = pending.get(id)
  if (!p) {
    p = (async () => {
      let blob = (await loadImage(id))?.blob
      if (!blob && server) {
        try {
          const r = await fetch(publicImageUrl(server, id))
          if (r.ok) {
            blob = await r.blob()
            const size = await dimensions(blob)
            await saveImage({ id, blob, ...size })
          }
        } catch {
          // Sem conexão: tenta de novo na próxima vez que a imagem aparecer.
        }
      }
      pending.delete(id)
      if (!blob) return null
      const url = URL.createObjectURL(blob)
      urls.set(id, url)
      return url
    })()
    pending.set(id, p)
  }
  return p
}

/** Avisa quem mostra imagens que uma chegou (por exemplo, depois de restaurar um backup). */
export function imagesChanged() {
  for (const l of listeners) l()
}

async function dimensions(blob: Blob): Promise<{ width: number; height: number }> {
  try {
    const b = await createImageBitmap(blob)
    const out = { width: b.width, height: b.height }
    b.close()
    return out
  } catch {
    return { width: 0, height: 0 }
  }
}

/**
 * O endereço para pôr num <img> ou fundo: referências "img:" viram blob: (assíncrono);
 * data URLs e endereços comuns passam direto. `null` enquanto carrega ou se não há.
 */
export function useImageSrc(value: string | null | undefined): string | null {
  const id = value && isImageRef(value) ? refToId(value) : null
  const [, bump] = useState(0)
  useEffect(() => {
    if (!id || urls.has(id)) return
    let off = false
    const run = () => void imageUrl(id).then((u) => !off && u && bump((n) => n + 1))
    run()
    listeners.add(run)
    return () => {
      off = true
      listeners.delete(run)
    }
  }, [id])
  if (!value) return null
  return id ? (urls.get(id) ?? null) : value
}

/** Data URL da imagem (para exportar livro, wiki e backup, que precisam da imagem dentro do arquivo). */
export async function imageDataUrl(value: string | null | undefined): Promise<string | null> {
  if (!value) return null
  if (!isImageRef(value)) return value
  const url = await imageUrl(refToId(value))
  if (!url) return null
  const blob = await (await fetch(url)).blob()
  return blobToDataUrl(blob)
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

/** Miniatura em data URL (lado maior `size`), para ir dentro de algo pequeno, como o Codex dos jogadores. */
export async function imageThumbDataUrl(value: string | null | undefined, size = 256): Promise<string | null> {
  const full = await imageDataUrl(value)
  if (!full) return null
  try {
    const bmp = await createImageBitmap(await (await fetch(full)).blob())
    const scale = Math.min(1, size / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bmp.width * scale))
    canvas.height = Math.max(1, Math.round(bmp.height * scale))
    canvas.getContext('2d')?.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    bmp.close()
    const webp = canvas.toDataURL('image/webp', 0.8)
    return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.82)
  } catch {
    return null
  }
}
