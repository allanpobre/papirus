import { useRef, useState } from 'react'
import { addImage } from './add'
import type { ImageUse } from './compress'

/** Abre o seletor de arquivos e devolve a imagem já encolhida e guardada. */
export function useImagePicker(use: ImageUse, onPick: (ref: string, size: { width: number; height: number }) => void, onError: (message: string) => void) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const take = async (file: File) => {
    setBusy(true)
    try {
      const { ref, width, height } = await addImage(file, use)
      onPick(ref, { width, height })
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Não foi possível usar esta imagem.')
    } finally {
      setBusy(false)
    }
  }
  const field = (
    <input
      ref={input}
      type="file"
      accept="image/*"
      hidden
      onChange={(e) => {
        const f = e.target.files?.[0]
        e.target.value = ''
        if (f) void take(f)
      }}
    />
  )
  return { open: () => input.current?.click(), busy, field, take }
}
