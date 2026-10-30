import { CheckCircle2, ChevronRight, EyeOff, Wand2 } from 'lucide-react'
import { useMemo } from 'react'
import { LOOK_KINDS } from '../export/bookPath'
import { updateBook } from '../export/shelf'
import { REVIEW_INFO, applyFix, reviewBook, type ReviewIssue, type ReviewKind } from '../logic/review'
import { fold } from '../logic/text'
import type { BookRecord } from '../model/schema'
import { useWorkspace } from '../state/workspace'
import { Modal } from '../ui/Modal'

/** O que impede um capítulo de sair direito: vem antes de tudo. */
const BEFORE: ReviewKind[] = ['cena-vazia', 'sem-titulo']
const FIXABLE: ReviewKind[] = ['travessao', 'aspas', 'reticencias', 'espacos']
const LOOK_LABEL: Record<(typeof LOOK_KINDS)[number], [string, string]> = {
  'frase-longa': ['frase longa', 'frases longas'],
  repeticao: ['repetição', 'repetições'],
  'cena-curta': ['cena curta', 'cena curta'],
  grafia: ['nome escrito diferente', 'nomes escritos diferente'],
}

/** Quantas palavras repetidas aparecem por cena (as que mais se repetem). */
const TOP_WORDS = 8

/** Quantas vezes cada palavra (sem acento) aparece num texto. */
function wordFreq(text: string): Map<string, number> {
  const m = new Map<string, number>()
  for (const w of text.match(/\p{L}{5,}/gu) ?? []) {
    const k = fold(w)
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return m
}

/**
 * Revisão antes de publicar, em duas partes (como o resumo do ProWritingAid, que vem antes do
 * detalhe): o que o Papirus arruma sozinho, num clique e com desfazer; e o que vale olhar, cena
 * a cena, começando pelas que têm mais. São só apontamentos: o livro é de quem escreve.
 */
export function ReviewDialog({ design, title, onClose }: { design: BookRecord; title: string; onClose: () => void }) {
  const { universe, go, update, undoable, readOnly, toast } = useWorkspace()
  const issues = useMemo(() => reviewBook(universe, design), [universe, design])
  const before = BEFORE.map((k) => ({ kind: k, items: issues.filter((i) => i.kind === k) })).filter((g) => g.items.length)
  const fixes = FIXABLE.map((k) => ({ kind: k, items: issues.filter((i) => i.kind === k) })).filter((g) => g.items.length)
  const look = issues.filter((i) => (LOOK_KINDS as readonly string[]).includes(i.kind))
  // Cena a cena, começando pela que tem mais o que olhar.
  const byScene = [
    ...look
      .reduce((m, i) => m.set(i.sceneId, [...(m.get(i.sceneId) ?? []), i]), new Map<string, ReviewIssue[]>())
      .values(),
  ].sort((a, b) => b.length - a.length)
  const most = byScene[0]?.length ?? 1

  const open = (sceneId: string) => {
    onClose()
    go('escrever', sceneId)
  }
  const fixAll = () => {
    const scenes = new Set(fixes.flatMap((g) => g.items.map((i) => i.sceneId))).size
    undoable(`Tipografia arrumada em ${scenes} ${scenes === 1 ? 'cena' : 'cenas'}.`, (u) => fixes.reduce((acc, g) => applyFix(acc, design, g.kind).universe, u))
  }
  const ignore = (word: string) => {
    update((u) => updateBook(u, design.id, { reviewIgnore: [...design.reviewIgnore, word] }))
    toast(`“${word}” não conta mais como repetição neste livro.`, {
      action: { label: 'Desfazer', run: () => update((u) => updateBook(u, design.id, { reviewIgnore: design.reviewIgnore.filter((w) => w !== word) })) },
    })
  }

  const where = (i: ReviewIssue, key: number) => (
    <li key={key}>
      <button type="button" className="review-item" onClick={() => open(i.sceneId)}>
        <span className="review-where">
          {i.sceneTitle} <ChevronRight size={12} aria-hidden="true" />
        </span>
        <span>{i.message}</span>
        {i.excerpt && <span className="review-excerpt">{i.excerpt}</span>}
      </button>
    </li>
  )

  return (
    <Modal title={`Revisar “${title}”`} size="lg" onClose={onClose} help="revisar-livro">
      <div className="review">
        {issues.length === 0 ? (
          <p className="review-ok">
            <CheckCircle2 size={18} aria-hidden="true" /> Nada para apontar. O livro está pronto para sair.
          </p>
        ) : (
          <p className="muted small">São só apontamentos: o livro é seu.</p>
        )}

        {before.length > 0 && (
          <section className="review-part" aria-label="Antes de tudo">
            <h3 className="section-title">Antes de tudo</h3>
            {before.map((g) => (
              <details key={g.kind} className="review-group">
                <summary>
                  <strong>{REVIEW_INFO[g.kind].title}</strong>
                  <span className="review-count">{g.items.length}</span>
                </summary>
                <p className="muted small">{REVIEW_INFO[g.kind].hint}</p>
                <ul className="review-list">{g.items.slice(0, 40).map(where)}</ul>
              </details>
            ))}
          </section>
        )}

        {fixes.length > 0 && (
          <section className="review-part" aria-label="O Papirus arruma">
            <header className="review-part-head">
              <h3 className="section-title">O Papirus arruma</h3>
              {!readOnly && (
                <button type="button" className="btn btn-primary btn-sm" onClick={fixAll}>
                  <Wand2 size={14} /> Arrumar tudo
                </button>
              )}
            </header>
            <p className="muted small">Tipografia de livro, no livro todo, de uma vez. Dá para desfazer.</p>
            {fixes.map((g) => (
              <details key={g.kind} className="review-group">
                <summary>
                  <strong>{REVIEW_INFO[g.kind].title}</strong>
                  <span className="review-count">
                    {g.items.length} {g.items.length === 1 ? 'cena' : 'cenas'}
                  </span>
                </summary>
                <p className="muted small">{REVIEW_INFO[g.kind].hint}</p>
                <ul className="review-list">{g.items.slice(0, 40).map(where)}</ul>
              </details>
            ))}
          </section>
        )}

        {byScene.length > 0 && (
          <section className="review-part" aria-label="Vale olhar">
            <h3 className="section-title">Vale olhar</h3>
            <p className="muted small">Cena a cena, começando pelas que têm mais. Nada aqui é erro: frases longas e repetições podem ser de propósito.</p>
            <ol className="review-scenes">
              {byScene.map((items) => {
                const counts = LOOK_KINDS.map((k) => [k, items.filter((i) => i.kind === k).length] as const).filter(([, n]) => n)
                // As mais repetidas primeiro (quantas vezes aparecem na cena); o resto fica num número.
                const freq = wordFreq(universe.scenes.find((sc) => sc.id === items[0].sceneId)?.text ?? '')
                const repeated = items
                  .filter((i) => i.kind === 'repeticao' && i.word)
                  .map((i) => ({ word: i.word!, n: freq.get(fold(i.word!)) ?? 2 }))
                  .sort((a, b) => b.n - a.n)
                const words = repeated.slice(0, TOP_WORDS)
                return (
                  <li key={items[0].sceneId}>
                    <details className="review-scene">
                      <summary>
                        <span className="review-scene-head">
                          <strong>{items[0].sceneTitle}</strong>
                          <span className="muted small">{counts.map(([k, n]) => `${n} ${LOOK_LABEL[k][n === 1 ? 0 : 1]}`).join(' · ')}</span>
                        </span>
                        <span className="review-bar" aria-hidden="true">
                          <i style={{ width: `${Math.max(8, (items.length / most) * 100)}%` }} />
                        </span>
                      </summary>
                      {words.length > 0 && (
                        <div className="review-words">
                          <span className="muted small">Repetidas perto:</span>
                          {words.map((w) => (
                            <span key={w.word} className="chip review-word">
                              {w.word} <span className="chip-count">×{w.n}</span>
                              {!readOnly && (
                                <button type="button" className="chip-x" aria-label={`Ignorar “${w.word}” neste livro`} title="É tema do livro: não apontar mais" onClick={() => ignore(w.word)}>
                                  <EyeOff size={12} />
                                </button>
                              )}
                            </span>
                          ))}
                          {repeated.length > words.length && <span className="muted small">e mais {repeated.length - words.length}</span>}
                          {!readOnly && <span className="muted tiny review-words-hint">O olho riscado ignora uma palavra que é tema do livro.</span>}
                        </div>
                      )}
                      <ul className="review-list">{items.filter((i) => i.kind !== 'repeticao').slice(0, 20).map(where)}</ul>
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => open(items[0].sceneId)}>
                        Abrir a cena
                      </button>
                    </details>
                  </li>
                )
              })}
            </ol>
          </section>
        )}
        {design.reviewIgnore.length > 0 && !readOnly && (
          <p className="muted tiny">
            Ignoradas neste livro: {design.reviewIgnore.join(', ')}.{' '}
            <button type="button" className="link-btn" onClick={() => update((u) => updateBook(u, design.id, { reviewIgnore: [] }))}>
              Voltar a apontar
            </button>
          </p>
        )}
      </div>
    </Modal>
  )
}
