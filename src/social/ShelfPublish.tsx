import { Globe, Lock, Users } from 'lucide-react'
import { useAccount } from '../account/auth'
import { updateBook } from '../export/shelf'
import type { BookRecord } from '../model/schema'
import { useWorkspace } from '../state/workspace'
import { VISIBILITY_LABEL, type ShelfVisibility } from './social'
import type { ShelfSyncState } from './useShelfSync'

const ICON = { privado: Lock, amigos: Users, publico: Globe } as const
const HINT: Record<ShelfVisibility, string> = {
  privado: 'Não aparece no seu perfil.',
  amigos: 'Só quem é seu amigo no Papirus vê na sua estante.',
  publico: 'Qualquer pessoa que abrir seu perfil vê.',
}

/** Mostrar (ou não) este livro na estante do perfil. Só a vitrine vai: capa, título, sinopse, números. */
export function ShelfPublish({ book, title, status, onSocial }: { book: BookRecord; title: string; status: ShelfSyncState; onSocial?: () => void }) {
  const { update } = useWorkspace()
  const { user } = useAccount()
  const set = (changes: Partial<BookRecord>) => update((u) => updateBook(u, book.id, changes))

  return (
    <section className="shelf-publish" aria-labelledby="estante-perfil">
      <h2 id="estante-perfil" className="shelf-publish-title">
        Na estante do seu perfil
      </h2>
      {!user ? (
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
            {HINT[book.shelfVisibility]} Vai só a vitrine: capa, título, sinopse e números. O texto não.
            {book.shelfVisibility !== 'privado' && ' Se o universo tiver link de leitura, quem vê pode abrir o livro.'}
          </p>
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
        </>
      )}
    </section>
  )
}
