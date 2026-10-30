import { ChevronRight, MessageCircle } from 'lucide-react'
import { isLocalOnly } from '../model/sample'
import { CHAPTER_EMOJIS, tally } from '../social/chapterReactions'
import { useWorkspace } from '../state/workspace'
import { Modal } from '../ui/Modal'
import type { BookReaders } from './readersData'
import { saveMode } from './write/WritingModes'

/** A janela: cada capítulo com as reações e os comentários; tocar leva à cena, na Revisão. */
export function BookReadersDialog({ readers, title, onClose }: { readers: BookReaders; title: string; onClose: () => void }) {
  const { go, openShare, universe } = useWorkspace()
  const counts = tally(readers.reactions)
  const rows = readers.scenes.map((s, i) => ({ scene: s, n: i + 1, notes: readers.feedback.filter((f) => f.scene_id === s.id), reacts: counts.get(s.id) ?? {} })).filter((r) => r.notes.length || Object.keys(r.reacts).length)
  const open = (sceneId: string) => {
    saveMode('revisao')
    onClose()
    go('escrever', sceneId)
  }
  return (
    <Modal title={`O que os leitores disseram: “${title}”`} size="lg" onClose={onClose}>
      <div className="book-readers">
        {!readers.available ? (
          <p className="muted">
            {isLocalOnly(universe)
              ? 'No exemplo, não há leitores: ele fica só neste aparelho.'
              : 'Com uma conta, mande o link de leitura (em Compartilhar). Quem lê comenta trechos, e quem lê na sua estante reage a cada capítulo. Tudo aparece aqui, capítulo a capítulo, e na margem da Revisão.'}
          </p>
        ) : rows.length === 0 ? (
          <p className="muted">Ninguém comentou ainda. Mande o link de leitura: quem lê comenta trechos, e cada comentário aparece aqui e na margem da Revisão.</p>
        ) : (
          <ol className="book-readers-list">
            {rows.map(({ scene, n, notes, reacts }) => {
              const pending = notes.filter((f) => !f.resolved)
              return (
                <li key={scene.id}>
                  <button type="button" className="book-readers-row" onClick={() => open(scene.id)}>
                    <span className="book-readers-head">
                      <strong>
                        {n}. {scene.title || 'Sem título'}
                      </strong>
                      {pending.length > 0 && (
                        <span className="chip chip-warn">
                          {pending.length} {pending.length === 1 ? 'aberto' : 'abertos'}
                        </span>
                      )}
                      {CHAPTER_EMOJIS.filter((e) => reacts[e]).map((e) => (
                        <span key={e} className="book-readers-react">
                          {e} {reacts[e]}
                        </span>
                      ))}
                      <ChevronRight size={14} aria-hidden="true" className="book-readers-go" />
                    </span>
                    {(pending.length ? pending : notes).slice(0, 2).map((f) => (
                      <span key={f.id} className="book-readers-note">
                        {f.quote && <q>{f.quote}</q>}
                        <span>
                          <MessageCircle size={12} aria-hidden="true" /> {f.body} <span className="muted">— {f.author_name || 'Leitor'}</span>
                        </span>
                      </span>
                    ))}
                  </button>
                </li>
              )
            })}
          </ol>
        )}
        {readers.available && (
          <button type="button" className="btn btn-sm" onClick={openShare}>
            Mandar o link de leitura
          </button>
        )}
      </div>
    </Modal>
  )
}
