import { BookMarked, CalendarRange, Lightbulb, MapIcon, Network, Sprout, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useWorkspace, type View } from '../state/workspace'
import { ViewTop } from '../ui/ViewTop'
import type { PageTourId } from '../shell/pageTours'

/*
 * Mundo e Trama, cada um com as suas partes no alto da tela (como Estrutura · Página · Revisão na
 * escrita): tudo sobre o mundo numa entrada do menu, e as pistas com o que cada um sabe noutra.
 */

const PARTS: Record<'mundo' | 'trama', [View, string, LucideIcon][]> = {
  mundo: [
    ['fichas', 'Fichas', BookMarked],
    ['relacoes', 'Ligações', Network],
    ['timeline', 'Linha do tempo', CalendarRange],
    ['atlas', 'Mapas', MapIcon],
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
 * O alto de uma tela do Mundo ou da Trama, no formato de todas as telas: o nome da área, as partes
 * (as escondidas no menu ficam de fora), a busca no celular, o (?) e o botão principal.
 */
export function AreaHead({ current, tour, actions }: { current: View; tour: PageTourId; actions?: ReactNode }) {
  const { go, hiddenViews } = useWorkspace()
  const area = areaOf(current)
  const parts = PARTS[area].filter(([v]) => v === current || !hiddenViews.includes(v))
  return (
    <ViewTop
      className="area-head"
      area={area === 'mundo' ? 'Mundo' : 'Trama'}
      heading={partLabel(current)}
      parts={parts.map(([v, label, Icon]) => ({ id: v, label, icon: Icon, current: v === current, onPick: () => go(v) }))}
      partsLabel={area === 'mundo' ? 'Partes do mundo' : 'Partes da trama'}
      tour={tour}
      actions={actions}
    />
  )
}
