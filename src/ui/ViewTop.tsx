import { Search, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { PageTourId } from '../shell/pageTours'
import { useWorkspace } from '../state/workspace'
import { tabListKeys } from './keys'
import { PageHelp } from './PageTour'

/** Uma parte de uma área (Fichas, Ligações…), no alto da tela. */
export interface TopPart {
  id: string
  label: string
  icon?: LucideIcon
  current: boolean
  onPick: () => void
}

/**
 * O alto de toda tela de um universo, sempre no mesmo formato: o nome da área, as partes dela,
 * e no fim a busca (no celular), o (?) e o botão principal. Aprendeu uma tela, aprendeu todas.
 *
 * `heading` é o título da página para leitores de tela quando ele é diferente do nome da área
 * (no Mundo, a parte aberta: "Fichas"). `tabs` faz das partes abas (na Mesa, que troca o conteúdo
 * sem sair da tela).
 */
export function ViewTop({
  area,
  heading,
  parts,
  partsLabel,
  tabs = false,
  tour,
  actions,
  className = '',
}: {
  area: string
  heading?: string
  parts?: TopPart[]
  partsLabel?: string
  tabs?: boolean
  tour: PageTourId
  actions?: ReactNode
  className?: string
}) {
  const { openSearch } = useWorkspace()
  const many = Boolean(parts && parts.length > 1)
  return (
    <header className={`view-top${many ? ' has-parts' : ''} ${className}`.trim()}>
      {heading && heading !== area ? (
        <>
          <p className="view-top-title" aria-hidden="true">
            {area}
          </p>
          <h1 className="sr-only">{heading}</h1>
        </>
      ) : (
        <h1 className="view-top-title">{area}</h1>
      )}
      {many &&
        parts &&
        (tabs ? (
          <div className="writing-modes view-top-parts" role="tablist" aria-label={partsLabel} onKeyDown={tabListKeys} data-tour="partes">
            {parts.map(({ id, label, icon: Icon, current, onPick }) => (
              <button key={id} type="button" role="tab" aria-selected={current} tabIndex={current ? 0 : -1} onClick={onPick}>
                {Icon && <Icon size={15} aria-hidden="true" />}
                <span>{label}</span>
              </button>
            ))}
          </div>
        ) : (
          <nav className="writing-modes view-top-parts" aria-label={partsLabel} data-tour="partes">
            {parts.map(({ id, label, icon: Icon, current, onPick }) => (
              <button key={id} type="button" aria-current={current ? 'page' : undefined} onClick={() => !current && onPick()}>
                {Icon && <Icon size={15} aria-hidden="true" />}
                <span>{label}</span>
              </button>
            ))}
          </nav>
        ))}
      <span className="view-top-end">
        <button type="button" className="btn-icon view-top-search" aria-label="Buscar em tudo" title="Buscar em tudo" onClick={openSearch}>
          <Search size={18} aria-hidden="true" />
        </button>
        <PageHelp tour={tour} />
        {actions}
      </span>
    </header>
  )
}
