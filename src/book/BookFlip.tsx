import { X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { buildBook, defaultDesign, fontsOf, PAGE_SIZES, previewCss } from '../export/bookDesign'
import { fontFaces } from '../export/bookFonts'
import { shelf } from '../export/shelf'
import { prepareBookImages } from '../images/bookImages'
import { isImageRef } from '../images/ref'
import { imageDataUrl } from '../images/resolve'
import type { Universe } from '../model/schema'
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
  return <BookFlipView universe={universe} bookId={bookId} onClose={onClose} />
}

/** Como ver o livro pronto: folheando, ou as páginas da diagramação uma embaixo da outra. */
export type BookLook = 'folhear' | 'paginas'

/**
 * O livro pronto, de qualquer universo (o próprio ou a cópia de leitura de um amigo na estante).
 * Só mostra: quem escreveu decide tudo em Diagramar.
 */
export function BookFlipView({ universe, bookId, onClose, look = 'folhear' }: { universe: Universe; bookId: string; onClose: () => void; look?: BookLook }) {
  useBackLayer(onClose)
  // O livro como estava ao abrir (paginar de novo a cada mudança no universo seria pesado).
  const [snapshot] = useState(universe)
  const design = useMemo(() => shelf(snapshot).find((b) => b.id === bookId) ?? shelf(snapshot)[0] ?? defaultDesign(), [snapshot, bookId])
  const [imagesReady, setImagesReady] = useState(false)
  const [pages, setPages] = useState<number | null>(null)
  // Capa de um livro de outra pessoa: vem como referência e é baixada agora, na hora de mostrar.
  const [covers, setCovers] = useState<{ cover: string | null; backCover: string | null }>({ cover: null, backCover: null })

  useEffect(() => {
    let off = false
    const fetchCover = (v: string | null) => (isImageRef(v) ? imageDataUrl(v).catch(() => null) : Promise.resolve(v))
    void Promise.all([prepareBookImages(snapshot), fetchCover(design.cover), fetchCover(design.backCover)])
      .then(([, cover, backCover]) => !off && setCovers({ cover, backCover }))
      .finally(() => !off && setImagesReady(true))
    return () => {
      off = true
    }
  }, [snapshot, design])

  const book = useMemo(() => (imagesReady ? buildBook(snapshot, { ...design, ...covers }) : null), [snapshot, design, covers, imagesReady])
  const doc = useMemo(
    () =>
      !book
        ? ''
        : look === 'paginas'
          ? pagedDocument(book.title, book.html, book.css, fontFaces(fontsOf(design)), previewCss(design), false)
          : pagedDocument(book.title, book.html, book.css, fontFaces(fontsOf(design)), FLIP_CSS, false, { headJs: FLIP_JS, afterJs: 'papirusFlip()' }),
    [book, design, look],
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

  // As páginas cabem na largura da tela (no celular, uma página inteira por vez).
  useEffect(() => {
    if (look !== 'paginas' || pages === null || !frame.current) return
    const pageWidthPx = PAGE_SIZES[design.pageSize].w * 3.7795
    const zoom = Math.max(0.3, Math.min(1.2, +((frame.current.clientWidth - 32) / pageWidthPx).toFixed(2)))
    frame.current.contentDocument?.body?.style.setProperty('zoom', String(zoom))
  }, [look, pages, design.pageSize])

  return createPortal(
    <div className={`book-flip${look === 'paginas' ? ' is-pages' : ''}`} role="dialog" aria-modal="true" aria-label={`${look === 'paginas' ? 'Páginas de' : 'Folhear'} ${book?.title ?? 'o livro'}`}>
      <header className="book-flip-top">
        <strong className="book-flip-title">{book?.title ?? 'Livro'}</strong>
        <span className="book-flip-status small" role="status">
          {pages === null ? 'Montando as páginas…' : `${pages} ${pages === 1 ? 'página' : 'páginas'}, como na diagramação`}
        </span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
          <X size={16} aria-hidden="true" /> Fechar
        </button>
      </header>
      {doc && <iframe ref={frame} className="book-flip-frame" title={look === 'paginas' ? 'As páginas do livro' : 'Folhear o livro'} srcDoc={doc} />}
    </div>,
    document.body,
  )
}
