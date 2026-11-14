import { useRef, useState } from 'react'
import { addImage } from './add'
import type { ImageUse } from './compress'
import { CropDialog } from './CropDialog'
import type { Rect } from './crop'

/**
 * Abre o seletor de arquivos e devolve a imagem já encolhida e guardada. O retrato passa antes por um recorte quadrado
 * (e o mapa por um recorte livre, onde há); a capa e as imagens das cenas seguem direto, como antes.
 */
export function useImagePicker(use: ImageUse, onPick: (ref: string, size: { width: number; height: number }) => void, onError: (message: string) => void) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [cropping, setCropping] = useState<File | null>(null)
  const take = async (file: Blob, crop?: Rect) => {
    setBusy(true)
    try {
      const { ref, width, height } = await addImage(file, use, crop)
      onPick(ref, { width, height })
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Não foi possível usar esta imagem.')
    } finally {
      setBusy(false)
    }
  }
  const field = (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          // Copia a lista antes de limpar o campo (limpar esvazia a lista).
          const f = Array.from(e.target.files ?? [])[0]
          e.target.value = ''
          if (!f) return
          if (use === 'retrato') setCropping(f)
          else void take(f)
        }}
      />
      {cropping && (
        <CropDialog
          file={cropping}
          square
          title="Enquadrar o retrato"
          onCancel={() => setCropping(null)}
          onDone={(crop) => {
            const f = cropping
            setCropping(null)
            void take(f, crop)
          }}
        />
      )}
    </>
  )
  return { open: () => input.current?.click(), busy, field, take }
}
