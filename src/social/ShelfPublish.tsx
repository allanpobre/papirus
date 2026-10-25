import { isLocalOnly } from '../model/sample'
import { Globe, Lock, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { authClient, useAccount } from '../account/auth'
import { CHAPTER_EMOJIS, chapterReactions, tally, type ChapterReaction } from './chapterReactions'
import { updateBook } from '../export/shelf'
import type { BookRecord } from '../model/schema'
import { useWorkspace } from '../state/workspace'
import { shelfId, VISIBILITY_LABEL, type ShelfVisibility } from './social'
import type { ShelfSyncState } from './useShelfSync'

const ICON = { privado: Lock, amigos: Users, publico: Globe } as const
const HINT: Record<ShelfVisibility, string> = {
  privado: 'Não aparece no seu perfil.',
  amigos: 'Só quem é seu amigo no Papirus vê na sua estante.',
  publico: 'Qualquer pessoa que abrir seu perfil vê.',
}

/** Mostrar (ou não) este livro na estante do perfil. Só a vitrine vai: capa, título, sinopse, números. */
export function ShelfPublish({ book, title, status, onSocial }: { book: BookRecord; title: string; status: ShelfSyncState; onSocial?: () => void }) {
  const { update, universe } = useWorkspace()
  const { user } = useAccount()
  const set = (changes: Partial<BookRecord>) => update((u) => updateBook(u, book.id, changes))

  return (
    <section className="shelf-publish" aria-labelledby="estante-perfil">
      <h2 id="estante-perfil" className="shelf-publish-title">
        Na estante do seu perfil
      </h2>
      {isLocalOnly(universe) ? (
        <p className="muted small">No exemplo, não: ele fica só neste aparelho. Nos seus universos, “{title}” pode aparecer no seu perfil, para amigos ou para todo mundo.</p>
      ) : !user ? (
        <p className="muted small">Com uma conta, você pode mostrar “{title}” no seu perfil, para amigos ou para todo mundo. O texto do livro não vai junto.</p>
      ) : (
        <>
          <div className="segmented" role="radiogroup" aria-label={`Quem vê “${title}” no seu perfil`}>
            {(['privado', 'amigos', 'publico'] as const).map((v) => {
              const Icon = ICON[v]
              return (
                <button key={v} type="button" role="radio" aria-checked={book.shelfVisibility === v} className="segmented-option" onClick={() => set({ shelfVisibility: v })}>
                  <Icon size={14} aria-hidden="true" /> {VISIBILITY_LABEL[v]}
                </button>
              )
            })}
          </div>
          <p className="muted tiny">
            {HINT[book.shelfVisibility]} {book.shelfReadable && book.shelfVisibility !== 'privado' ? 'Vão a vitrine e o texto (sem o que é secreto).' : 'Vai só a vitrine: capa, título, sinopse e números.'}
            {book.shelfVisibility !== 'privado' && ' Voltar para “Só eu” apaga os comentários, os “quero ler” e as reações deste livro.'}
          </p>
          {book.shelfVisibility !== 'privado' && (
            <label className="toggle small">
              <input type="checkbox" role="switch" checked={book.shelfReadable} onChange={(e) => set({ shelfReadable: e.target.checked })} />
              <span className="toggle-track" aria-hidden="true" />
              <span>Deixar ler o livro ali mesmo: quem vê lê, reage a cada capítulo e continua de onde parou</span>
            </label>
          )}
          {book.shelfVisibility !== 'privado' && (
            <label className="shelf-publish-blurb">
              <span className="field-label">Sinopse (contracapa)</span>
              <textarea className="input" rows={3} maxLength={2000} value={book.blurb} placeholder="Duas ou três frases que dão vontade de ler." onChange={(e) => set({ blurb: e.target.value })} />
            </label>
          )}
          <p className="muted tiny" role="status">
            {status.state === 'enviando'
              ? 'Atualizando a estante…'
              : status.state === 'erro'
                ? `Não atualizou: ${status.error}`
                : status.state === 'ok'
                  ? `${status.shown === 0 ? 'Nenhum livro deste universo' : status.shown === 1 ? '1 livro deste universo' : `${status.shown} livros deste universo`} no seu perfil.`
                  : ''}{' '}
            {onSocial && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={onSocial}>
                Ver meu perfil
              </button>
            )}
          </p>
          {book.shelfVisibility !== 'privado' && book.shelfReadable && <ReactionSummary bookId={shelfId(universe.id, book.id)} />}
        </>
      )}
    </section>
  )
}

/** Para quem escreveu: como os leitores reagiram a cada capítulo. */
function ReactionSummary({ bookId }: { bookId: string }) {
  const { universe } = useWorkspace()
  const { user, server } = useAccount()
  const [list, setList] = useState<ChapterReaction[] | null>(null)
  useEffect(() => {
    if (!user || !server) return
    let off = false
    void authClient(server)
      .then((sb) => chapterReactions(sb, user.id, bookId))
      .then((r) => !off && setList(r))
      .catch(() => undefined)
    return () => {
      off = true
    }
  }, [user, server, bookId])
  if (!list?.length) return null
  const counts = tally(list)
  const rows = [...counts]
    .map(([sceneId, c]) => ({ sceneId, c, total: Object.values(c).reduce((n, v) => n + (v ?? 0), 0), title: universe.scenes.find((s) => s.id === sceneId)?.title || 'Capítulo' }))
    .sort((a, b) => b.total - a.total)
  return (
    <section className="reaction-summary" aria-label="Reações dos leitores">
      <h3 className="section-label">Reações dos leitores</h3>
      <ul>
        {rows.map((r) => (
          <li key={r.sceneId}>
            <span className="small">{r.title}</span>
            <span className="reaction-summary-emojis small">
              {CHAPTER_EMOJIS.filter((e) => r.c[e]).map((e) => (
                <span key={e}>
                  {e} {r.c[e]}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
