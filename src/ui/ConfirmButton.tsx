import { useEffect, useRef, useState, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Pergunta mostrada no lugar do botão. */
  question: string
  confirmLabel: string
  onConfirm: () => void
  title?: string
}

/**
 * Botão de ação destrutiva com confirmação no próprio lugar, sem caixas de
 * diálogo do navegador (que alguns ambientes bloqueiam). Esc ou "Cancelar" desistem.
 */
export function ConfirmButton({ children, question, confirmLabel, onConfirm, title }: Props) {
  const [asking, setAsking] = useState(false)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (asking) cancelRef.current?.focus()
  }, [asking])

  if (!asking) {
    return (
      <button type="button" title={title} onClick={() => setAsking(true)}>
        {children}
      </button>
    )
  }

  return (
    <span
      className="confirm"
      role="group"
      aria-label={question}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setAsking(false)
      }}
    >
      <span className="confirm-question">{question}</span>
      <button
        type="button"
        onClick={() => {
          setAsking(false)
          onConfirm()
        }}
      >
        {confirmLabel}
      </button>
      <button type="button" ref={cancelRef} onClick={() => setAsking(false)}>
        Cancelar
      </button>
    </span>
  )
}
