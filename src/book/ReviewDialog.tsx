import { CheckCircle2, ChevronRight, Wand2 } from 'lucide-react'
import { useMemo } from 'react'
import { REVIEW_INFO, applyFix, reviewBook, type ReviewKind } from '../logic/review'
import type { BookDesign } from '../model/schema'
import { useWorkspace } from '../state/workspace'
import { Modal } from '../ui/Modal'

const ORDER: ReviewKind[] = ['cena-vazia', 'sem-titulo', 'travessao', 'aspas', 'reticencias', 'espacos', 'grafia', 'frase-longa', 'repeticao', 'cena-curta']

/** Revisão antes de publicar: o que achou, onde está, e as correções de tipografia num clique. */
export function ReviewDialog({ design, title, onClose }: { design: BookDesign; title: string; onClose: () => void }) {
  const { universe, go, undoable, readOnly } = useWorkspace()
  const issues = useMemo(() => reviewBook(universe, design), [universe, design])
  const groups = ORDER.map((k) => ({ kind: k, items: issues.filter((i) => i.kind === k) })).filter((g) => g.items.length)

  return (
    <Modal title={`Revisar “${title}”`} size="lg" onClose={onClose} help="revisar-livro">
      <div className="review">
        {groups.length === 0 ? (
          <p className="review-ok">
            <CheckCircle2 size={18} aria-hidden="true" /> Nada para apontar. O livro está pronto para sair.
          </p>
        ) : (
          <p className="muted small">São só apontamentos: o livro é seu. A tipografia dá para corrigir no livro todo, com desfazer.</p>
        )}
        {groups.map((g) => {
          const info = REVIEW_INFO[g.kind]
          const scenes = new Set(g.items.map((i) => i.sceneId)).size
          return (
            <details key={g.kind} className="review-group" open={groups.length <= 3}>
              <summary>
                <strong>{info.title}</strong>
                <span className="review-count">{g.items.length}</span>
              </summary>
              <p className="muted small">{info.hint}</p>
              {info.fixable && !readOnly && (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => undoable(`${info.title}: corrigido em ${scenes} ${scenes === 1 ? 'cena' : 'cenas'}.`, (u) => applyFix(u, design, g.kind).universe)}
                >
                  <Wand2 size={14} /> Corrigir no livro todo
                </button>
              )}
              <ul className="review-list">
                {g.items.slice(0, 40).map((i, n) => (
                  <li key={n}>
                    <button
                      type="button"
                      className="review-item"
                      onClick={() => {
                        onClose()
                        go('escrever', i.sceneId)
                      }}
                    >
                      <span className="review-where">
                        {i.sceneTitle} <ChevronRight size={12} aria-hidden="true" />
                      </span>
                      <span>{i.message}</span>
                      {i.excerpt && <span className="review-excerpt">{i.excerpt}</span>}
                    </button>
                  </li>
                ))}
              </ul>
              {g.items.length > 40 && <p className="muted tiny">E mais {g.items.length - 40}.</p>}
            </details>
          )
        })}
      </div>
    </Modal>
  )
}
