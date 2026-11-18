import { ChevronDown } from 'lucide-react'
import { useState, type ReactNode } from 'react'

/** No celular a janela é estreita: as partes começam fechadas (só a mais usada, aberta). No computador, todas abertas. */
const onPhone = () => typeof matchMedia === 'function' && matchMedia('(max-width: 640px)').matches

/**
 * Uma parte da janela Compartilhar que abre e fecha. O título e um resumo ficam sempre à vista
 * ("Ligado · Livro, sem spoiler"), para saber como está sem abrir. O conteúdo de cada parte é o mesmo de sempre.
 */
export function ShareSection({
  id,
  title,
  icon,
  summary,
  openOnPhone = false,
  children,
}: {
  /** O mesmo id que o passeio e os leitores de tela usam para achar a parte. */
  id: string
  title: string
  icon?: ReactNode
  /** O que mais importa saber sem abrir. */
  summary?: string
  /** No celular, começa aberta (a mais usada, ou a que pede uma resposta). */
  openOnPhone?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(() => !onPhone() || openOnPhone)
  return (
    <section className="share-section" aria-labelledby={id}>
      <details className="share-collapse" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary>
          <h3 id={id} className="share-title">
            {icon} {title}
          </h3>
          {summary && <span className="share-summary muted tiny">{summary}</span>}
          <ChevronDown className="share-chevron" size={16} aria-hidden="true" />
        </summary>
        <div className="share-collapse-body">{children}</div>
      </details>
    </section>
  )
}
