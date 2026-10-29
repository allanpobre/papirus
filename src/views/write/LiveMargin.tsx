import { Check, Eye, RotateCcw, ScanSearch, Sparkles, Trash2, UserCheck } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { factSentence } from '../../logic/codex'
import { isOpen, type Question } from '../../logic/continuity'
import type { MentionMatcher } from '../../logic/detection'
import { mentionIdsInDoc } from '../../logic/doc'
import { knowledgeAt } from '../../logic/knowledge'
import { KNOWLEDGE_LABEL, SEED_STATUS_LABEL } from '../../model/labels'
import type { Scene } from '../../model/schema'
import { entityName, updateScene } from '../../model/universe'
import { useWorkspace } from '../../state/workspace'
import { CanonBadge } from '../../ui/bits'
import { BetaReadersSection } from './BetaReaders'
import { QuestionCard } from './QuestionCard'
import { useSettled } from '../../ui/useSettled'

interface Props {
  scene: Scene
  paragraph: string
  matcher: MentionMatcher | null
  questions: Question[]
  candidates: number
  onReview: () => void
  /** Em telas estreitas, a margem abre como painel por cima do texto. */
  overlay?: boolean
  onClose?: () => void
  focusedComment?: string | null
  /** Tira a marca do comentário do texto (o editor é quem sabe onde ela está). */
  onRemoveCommentMark?: (id: string) => void
  /** O que vem antes de tudo (na Revisão: a lista da cena). */
  top?: ReactNode
}

/**
 * Margem viva: o contexto da cena e do parágrafo onde está o cursor. Só mostra;
 * não interrompe e não muda nada sem um clique do autor.
 */
