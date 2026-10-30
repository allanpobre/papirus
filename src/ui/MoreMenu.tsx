import { MoreHorizontal } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Botão "⋯" com ações menos usadas, para a barra não ficar cheia de ícones.
 * Fecha ao clicar fora ou com Esc. `children` recebe uma função para fechar.
 */
export function MoreMenu({
  label,
  children,
  button,
  buttonClass = 'btn-icon',
}: {
  label: string
  children: (close: () => void) => ReactNode
  /** O que o botão mostra (padrão: "⋯", só com o rótulo para leitores de tela). */
  button?: ReactNode
  buttonClass?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <div className="more-menu" ref={ref}>
      <button type="button" className={buttonClass} aria-label={button ? undefined : label} title={button ? undefined : label} aria-expanded={open} onClick={() => setOpen(!open)}>
        {button ?? <MoreHorizontal size={18} />}
      </button>
      {open && (
        <div className="more-menu-pop" role="group" aria-label={label}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}
