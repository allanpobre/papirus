import { X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { buildBook, defaultDesign, fontsOf } from '../export/bookDesign'
import { fontFaces } from '../export/bookFonts'
import { shelf } from '../export/shelf'
import { prepareBookImages } from '../images/bookImages'
import { useWorkspace } from '../state/workspace'
import { useBackLayer } from '../ui/useBackLayer'
import { FLIP_CSS, FLIP_JS } from './flip'
import { pagedDocument } from './pagedDocument'

/**
 * Folhear o livro como ele vai sair: as páginas da diagramação (as mesmas do PDF), em um livro
 * aberto que vira. Nada aqui muda o livro: fonte, tamanho e capa vêm de Diagramar.
 */
export default function BookFlip({ bookId, onClose }: { bookId: string; onClose: () => void }) {
  const { universe } = useWorkspace()
  useBackLayer(onClose)
  // O livro como estava ao abrir (paginar de novo a cada mudança no universo seria pesado).
  const [snapshot] = useState(universe)
  const design = useMemo(() => shelf(snapshot).find((b) => b.id === bookId) ?? defaultDesign(), [snapshot, bookId])
  const [imagesReady, setImagesReady] = useState(false)
  const [pages, setPages] = useState<number | null>(null)

  useEffect(() => {
    let off = false
    void prepareBookImages(snapshot).finally(() => !off && setImagesReady(true))
    return () => {
      off = true
    }
  }, [snapshot])

  const book = useMemo(() => (imagesReady ? buildBook(snapshot, design) : null), [snapshot, design, imagesReady])
  const doc = useMemo(
    () => (book ? pagedDocument(book.title, book.html, book.css, fontFaces(fontsOf(design)), FLIP_CSS, false, { headJs: FLIP_JS, afterJs: 'papirusFlip()' }) : ''),
    [book, design],
  )

  // Só ouve a página do próprio livro (outra janela não fecha o Folhear nem muda a contagem).
  const frame = useRef<HTMLIFrameElement>(null)
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return
      if (typeof e.data?.papirusPaged === 'number') setPages(e.data.papirusPaged)
      if (e.data?.papirusFlipClose) onClose()
    }
    addEventListener('message', onMessage)
    return () => removeEventListener('message', onMessage)
  }, [onClose])

  return createPortal(
    <div className="book-flip" role="dialog" aria-modal="true" aria-label={`Folhear ${book?.title ?? 'o livro'}`}>
      <header className="book-flip-top">
        <strong className="book-flip-title">{book?.title ?? 'Livro'}</strong>
        <span className="book-flip-status small" role="status">
          {pages === null ? 'Montando as páginas…' : `${pages} ${pages === 1 ? 'página' : 'páginas'}, como na diagramação`}
        </span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
          <X size={16} aria-hidden="true" /> Fechar
        </button>
      </header>
      {doc && <iframe ref={frame} className="book-flip-frame" title="Folhear o livro" srcDoc={doc} />}
    </div>,
    document.body,
  )
}
