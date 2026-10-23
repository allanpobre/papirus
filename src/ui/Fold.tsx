import { ChevronRight } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { recall, remember } from '../state/prefs'

/**
 * Seção que abre e fecha. O estado fica guardado neste navegador por `id`,
 * para que cada ficha abra do jeito que o autor deixou.
 */
export function Fold({ id, title, children, defaultOpen = true }: { id: string; title: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(() => {
    const saved = recall(`secao:${id}`)
    return saved === null ? defaultOpen : saved === '1'
  })
  return (
    <details
      className="entity-section fold"
      open={open}
      onToggle={(e) => {
        const now = (e.currentTarget as HTMLDetailsElement).open
        setOpen(now)
        remember(`secao:${id}`, now ? '1' : '0')
      }}
    >
      <summary className="fold-summary">
        <ChevronRight size={16} className="fold-chevron" aria-hidden="true" />
        <h2 className="section-title">{title}</h2>
      </summary>
      <div className="fold-body">{children}</div>
    </details>
  )
}
