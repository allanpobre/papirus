import { Hourglass } from 'lucide-react'
import { formatYear } from '../model/labels'
import { useWorkspace } from '../state/workspace'

/**
 * Aviso de que a Máquina do tempo está num ano: o que aparece nesta tela é o que existia nele, e há um jeito
 * óbvio de sair. `hidden` é quantas coisas ficam de fora; `filtering` diz se estão escondidas agora.
 */
export function YearBanner({ year, hidden, filtering, onToggle, onExit, what = 'fichas' }: { year: number; hidden: number; filtering: boolean; onToggle?: () => void; onExit: () => void; what?: string }) {
  const { universe } = useWorkspace()
  return (
    <div className="year-banner" role="status">
      <Hourglass size={14} aria-hidden="true" />
      <span className="year-banner-text">
        No ano <strong>{formatYear(year, universe.settings.calendarSuffix)}</strong>
        {hidden > 0 && ` · ${hidden} ${what} ${filtering ? 'escondidas' : 'fora do ano'}`}
      </span>
      {onToggle && hidden > 0 && (
        <button type="button" className="link-btn" onClick={onToggle}>
          {filtering ? `Mostrar as ${hidden}` : 'Esconder as que não existiam'}
        </button>
      )}
      <button type="button" className="btn btn-sm year-banner-exit" onClick={onExit}>
        Sair do ano
      </button>
    </div>
  )
}
