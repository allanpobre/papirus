import { Check, Globe2, Repeat } from 'lucide-react'
import { useState } from 'react'
import { bookIdsOf, bookScenes, chosenBook } from '../model/universe'
import { useWorkspace } from '../state/workspace'
import { GeneratedCover } from './GeneratedCover'
import { Modal } from './Modal'

/*
 * Mundo → livro (Nova cara): num universo com vários livros, escolher o livro é um passo de verdade, como
 * escolher o save num jogo. As capas no Início e, em todas as telas, uma faixa fixa que diz sempre onde se
 * está ("Terra de Oz › O Mágico de Oz") com "Trocar livro".
 */

/** As capas dos livros do universo, e "o mundo todo" (todos os livros juntos). */
export function BookCovers({ onPicked }: { onPicked?: () => void }) {
  const { universe, bookId, setBookId } = useWorkspace()
  const chosen = bookIdsOf(bookId) ?? []
  const pick = (id: string | null) => {
    setBookId(id)
    onPicked?.()
  }
  return (
    <div className="book-covers" role="radiogroup" aria-label="Livros deste mundo">
      {universe.stories.map((s) => {
        const on = chosen.length === 1 && chosen[0] === s.id
        return (
          <button key={s.id} type="button" role="radio" aria-checked={on} className={`book-cover-pick${on ? ' is-on' : ''}`} onClick={() => pick(s.id)}>
            <span className="book-cover-art">
              <GeneratedCover name={s.title || 'Sem título'} />
              <span className="book-cover-title">{s.title || 'Sem título'}</span>
              {on && <Check size={16} className="book-cover-check" aria-hidden="true" />}
            </span>
            <span className="tiny muted">{bookScenes(universe, s.id).length} cenas</span>
          </button>
        )
      })}
      <button type="button" role="radio" aria-checked={!bookId} className={`book-cover-pick is-world${!bookId ? ' is-on' : ''}`} onClick={() => pick(null)}>
        <span className="book-cover-art">
          <Globe2 size={30} aria-hidden="true" />
          <span className="book-cover-title">Todos os livros</span>
        </span>
        <span className="tiny muted">o mundo inteiro</span>
      </button>
    </div>
  )
}

/** No Início: "Em qual livro você vai trabalhar?" com as capas. */
export function BookChooser() {
  const { universe } = useWorkspace()
  if (universe.stories.length < 2) return null
  return (
    <section className="book-chooser" aria-label="Em qual livro você vai trabalhar?" data-tour="livro-atual">
      <h2 className="book-chooser-title">Em qual livro você vai trabalhar?</h2>
      <BookCovers />
    </section>
  )
}

/** A faixa fixa no alto: onde se está (mundo › livro) e "Trocar livro". */
export function BookBand() {
  const { universe, bookId } = useWorkspace()
  const [open, setOpen] = useState(false)
  if (universe.stories.length < 2) return null
  const book = chosenBook(universe, bookId)
  return (
    <>
      <div className="book-band" role="region" aria-label="Livro atual" data-tour="livro-atual">
        <span className="book-band-cover" aria-hidden="true">
          {book ? <GeneratedCover name={book.title} /> : <Globe2 size={18} />}
        </span>
        <span className="book-band-text">
          <span className="tiny muted">{universe.name} ›</span>
          <strong>{book?.title ?? 'Todos os livros'}</strong>
        </span>
        <button type="button" className="btn btn-sm book-band-switch" onClick={() => setOpen(true)}>
          <Repeat size={14} aria-hidden="true" /> Trocar livro
        </button>
      </div>
      {open && (
        <Modal about="Num universo com vários livros, escolha em qual você está. Escrever, Mundo e Publicar passam a mostrar só esse livro." title="Trocar de livro" size="sm" onClose={() => setOpen(false)}>
          <BookCovers onPicked={() => setOpen(false)} />
        </Modal>
      )}
    </>
  )
}
