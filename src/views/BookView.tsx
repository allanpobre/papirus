import { BookOpen, BookOpenText, Copy, FileDown, Palette, Plus, Printer, SpellCheck, Trash2 } from 'lucide-react'
import { ReviewDialog } from '../book/ReviewDialog'
import { useMemo, useState } from 'react'
import { BOOK_FONTS } from '../export/bookFonts'
import { BODY_FONT_KEY, PAGE_SIZES, bookContent, bookTitle } from '../export/bookDesign'
import { addBook, removeBook, shelf, storiesOutsideBooks } from '../export/shelf'
import type { BookRecord } from '../model/schema'
import { useWorkspace } from '../state/workspace'
import { ConfirmButton } from '../ui/ConfirmButton'
import { ShelfPublish } from '../social/ShelfPublish'
import { SocialDialog } from '../social/SocialDialog'
import { useShelfSync } from '../social/useShelfSync'
import { BookCard } from './BookCard'

const STYLE_LABEL = { classico: 'clássico', moderno: 'moderno', minimalista: 'minimalista', ornamentado: 'ornamentado', manuscrito: 'manuscrito' } as const

/**
 * A estante: os livros deste universo (volumes de uma série, contos, edições).
 * Cada livro tem capa, histórias e diagramação próprias; dá para copiar o estilo de outro.
 */
