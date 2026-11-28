import { Check, FolderTree, Globe2, Repeat } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { Collection, Story } from '../model/schema'
import { bookIdsOf, bookScenes, chosenBook, collectionBookId, looseStories } from '../model/universe'
import { useWorkspace } from '../state/workspace'
import { GeneratedCover } from './GeneratedCover'
import { Modal } from './Modal'
import { CollectionsEditor } from './CollectionsEditor'

/*
 * Mundo → livro (Nova cara): num universo com vários livros, escolher o livro é um passo de verdade, como
 * escolher o save num jogo. As capas no Início e, em todas as telas, uma faixa fixa que diz sempre onde se
 * está ("Terra de Oz › O Mágico de Oz") com "Trocar livro".
 */

/** As capas dos livros do universo, agrupadas em coleções (uma dentro da outra), e "o mundo todo". */
export function BookCovers({ onPicked }: { onPicked?: () => void }) {
  const { universe, bookId, setBookId, readOnly } = useWorkspace()
  const [organizing, setOrganizing] = useState(false)
  const chosen = bookIdsOf(bookId) ?? []
  const pick = (id: string | null) => {
    setBookId(id)
    onPicked?.()
  }
  const cover = (s: Story) => {
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
  }
  // Uma coleção: "todos os livros dela" (com os das de dentro), os livros e as coleções de dentro.
  const group = (c: Collection, depth: number, seen: string[]): ReactNode => {
    if (seen.includes(c.id)) return null
    const mine = universe.stories.filter((s) => s.collectionId === c.id)
    const value = collectionBookId(universe, c.id)
    const on = value !== null && bookId === value
    const inside = universe.collections.filter((x) => x.parentId === c.id)
    return (
      <section key={c.id} className="book-collection" role="group" aria-label={`Coleção ${c.name}`} style={{ marginInlineStart: depth * 12 }}>
        <div className="book-collection-head">
          <h3 className="book-collection-name">{c.name || 'Sem nome'}</h3>
          {value && (
            <button type="button" role="radio" aria-checked={on} className={`btn btn-sm${on ? ' is-on' : ''}`} onClick={() => pick(value)}>
              {on && <Check size={14} aria-hidden="true" />} Todos de {c.name || 'esta coleção'}
            </button>
          )}
        </div>
        <div className="book-covers" role="radiogroup" aria-label={`Livros de ${c.name}`}>
          {mine.map(cover)}
        </div>
        {inside.map((x) => group(x, depth + 1, [...seen, c.id]))}
      </section>
    )
  }
  const loose = looseStories(universe)
  const roots = universe.collections.filter((c) => !c.parentId || !universe.collections.some((p) => p.id === c.parentId))
  return (
    <div className="book-collections">
      {roots.map((c) => group(c, 0, []))}
      <div className="book-covers" role="radiogroup" aria-label="Livros deste mundo">
        {loose.map(cover)}
        <button type="button" role="radio" aria-checked={!bookId} className={`book-cover-pick is-world${!bookId ? ' is-on' : ''}`} onClick={() => pick(null)}>
          <span className="book-cover-art">
            <Globe2 size={30} aria-hidden="true" />
            <span className="book-cover-title">Todos os livros</span>
          </span>
          <span className="tiny muted">o mundo inteiro</span>
        </button>
      </div>
      <button type="button" className="btn btn-ghost btn-sm book-collections-edit" onClick={() => setOrganizing(true)}>
        <FolderTree size={15} aria-hidden="true" /> {readOnly ? 'Ver as coleções' : universe.collections.length ? 'Organizar coleções' : 'Agrupar em coleções'}
      </button>
      {organizing && <CollectionsEditor onClose={() => setOrganizing(false)} />}
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
/** Onde o livro escolhido não muda nada do que se vê (a Mesa, a Oficina, o Guia, as Ideias): a faixa nem aparece. */
const BAND_HIDDEN = ['rpg', 'oficina', 'guia', 'inbox', 'config']

export function BookBand({ view }: { view?: string }) {
  const { universe, bookId } = useWorkspace()
  const [open, setOpen] = useState(false)
  if (universe.stories.length < 2 || (view && BAND_HIDDEN.includes(view))) return null
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
          <Repeat size={14} aria-hidden="true" /> Trocar<span className="sr-only"> livro</span>
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
