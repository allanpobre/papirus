import { useMemo } from 'react'
import { APPEARANCE_LABEL, appearancesOf, presenceStrip, snippetParts, type Appearance } from '../logic/appearances'
import type { Entity } from '../model/schema'
import { sceneTitle } from '../model/universe'
import { useWorkspace } from '../state/workspace'
import { askSceneFind } from './write/sceneFind'

/**
 * Onde a ficha aparece no manuscrito, como o X-Ray do Kindle: uma tira com todas as cenas (as dela
 * acesas, pela força do papel) e a lista das cenas, com o nome em destaque no trecho. Tocar abre a
 * cena já no lugar em que ela aparece.
 */
export function AppearanceList({
  entity,
  appearances: given,
  empty,
  upto = null,
  onlyUpto = false,
}: {
  entity: Entity
  appearances?: Appearance[]
  empty?: React.ReactNode
  /** O ponto da história (posição da cena): as casinhas depois dele ficam apagadas. */
  upto?: number | null
  /** Como o leitor: as cenas depois do ponto nem aparecem como botão. */
  onlyUpto?: boolean
}) {
  const { universe, go } = useWorkspace()
  const appearances = useMemo(() => given ?? appearancesOf(universe, entity), [given, universe, entity])
  const strip = useMemo(() => presenceStrip(universe, appearances), [universe, appearances])
  // Como o leitor, o livro "acaba" no ponto escolhido.
  const total = onlyUpto && upto !== null ? upto + 1 : strip.reduce((n, g) => n + g.dots.length, 0)
  const mentions = appearances.reduce((n, a) => n + a.found.length, 0)
  const books = strip.filter((g) => g.dots.some((d) => d.role)).length > 1

  const open = (a: Pick<Appearance, 'scene' | 'found'>) => {
    const first = a.found[0]
    if (first) askSceneFind(a.scene.id, a.scene.text.slice(first.from, first.to))
    go('escrever', a.scene.id)
  }
  const byScene = new Map(appearances.map((a) => [a.scene.id, a]))

  if (!appearances.length) return <>{empty ?? null}</>
  return (
    <div className="appear">
      <p className="appear-sum small">
        Em <strong>{appearances.length}</strong> de {total} {total === 1 ? 'cena' : 'cenas'}
        {mentions > 0 && (
          <>
            {' '}
            · <strong>{mentions}</strong> {mentions === 1 ? 'menção' : 'menções'} pelo nome
          </>
        )}
      </p>
      <div className="presence" role="group" aria-label="Onde aparece, cena a cena">
        {strip.map((g) => (
          <div key={g.storyId ?? 'soltas'} className="presence-book">
            {strip.length > 1 && <span className="presence-book-title tiny muted">{g.title}</span>}
            <ol className="presence-strip">
              {g.dots.map((d, i) => (
                <li key={d.scene.id} className={upto !== null && d.position > upto ? 'is-after' : undefined}>
                  {d.role && !(onlyUpto && upto !== null && d.position > upto) ? (
                    <button
                      type="button"
                      className={`presence-dot is-${d.role}`}
                      title={`${i + 1}. ${sceneTitle(d.scene)}: ${APPEARANCE_LABEL[d.role]}`}
                      aria-label={`${sceneTitle(d.scene)}: ${APPEARANCE_LABEL[d.role]}`}
                      onClick={() => open(byScene.get(d.scene.id) ?? { scene: d.scene, found: [] })}
                    />
                  ) : (
                    <span className="presence-dot" title={`${i + 1}. ${sceneTitle(d.scene)}`} aria-hidden="true" />
                  )}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
      <ul className="appearances" aria-label="Cenas">
        {appearances.map((a) => {
          const parts = snippetParts(a.scene.text, a.found, 0, 70)
          const story = books ? universe.stories.find((st) => st.id === a.scene.storyId) : undefined
          return (
            <li key={a.scene.id}>
              <button type="button" className="appear-open" onClick={() => open(a)}>
                {story && <span className="tiny muted appear-book">{story.title || 'Sem título'} · </span>}
                <span className="appear-title">{sceneTitle(a.scene)}</span>
              </button>
              <span className="appear-roles">
                {a.roles.map((r) => (
                  <span key={r} className={`appear-role is-${r}`}>
                    {APPEARANCE_LABEL[r]}
                  </span>
                ))}
                {a.found.length > 1 && <span className="appear-count tiny muted">{a.found.length} menções</span>}
              </span>
              {parts.length > 0 && (
                <p className="appearance-snippet">
                  {parts.map((p, i) => (p.mark ? <mark key={i} className="appear-name">{p.text}</mark> : <span key={i}>{p.text}</span>))}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
