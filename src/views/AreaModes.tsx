import { Dices, BookMarked, CalendarRange, Globe, Lightbulb, MapIcon, Network, Sprout, type LucideIcon } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { RollDialog } from './RollDialog'
import { useWorkspace, type View } from '../state/workspace'
import { ViewTop } from '../ui/ViewTop'
import { WAITING } from '../logic/firstSteps'
import type { PageTourId } from '../shell/pageTours'
import { typingOrDialog } from '../shell/keys'

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

/** Nova cara: a Linha do tempo sai do Mundo e vai para a História (com as pistas e quem sabe o quê). */
const NOVA_PARTS: typeof PARTS = {
  mundo: PARTS.mundo.filter(([v]) => v !== 'timeline'),
  trama: [...PARTS.trama, PARTS.mundo.find(([v]) => v === 'timeline')!],
}
const areaOf = (view: View) => (NOVA_PARTS.trama.some(([v]) => v === view) ? 'trama' : 'mundo')

/** O nome de cada parte, para o título da tela. */
const partLabel = (view: View) => [...PARTS.mundo, ...PARTS.trama].find(([v]) => v === view)?.[1] ?? ''

/**
 * O alto de uma tela do Mundo ou da Trama, no formato de todas as telas: o nome da área, as partes
 * (as escondidas no menu ficam de fora), a busca no celular, o (?) e o botão principal.
 */
export function AreaHead({ current, tour, actions }: { current: View; tour: PageTourId; actions?: ReactNode }) {
  const { go, hiddenViews, waitingViews, showAllParts } = useWorkspace()
  const area = areaOf(current)
  const parts = NOVA_PARTS[area].filter(([v]) => v === current || !hiddenViews.includes(v))
  // A wiki do mundo: à mão em todas as partes do Mundo, direto na página com a prévia.
  const [rolling, setRolling] = useState(false)
  // [ e ]: a parte anterior e a próxima (fora de campos de texto e janelas).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== '[' && e.key !== ']') || e.ctrlKey || e.metaKey || e.altKey || typingOrDialog(e)) return
      const i = parts.findIndex(([v]) => v === current)
      const next = parts[(i + (e.key === ']' ? 1 : parts.length - 1)) % parts.length]
      if (next && next[0] !== current) {
        e.preventDefault()
        go(next[0])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [parts, current, go])
  const wikiButton =
    area === 'mundo' ? (
      <>
      <button type="button" className="btn btn-ghost btn-sm area-roll" aria-label="Rolar no mundo" title="Rolar no mundo: boatos, encontros, segredos, tirados do seu mundo" onClick={() => setRolling(true)}>
        <Dices size={15} aria-hidden="true" /> <span className="area-wiki-label">Rolar</span>
      </button>
      <button type="button" className="btn btn-ghost btn-sm area-wiki" aria-label="Wiki" title="Ver, personalizar e baixar a wiki do mundo" onClick={() => go('wiki')}>
        <Globe size={15} aria-hidden="true" /> <span className="area-wiki-label">Wiki</span>
      </button>
      </>
    ) : null
  // Primeira vez: as partes que ainda esperam o uso, e quando aparecem ("Mostrar todas" desliga).
  const waiting = WAITING.filter((w) => NOVA_PARTS[area].some(([v]) => v === w.view) && waitingViews.includes(w.view))
  const hint =
    waiting.length > 0 ? (
      // Curto (feedback das personas, Lia): o porquê de cada parte fica no “title”, sem um parágrafo no alto da tela.
      <p className="first-steps-hint tiny muted" title={waiting.map((w) => `${partLabel(w.view)}: ${w.why}`).join('\n')}>
        Mais partes aparecem com o uso ({waiting.map((w) => partLabel(w.view)).join(', ')}).{' '}
        <button type="button" className="link-btn" onClick={showAllParts}>
          Mostrar todas
        </button>
      </p>
    ) : null
  return (
    <>
      <ViewTop
        className="area-head"
        area={area === 'mundo' ? 'Mundo' : 'História'}
        heading={partLabel(current)}
        parts={parts.map(([v, label, Icon]) => ({ id: v, label, short: v === 'timeline' ? 'Tempo' : undefined, icon: Icon, current: v === current, onPick: () => go(v) }))}
        partsLabel={area === 'mundo' ? 'Partes do mundo' : 'Partes da história'}
        tour={tour}
        actions={
          wikiButton || actions ? (
            <>
              {wikiButton}
              {actions}
            </>
          ) : undefined
        }
      />
      {hint}
    {rolling && <RollDialog onClose={() => setRolling(false)} />}
    </>
  )
}
