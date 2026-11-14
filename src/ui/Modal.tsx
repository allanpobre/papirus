import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import type { PageTourId } from '../shell/pageTours'
import { PageHelp } from './PageTour'
import { useBackLayer } from './useBackLayer'
import { trapFocus } from './trapFocus'

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
  /** Ao fechar, o foco volta para onde estava (padrão). Em janelas abertas de dentro do texto, no celular, é melhor não voltar: o teclado abriria de novo. */
  restoreFocus?: boolean
}

/** Janela dentro do app. Esc, clique fora ou o "voltar" do aparelho fecham; o foco volta para onde estava. */
export function Modal({ title, onClose, children, footer, size = 'md', side = false, help, restoreFocus = true }: Props) {
  const titleId = useId()
  const ref = useRef<HTMLDivElement>(null)
  useBackLayer(onClose)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    // O primeiro campo ou botão que se vê (um seletor de arquivo escondido não recebe o foco).
    const first = [
      ...(ref.current?.querySelectorAll<HTMLElement>('[autofocus], input:not([type=hidden]), textarea, select, button:not(.modal-close):not(.page-help)') ?? []),
    ].find((el) => el.offsetParent !== null)
    ;(first ?? ref.current)?.focus()
    return () => {
      if (restoreFocus) previous?.focus?.()
    }
    // Só vale o que foi escolhido ao abrir a janela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Se o botão com o foco some (ex.: "Criar o link" vira o link), o foco cai na página e o Esc
  // não chegaria à janela: a janela de cima fecha mesmo assim.
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      const active = document.activeElement
      if (active && active !== document.body && active !== document.documentElement) return
      const overlays = document.querySelectorAll('.overlay')
      if (overlays[overlays.length - 1] === ref.current?.parentElement) closeRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
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