export default function BookView() {
  const { universe, update, openBookDesigner, openReader, readOnly, toast, source, prefs } = useWorkspace()
  const shelfStatus = useShelfSync()
  const [socialOpen, setSocialOpen] = useState(false)
  const books = useMemo(() => shelf(universe), [universe])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = books.find((b) => b.id === selectedId) ?? books[0] ?? null
  const [adding, setAdding] = useState(false)
  const [reviewing, setReviewing] = useState<string | null>(null)
  const reviewBookRecord = books.find((b) => b.id === reviewing)
  const [newTitle, setNewTitle] = useState('')
  const [styleFrom, setStyleFrom] = useState<string>('')
  const hasText = universe.scenes.some((s) => s.text.trim())

  const create = () => {
    let id = ''
    update((u) => {
      const [next, b] = addBook(u, { title: newTitle, styleFrom: styleFrom || null })
      id = b.id
      return next
    })
    setSelectedId(id)
    setAdding(false)
    setNewTitle('')
    toast('Livro novo na estante. Escolha as histórias e a capa na diagramação.')
  }

  return (
    <div className="view book-view">
      <header className="view-head">
        <h1>Livros</h1>
        {!readOnly && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              setStyleFrom(selected?.id ?? '')
              setAdding(true)
            }}
          >
            <Plus size={15} /> Novo livro
          </button>
        )}
      </header>

      {adding && (
        <form
          className="book-new"
          onSubmit={(e) => {
            e.preventDefault()
            create()
          }}
        >
          <label className="book-new-field">
            <span className="field-label">Título</span>
            <input className="input" autoFocus value={newTitle} placeholder="Ex.: Livro II — A Torre" onChange={(e) => setNewTitle(e.target.value)} />
          </label>
          {books.length > 0 && (
            <label className="book-new-field">
              <span className="field-label">Estilo</span>
              <select className="input" value={styleFrom} onChange={(e) => setStyleFrom(e.target.value)}>
                <option value="">Começar do padrão</option>
                {books.map((b) => (
                  <option key={b.id} value={b.id}>
                    Igual a “{bookTitle(universe, b)}” (série)
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="muted tiny book-new-hint">
            {storiesOutsideBooks(universe).length && books.length
              ? `Entra o que ainda não está em nenhum livro: ${universe.stories
                  .filter((s) => storiesOutsideBooks(universe).includes(s.id))
                  .map((s) => s.title || 'Sem título')
                  .join(', ')}. Dá para mudar depois.`
              : 'Você escolhe as histórias na diagramação.'}
          </p>
          <div className="inline-fields">
            <button type="submit" className="btn btn-primary btn-sm">
              Criar livro
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {books.length > 1 && (
        <div className="shelf" role="listbox" aria-label="Estante">
          {books.map((b) => (
            <button key={b.id} type="button" role="option" aria-selected={b.id === selected?.id} className="shelf-book" onClick={() => setSelectedId(b.id)}>
              <Cover book={b} title={bookTitle(universe, b)} small />
              <span className="shelf-title">{bookTitle(universe, b)}</span>
            </button>
          ))}
        </div>
      )}

      {selected ? (
        <>
          <BookHero book={selected} hasText={hasText} />
          {!readOnly && source.kind === 'proprio' && (
            <ShelfPublish book={selected} title={bookTitle(universe, selected)} status={shelfStatus} onSocial={() => setSocialOpen(true)} />
          )}
        </>
      ) : (
        <section className="book-hero" aria-label="Seu livro">
          <span className="book-hero-cover is-empty" aria-hidden="true">
            <span className="book-hero-placeholder">
              <span className="book-hero-placeholder-title">{universe.name}</span>
              <span className="book-hero-placeholder-hint">Sua capa aqui</span>
            </span>
          </span>
          <div className="book-hero-info">
            <p className="eyebrow">Estante vazia</p>
            <h2>Seu primeiro livro</h2>
            <p className="muted small">Junte as histórias que quiser num livro, com a sua capa. Uma série pode ter vários: um por volume, todos com o mesmo estilo.</p>
            <div className="book-hero-actions">
              {!readOnly && (
                <button type="button" className="btn btn-primary btn-lg" disabled={!hasText} onClick={() => openBookDesigner()}>
                  <Plus size={18} /> Criar o livro
                </button>
              )}
            </div>
            {!hasText && <p className="muted small">Escreva a primeira cena: o livro se monta a partir dela.</p>}
          </div>
        </section>
      )}

      <ul className="book-how">
        <li>
          <Palette size={18} aria-hidden="true" />
          <span>
            <strong>A capa é sua.</strong> Envie a imagem; o Papirus cuida do miolo: fontes, títulos, ornamentos, margens.
          </span>
        </li>
        <li>
          <BookOpenText size={18} aria-hidden="true" />
          <span>
            <strong>Uma série, vários livros.</strong> Cada volume com suas histórias; o estilo pode ser o mesmo para todos.
          </span>
        </li>
        <li>
          <FileDown size={18} aria-hidden="true" />
          <span>
            <strong>Sai em PDF</strong> para gráfica ou impressão, e também em Word, EPUB e Markdown (abaixo).
          </span>
        </li>
      </ul>

      {!readOnly && <BookCard />}
      {socialOpen && <SocialDialog publicUrl={prefs.publicUrl} onClose={() => setSocialOpen(false)} />}
      {reviewBookRecord && <ReviewDialog design={reviewBookRecord} title={bookTitle(universe, reviewBookRecord)} onClose={() => setReviewing(null)} />}
    </div>
  )

  function BookHero({ book, hasText }: { book: BookRecord; hasText: boolean }) {
    const { parts, words } = bookContent(universe, book)
    const chapters = parts.reduce((n, p) => n + p.chapters.length, 0)
    const title = bookTitle(universe, book)
    const author = book.author.trim()
    const stories = book.storyIds.length ? universe.stories.filter((s) => book.storyIds.includes(s.id)) : universe.stories
    return (
      <section className="book-hero" aria-label={`Livro ${title}`}>
        <button type="button" className="book-hero-cover" onClick={() => openBookDesigner(book.id)} disabled={readOnly || !hasText} aria-label={`Diagramar ${title}`}>
          <Cover book={book} title={title} />
        </button>
        <div className="book-hero-info">
          <p className="eyebrow">{books.length > 1 ? `Livro ${books.indexOf(book) + 1} de ${books.length}` : 'Seu livro'}</p>
          <h2>{title}</h2>
          {author && <p className="book-hero-author">{author}</p>}
          <p className="muted small">
            {chapters} {chapters === 1 ? 'capítulo' : 'capítulos'} · {words.toLocaleString('pt-BR')} palavras
            {stories.length > 0 && ` · ${stories.map((s) => s.title || 'Sem título').join(', ')}`}
          </p>
          <p className="book-hero-spec small">
            {PAGE_SIZES[book.pageSize].label.replace(/ \(.*/, '')} · {BOOK_FONTS[BODY_FONT_KEY[book.bodyFont]].label} · capítulos em estilo {STYLE_LABEL[book.chapterStyle]}
          </p>
          <div className="book-hero-actions">
            {!readOnly && (
              <button type="button" className="btn btn-primary btn-lg" disabled={!hasText} onClick={() => openBookDesigner(book.id)}>
                <Printer size={18} /> Diagramar e gerar PDF
              </button>
            )}
            <button type="button" className="btn btn-ghost" disabled={!chapters} onClick={openReader}>
              <BookOpen size={16} /> Ler como leitor
            </button>
            {!readOnly && (
              <button type="button" className="btn btn-ghost" disabled={!chapters} title="Repetições, frases longas, aspas, travessões…" onClick={() => setReviewing(book.id)}>
                <SpellCheck size={16} /> Revisar
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost"
              disabled={!chapters}
              title="E-book com a mesma capa e estilo"
              onClick={() => void import('../book/epubDownload').then((m) => m.downloadEpub(universe, book))}
            >
              <FileDown size={16} /> E-book
            </button>
            {!readOnly && (
              <button
                type="button"
                className="btn btn-ghost"
                title="Novo livro com o mesmo estilo deste"
                onClick={() => {
                  setStyleFrom(book.id)
                  setAdding(true)
                }}
              >
                <Copy size={16} /> Próximo volume
              </button>
            )}
            {!readOnly && (
              <ConfirmButton
                className="btn btn-ghost"
                title={`Tirar ${title} da estante`}
                question="Tirar este livro da estante? As histórias continuam; só a capa e a diagramação vão para a lixeira."
                confirmLabel="Tirar da estante"
                onConfirm={() => {
                  update((u) => removeBook(u, book.id))
                  setSelectedId(null)
                }}
              >
                <Trash2 size={16} aria-label={`Tirar ${title} da estante`} />
              </ConfirmButton>
            )}
          </div>
        </div>
      </section>
    )
  }
}

function Cover({ book, title, small }: { book: BookRecord; title: string; small?: boolean }) {
  if (book.cover) return <img src={book.cover} alt={`Capa de ${title}`} className={small ? 'shelf-cover' : undefined} />
  return (
    <span className={`book-hero-placeholder${small ? ' shelf-cover' : ''}`}>
      <span className="book-hero-placeholder-title">{title}</span>
      {!small && book.author.trim() && <span className="book-hero-placeholder-author">{book.author}</span>}
      {!small && <span className="book-hero-placeholder-hint">Sua capa aqui</span>}
    </span>
  )
}
