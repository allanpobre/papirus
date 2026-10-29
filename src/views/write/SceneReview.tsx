import { Check, ChevronLeft, ChevronRight, CircleDashed } from 'lucide-react'
import type { ReactNode } from 'react'
import { isOpen, type Question } from '../../logic/continuity'
import type { Scene } from '../../model/schema'
import { useWorkspace } from '../../state/workspace'
import { CardFields, ShiftPicker } from './WritingModes'

/**
 * A lista curta da Revisão para a cena aberta: o cartão, como ela termina, as pistas que ela
 * planta, avança ou paga, e as perguntas abertas. Nada é julgado pelo texto: o app só mostra o
 * que foi marcado e o que dá para contar.
 */
export function SceneReview({ scene, questions, onPrev, onNext }: { scene: Scene; questions: Question[]; onPrev?: () => void; onNext?: () => void }) {
  const { universe, go } = useWorkspace()
  const card = [scene.want, scene.obstacle, scene.outcome].filter((x) => x.trim()).length
  const open = questions.filter(isOpen).length
  const seeds = universe.seeds.flatMap((s) => {
    const roles = [s.setupSceneId === scene.id && 'planta', s.clues.some((c) => c.sceneId === scene.id) && 'avança', s.payoffSceneId === scene.id && 'paga'].filter(Boolean)
    return roles.length ? [{ seed: s, role: roles.join(' e ') }] : []
  })

  const row = (ok: boolean | null, children: ReactNode) => (
    <li className={ok === true ? 'is-ok' : ok === false ? 'is-todo' : undefined}>
      {ok ? <Check size={13} aria-hidden="true" /> : <CircleDashed size={13} aria-hidden="true" />}
      <span>{children}</span>
    </li>
  )

  return (
    <section className="margin-section scene-review" aria-label="Esta cena">
      <div className="scene-review-head">
        <h3 className="section-label">Esta cena</h3>
        <span className="scene-review-nav">
          <button type="button" className="btn-icon btn-xs" aria-label="Cena anterior" disabled={!onPrev} onClick={onPrev}>
            <ChevronLeft size={15} />
          </button>
          <button type="button" className="btn-icon btn-xs" aria-label="Próxima cena" disabled={!onNext} onClick={onNext}>
            <ChevronRight size={15} />
          </button>
        </span>
      </div>
      <span className="field-label">Como termina</span>
      <ShiftPicker scene={scene} compact />
      <ul className="scene-review-list">
        {row(
          scene.shift === 'melhor' || scene.shift === 'pior' ? true : scene.shift === 'igual' ? false : null,
          scene.shift === 'melhor' || scene.shift === 'pior' ? `Vira: termina ${scene.shift}` : scene.shift === 'igual' ? 'Marcada como “igual”: alguma coisa muda nela?' : 'Sem marca de como termina',
        )}
        {row(card === 3 ? true : card ? null : false, card === 3 ? 'Cartão completo' : card ? `Cartão com ${card} de 3 linhas` : 'Sem cartão: o que esta cena precisa fazer?')}
        {seeds.length
          ? seeds.map(({ seed, role }) =>
              row(
                true,
                <>
                  {role[0].toUpperCase() + role.slice(1)}{' '}
                  <button type="button" className="link-btn" onClick={() => go('tramas', seed.id)}>
                    {seed.title}
                  </button>
                </>,
              ),
            )
          : row(null, 'Nenhuma pista ou mistério ligado a esta cena')}
        {row(open ? false : true, open ? `${open} ${open === 1 ? 'pergunta aberta' : 'perguntas abertas'} (abaixo)` : 'Nenhuma pergunta aberta')}
      </ul>
      <details className="scene-review-card">
        <summary className="small">Cartão da cena</summary>
        <CardFields scene={scene} />
      </details>
    </section>
  )
}
