import { ArrowRight, BookOpen, Eye, Lightbulb, Link2, Unlink, UserPlus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { characterArc, type ArcMomentKind } from '../logic/arc'
import type { Entity } from '../model/schema'
import { useWorkspace } from '../state/workspace'
import { Fold } from '../ui/Fold'

const ICON: Record<ArcMomentKind, typeof Eye> = {
  entra: UserPlus,
  'relacao-comeca': Link2,
  'relacao-termina': Unlink,
  fato: BookOpen,
  sabe: Lightbulb,
  revela: Eye,
}
const PREFIX: Partial<Record<ArcMomentKind, string>> = { 'relacao-comeca': 'Começa: ', 'relacao-termina': 'Acaba: ', revela: 'O leitor descobre: ' }
const PRESENCE_LABEL = { pov: 'ponto de vista', presente: 'presente', mencionado: 'citado' } as const

/** O arco de uma ficha: em quais cenas aparece e o que muda para ela, cena a cena. */
export function ArcCard({ entity }: { entity: Entity }) {
  const { universe, go } = useWorkspace()
  const arc = useMemo(() => characterArc(universe, entity.id), [universe, entity.id])
  const [all, setAll] = useState(false)
  if (!arc.steps.length) return null
  const withMoments = arc.steps.filter((s) => s.moments.length)
  const shown = all ? withMoments : withMoments.slice(0, 6)
  const name = entity.name || 'esta ficha'

  return (
    <Fold id="ficha-arco" title="Arco na história">
      {!arc.first ? (
        <p className="muted small">{name} ainda não aparece no manuscrito.</p>
      ) : (
        <>
          <p className="small arc-summary">
            Em {arc.present} {arc.present === 1 ? 'cena' : 'cenas'}
            {arc.mentioned > 0 && `, citado em mais ${arc.mentioned}`}. Entra em “{arc.first.title}”
            {arc.last && arc.last !== arc.first && `; última vez em “${arc.last.title}”`}.
            {arc.longestAbsence >= 2 && ` Fica ${arc.longestAbsence} cenas seguidas fora.`}
          </p>
          <div className="arc-strip" role="list" aria-label={`Onde ${name} aparece, cena a cena`}>
            {arc.steps.map((s) => (
              <button
                key={s.sceneId}
                type="button"
                role="listitem"
                className={`arc-dot arc-${s.presence ?? 'ausente'}`}
                title={`${s.n}. ${s.title}${s.presence ? ` — ${PRESENCE_LABEL[s.presence]}` : ''}`}
                aria-label={`${s.n}. ${s.title}: ${s.presence ? PRESENCE_LABEL[s.presence] : 'não aparece'}`}
                onClick={() => go('escrever', s.sceneId)}
              />
            ))}
          </div>
          <p className="arc-legend tiny muted" aria-hidden="true">
            <span className="arc-dot arc-pov" /> ponto de vista <span className="arc-dot arc-presente" /> presente <span className="arc-dot arc-mencionado" /> citado{' '}
            <span className="arc-dot arc-ausente" /> fora
          </p>
          {withMoments.length > 0 && (
            <ol className="arc-steps">
              {shown.map((s) => (
                <li key={s.sceneId} className="arc-step">
                  <button type="button" className="link-btn arc-step-title" onClick={() => go('escrever', s.sceneId)}>
                    {s.n}. {s.title}
                  </button>
                  <ul className="arc-moments">
                    {s.moments.map((m, i) => {
                      const Icon = ICON[m.kind]
                      return (
                        <li key={i} className={`arc-moment arc-moment-${m.kind}`}>
                          <Icon size={14} aria-hidden="true" />
                          <span className="small">
                            {PREFIX[m.kind] ?? ''}
                            {m.text}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </li>
              ))}
            </ol>
          )}
          {withMoments.length > shown.length && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAll(true)}>
              Ver o arco inteiro ({withMoments.length} cenas) <ArrowRight size={14} />
            </button>
          )}
        </>
      )}
    </Fold>
  )
}
