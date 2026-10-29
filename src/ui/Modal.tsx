import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import type { PageTourId } from '../shell/pageTours'
import { PageHelp } from './PageTour'
import { useBackLayer } from './useBackLayer'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** Painel lateral em vez de janela central. */
  side?: boolean
  /** Janela que funciona como uma tela: o (?) no cabeçalho abre o tour dela. */
  help?: PageTourId
}

/** Janela dentro do app. Esc, clique fora ou o "voltar" do aparelho fecham; o foco volta para onde estava. */
export function Modal({ title, onClose, children, footer, size = 'md', side = false, help }: Props) {
  const titleId = useId()
  const ref = useRef<HTMLDivElement>(null)
  useBackLayer(onClose)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const first = ref.current?.querySelector<HTMLElement>(
      '[autofocus], input:not([type=hidden]), textarea, select, button:not(.modal-close):not(.page-help)',
    )
    ;(first ?? ref.current)?.focus()
    return () => previous?.focus?.()
  }, [])

  return (
    <div
      className={side ? 'overlay overlay-side' : 'overlay'}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={ref}
        className={`modal modal-${size}${side ? ' modal-side' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation()
            onClose()
          }
          if (e.key === 'Tab') trapFocus(e, ref.current)
        }}
      >
        <header className="modal-header">
          <h2 id={titleId}>{title}</h2>
          {help && <PageHelp tour={help} className="modal-help" />}
          <button type="button" className="btn-icon modal-close" aria-label="Fechar" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>
  )
}

/** Tab e Shift+Tab giram dentro da janela, sem escapar para a página atrás. */
export function trapFocus(e: React.KeyboardEvent, root: HTMLElement | null) {
  if (!root) return
  const items = [
    ...root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]',
    ),
  ].filter((el) => el.offsetParent !== null)
  if (!items.length) return
  const first = items[0]
  const last = items[items.length - 1]
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}
