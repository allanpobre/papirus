import { BookMarked, CalendarRange, Lightbulb, MapIcon, Network, Sprout, type LucideIcon } from 'lucide-react'
import { useWorkspace, type View } from '../state/workspace'
import { PageHelp } from '../ui/PageTour'
import type { PageTourId } from '../shell/pageTours'

/*
 * Mundo e Trama, cada um com as suas partes no alto da tela (como Mapa · Página · Revisão na
 * escrita): tudo sobre o mundo numa entrada do menu, e as pistas com o que cada um sabe noutra.
 */

const PARTS: Record<'mundo' | 'trama', [View, string, LucideIcon][]> = {
  mundo: [
    ['fichas', 'Fichas', BookMarked],
    ['relacoes', 'Ligações', Network],
    ['timeline', 'Linha do tempo', CalendarRange],
    ['atlas', 'Atlas', MapIcon],
  ],
  trama: [
    ['tramas', 'Pistas e mistérios', Sprout],
    ['conhecimento', 'Quem sabe o quê', Lightbulb],
  ],
}

const areaOf = (view: View) => (PARTS.trama.some(([v]) => v === view) ? 'trama' : 'mundo')

/** O nome de cada parte, para o título da tela. */
const partLabel = (view: View) => [...PARTS.mundo, ...PARTS.trama].find(([v]) => v === view)?.[1] ?? ''

/**
 * O alto de uma tela do Mundo ou da Trama: as partes (as escondidas no menu ficam de fora) e o (?).
 * Com uma parte só, fica o título.
 */
export function AreaHead({ current, tour }: { current: View; tour: PageTourId }) {
  const { go, hiddenViews } = useWorkspace()
  const area = areaOf(current)
  const parts = PARTS[area].filter(([v]) => v === current || !hiddenViews.includes(v))
  const title = partLabel(current)
  return (
    <header className="view-head area-head">
      <h1 className={parts.length > 1 ? 'sr-only' : undefined}>{title}</h1>
      {parts.length > 1 && (
        <nav className="writing-modes area-modes" aria-label={area === 'mundo' ? 'Partes do mundo' : 'Partes da trama'} data-tour="partes">
          {parts.map(([v, label, Icon]) => (
            <button key={v} type="button" aria-current={v === current ? 'page' : undefined} onClick={() => v !== current && go(v)}>
              <Icon size={15} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      )}
      <PageHelp tour={tour} />
    </header>
  )
}
