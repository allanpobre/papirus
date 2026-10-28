import { ImagePlus, Loader2, Trash2 } from 'lucide-react'
import type { ImageUse } from './compress'
import { useImagePicker } from './useImagePicker'
import { useImageSrc } from './resolve'

/** Uma imagem do universo (referência "img:", data URL ou endereço). Enquanto carrega, um espaço vazio. */
export function Picture({ value, alt = '', className }: { value: string | null | undefined; alt?: string; className?: string }) {
  const src = useImageSrc(value)
  if (!src) return <span className={`picture-empty${className ? ` ${className}` : ''}`} role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true} />
  return <img src={src} alt={alt} className={className} decoding="async" draggable={false} />
}

/** Botões de escolher, trocar e tirar uma imagem. */
export function ImageButtons({
  value,
  use,
  onChange,
  onError,
  chooseLabel = 'Escolher imagem',
  removeLabel = 'Tirar imagem',
  className = 'btn btn-ghost btn-sm',
}: {
  value: string | null
  use: ImageUse
  onChange: (ref: string | null) => void
  onError: (message: string) => void
  chooseLabel?: string
  removeLabel?: string
  className?: string
}) {
  const picker = useImagePicker(use, (ref) => onChange(ref), onError)
  return (
    <>
      {picker.field}
      <button type="button" className={className} onClick={picker.open} disabled={picker.busy}>
        {picker.busy ? <Loader2 size={14} className="spin" /> : <ImagePlus size={14} />} {value ? 'Trocar' : chooseLabel}
      </button>
      {value && (
        <button type="button" className={className} aria-label={removeLabel} title={removeLabel} onClick={() => onChange(null)}>
          <Trash2 size={14} />
        </button>
      )}
    </>
  )
}
