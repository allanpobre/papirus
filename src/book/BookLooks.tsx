import { BookOpen, Files } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { shelf } from '../export/shelf'
import type { Universe } from '../model/schema'
import type { BookLook } from './BookFlip'

// O livro pronto (Paged.js) só carrega quando alguém pede para folhear ou ver as páginas.
const BookFlipView = lazy(() => import('./BookFlip').then((m) => ({ default: m.BookFlipView })))

/**
 * Para quem lê um livro de outra pessoa (estante, link de leitura): folhear o livro e ver as
 * páginas como quem escreveu diagramou. Sem livro na estante do universo, não aparece.
 */
export function BookLooks({ universe, bookId }: { universe: Universe; bookId?: string }) {
  const [look, setLook] = useState<BookLook | null>(null)
  const book = shelf(universe).find((b) => b.id === bookId) ?? shelf(universe)[0]
  if (!book) return null
  return (
    <>
      <button type="button" className="btn btn-sm btn-ghost" title="Folhear o livro como ele foi diagramado" onClick={() => setLook('folhear')}>
        <BookOpen size={15} aria-hidden="true" /> <span className="leitor-btn-label">Folhear</span>
      </button>
      <button type="button" className="btn btn-sm btn-ghost" title="Ver as páginas do livro diagramado" onClick={() => setLook('paginas')}>
        <Files size={15} aria-hidden="true" /> <span className="leitor-btn-label">Páginas</span>
      </button>
      {look && (
        <Suspense fallback={null}>
          <BookFlipView universe={universe} bookId={book.id} look={look} onClose={() => setLook(null)} />
        </Suspense>
      )}
    </>
  )
}