export function LiveMargin({ scene, paragraph, matcher, questions, candidates, onReview, overlay, onClose, focusedComment, onRemoveCommentMark, top }: Props) {
  const { universe, update, peek, go } = useWorkspace()

  const here = useMemo(() => {
    if (!matcher) return []
    return [...new Set(matcher.find(paragraph).map((m) => m.entityId))]
  }, [matcher, paragraph])

  // Quem é citado na cena inteira: recalcula depois de uma pausa na digitação.
  // O texto espera a pausa; POV e presentes mudam na hora.
  const calmText = useSettled(scene.text)
  const calmDoc = useSettled(scene.doc)
  const entities = universe.entities
  const { povId, presentIds, placeId } = scene
  const cast = useMemo(() => {
    const mentioned = new Set([...(matcher?.find(calmText).map((m) => m.entityId) ?? []), ...mentionIdsInDoc(calmDoc)])
    const ids = new Set([povId, ...presentIds, ...mentioned].filter(Boolean) as string[])
    ids.delete(placeId ?? '')
    return [...ids]
      .map((id) => entities.find((e) => e.id === id))
      .filter((e) => e !== undefined)
      .map((e) => ({
        entity: e,
        role: povId === e.id ? 'POV' : presentIds.includes(e.id) ? 'presente' : 'mencionado',
      }))
      .sort((a, b) => (a.role === b.role ? a.entity.name.localeCompare(b.entity.name, 'pt') : a.role === 'POV' ? -1 : b.role === 'POV' ? 1 : a.role === 'presente' ? -1 : 1))
  }, [matcher, calmText, calmDoc, entities, povId, presentIds, placeId])

  const povKnows = useMemo(() => (scene.povId ? knowledgeAt(universe, scene.povId, scene.id) : []), [universe, scene.povId, scene.id])
  const facts = universe.facts.filter((f) => f.sourceSceneId === scene.id)
  const castIds = new Set(cast.map((c) => c.entity.id))
  const seeds = universe.seeds.filter(
    (s) =>
      s.setupSceneId === scene.id ||
      s.payoffSceneId === scene.id ||
      s.clues.some((c) => c.sceneId === scene.id) ||
      ((s.status === 'aberta' || s.status === 'parcial') && s.entityIds.some((id) => castIds.has(id))),
  )
  const open = questions.filter(isOpen)

  return (
    <aside className={`margin${overlay ? ' write-overlay write-overlay-right' : ''}`} aria-label="Margem viva" data-tour="margem">
      {overlay && (
        <button type="button" className="btn btn-ghost btn-sm margin-close" onClick={onClose}>
          Fechar margem
        </button>
      )}
      {top}
      <CommentsSection scene={scene} focused={focusedComment ?? null} onRemoveMark={onRemoveCommentMark} />
      <BetaReadersSection sceneId={scene.id} />

      {here.length > 0 && (
        <section className="margin-section margin-here">
          <h3 className="section-label">Neste parágrafo</h3>
          <div className="chips">
            {here.map((id) => (
              <button key={id} type="button" className="chip chip-entity" onClick={() => peek(id)}>
                {entityName(universe, id)}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="margin-section">
        <h3 className="section-label">Na cena</h3>
        {cast.length === 0 ? (
          <p className="muted small">Ninguém por aqui ainda. Nomes de fichas aparecem sozinhos quando você os escreve.</p>
        ) : (
          <ul className="cast">
            {cast.map(({ entity, role }) => (
              <li key={entity.id}>
                <button type="button" className="cast-name" onClick={() => peek(entity.id)}>
                  {entity.name}
                </button>
                <span className={`cast-role role-${role}`}>{role}</span>
                {role === 'mencionado' ? (
                  <button
                    type="button"
                    className="btn-icon btn-xs"
                    title="Marcar como presente na cena"
                    aria-label={`Marcar ${entity.name} como presente`}
                    onClick={() => update((u) => updateScene(u, scene.id, { presentIds: [...scene.presentIds, entity.id] }))}
                  >
                    <UserCheck size={13} />
                  </button>
                ) : role === 'presente' ? (
                  <Check size={13} className="muted" aria-hidden="true" />
                ) : (
                  <Eye size={13} className="muted" aria-hidden="true" />
                )}
              </li>
            ))}
          </ul>
        )}
        {scene.placeId && (
          <p className="margin-place">
            Em{' '}
            <button type="button" className="link-btn" onClick={() => peek(scene.placeId)}>
              {entityName(universe, scene.placeId)}
            </button>
          </p>
        )}
      </section>

      {scene.povId && (
        <section className="margin-section">
          <h3 className="section-label">O que {entityName(universe, scene.povId)} sabe aqui</h3>
          {povKnows.length === 0 ? (
            <p className="muted small">Nada registrado até esta cena.</p>
          ) : (
            <ul className="plain-list small">
              {povKnows.map(({ fact, entry }) => (
                <li key={entry.id}>
                  <span className={`knows knows-${entry.state}`}>{KNOWLEDGE_LABEL[entry.state]}</span> {factSentence(universe, fact)}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {facts.length > 0 && (
        <section className="margin-section">
          <h3 className="section-label">Fatos desta cena</h3>
          <ul className="plain-list small">
            {facts.map((f) => (
              <li key={f.id}>
                {factSentence(universe, f)} <CanonBadge canon={f.canon} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {seeds.length > 0 && (
        <section className="margin-section">
          <h3 className="section-label">Tramas por perto</h3>
          <ul className="plain-list small">
            {seeds.map((s) => (
              <li key={s.id}>
                <button type="button" className="link-btn" onClick={() => go('tramas', s.id)}>
                  {s.title}
                </button>{' '}
                <span className={`seed-status seed-${s.status}`}>{SEED_STATUS_LABEL[s.status]}</span>
                {s.setupSceneId === scene.id && <span className="muted"> · preparada aqui</span>}
                {s.payoffSceneId === scene.id && <span className="muted"> · paga aqui</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {open.length > 0 && (
        <section className="margin-section">
          <h3 className="section-label">Perguntas</h3>
          {open.map((q) => (
            <QuestionCard key={q.key} q={q} compact />
          ))}
        </section>
      )}

      <section className="margin-section margin-review">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onReview}>
          <ScanSearch size={15} /> Revisar
          {candidates > 0 && <span className="count-pill">{candidates} {candidates === 1 ? 'nome novo' : 'nomes novos'}</span>}
        </button>
        <p className="muted tiny">
          <Sparkles size={11} aria-hidden="true" /> Selecione um trecho para vincular, capturar um fato ou criar ficha.
        </p>
      </section>
    </aside>
  )
}

function CommentsSection({ scene, focused, onRemoveMark }: { scene: Scene; focused: string | null; onRemoveMark?: (id: string) => void }) {
  const { update } = useWorkspace()
  const [showResolved, setShowResolved] = useState(false)
  const open = scene.comments.filter((c) => !c.resolved)
  const resolved = scene.comments.filter((c) => c.resolved)
  if (!scene.comments.length) return null
  const setComments = (comments: Scene['comments']) => update((u) => updateScene(u, scene.id, { comments }))
  const list = showResolved ? scene.comments : open

  return (
    <section className="margin-section">
      <h3 className="section-label">Comentários ({open.length})</h3>
      <ul className="comments">
        {list.map((c) => (
          <li key={c.id} className={`comment${c.id === focused ? ' focused' : ''}${c.resolved ? ' resolved' : ''}`}>
            <p className="comment-quote">“{c.quote.length > 90 ? `${c.quote.slice(0, 90)}…` : c.quote}”</p>
            <textarea
              className="input textarea comment-text"
              aria-label="Texto do comentário"
              rows={2}
              value={c.text}
              onChange={(e) => setComments(scene.comments.map((x) => (x.id === c.id ? { ...x, text: e.target.value } : x)))}
            />
            <div className="comment-actions">
              {c.resolved ? (
                <button type="button" className="btn btn-ghost btn-xs" onClick={() => setComments(scene.comments.map((x) => (x.id === c.id ? { ...x, resolved: false } : x)))}>
                  <RotateCcw size={12} /> Reabrir
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() => {
                    onRemoveMark?.(c.id)
                    setComments(scene.comments.map((x) => (x.id === c.id ? { ...x, resolved: true } : x)))
                  }}
                >
                  <Check size={12} /> Resolver
                </button>
              )}
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => {
                  onRemoveMark?.(c.id)
                  setComments(scene.comments.filter((x) => x.id !== c.id))
                }}
              >
                <Trash2 size={12} /> Apagar
              </button>
            </div>
          </li>
        ))}
      </ul>
      {resolved.length > 0 && (
        <button type="button" className="link-btn tiny" onClick={() => setShowResolved(!showResolved)}>
          {showResolved ? 'Esconder resolvidos' : `Ver ${resolved.length} resolvidos`}
        </button>
      )}
    </section>
  )
}
