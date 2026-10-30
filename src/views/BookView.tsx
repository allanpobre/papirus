import { BookOpen, BookOpenText, Check, Copy, FileDown, FileText, FileType, Palette, Plus, Printer, Ruler, Trash2, Upload } from 'lucide-react'
import { ReviewDialog } from '../book/ReviewDialog'
import { useMemo, useState } from 'react'
import { BOOK_FONTS } from '../export/bookFonts'
import { BODY_FONT_KEY, PAGE_SIZES, bookTitle } from '../export/bookDesign'
import { reviewStep, textStep, type StepState } from '../export/bookPath'
import { fileNameFor, downloadText } from '../export/download'
import { addBook, removeBook, shelf, storiesOutsideBooks } from '../export/shelf'
import { reviewBook } from '../logic/review'
import type { BookRecord } from '../model/schema'
import { useAccount } from '../account/auth'
import { useWorkspace } from '../state/workspace'
import { ConfirmButton } from '../ui/ConfirmButton'
import { MoreMenu } from '../ui/MoreMenu'
import { ShelfPublish } from '../social/ShelfPublish'
import { SocialDialog } from '../social/SocialDialog'
import { VISIBILITY_LABEL } from '../social/social'
import { useShelfStatus } from '../social/useShelfSync'
import { BookImport } from './BookImport'
import { BookReadersDialog } from './BookReaders'
import { readersSummary, useBookReaders } from './readersData'
import { PageHelp } from '../ui/PageTour'

const STYLE_LABEL = { classico: 'clássico', moderno: 'moderno', minimalista: 'minimalista', ornamentado: 'ornamentado', manuscrito: 'manuscrito' } as const

/**
 * A estante: os livros deste universo (volumes de uma série, contos, edições).
 * Cada livro tem capa, histórias e diagramação próprias; dá para copiar o estilo de outro.
 * O livro escolhido mostra o caminho do manuscrito ao livro: texto, revisar, leitores,
 * diagramar e baixar, cada passo com o que achou e um atalho para resolver.
 */
export default function BookView() {
  const { universe, update, openBookDesigner, readOnly, toast, source, prefs } = useWorkspace()
  const shelfStatus = useShelfStatus()
  const [socialOpen, setSocialOpen] = useState(false)
  const books = useMemo(() => shelf(universe), [universe])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = books.find((b) => b.id === selectedId) ?? books[0] ?? null
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState(false)
  const [reviewing, setReviewing] = useState<string | null>(null)
  const [readersOf, setReadersOf] = useState<string | null>(null)
  const reviewBookRecord = books.find((b) => b.id === reviewing)
  const readersBook = books.find((b) => b.id === readersOf)
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
        <PageHelp tour="livro" />
        {!readOnly && (
          <span className="book-head-actions">
            <button type="button" className="btn btn-sm btn-ghost" aria-expanded={importing} onClick={() => setImporting(!importing)}>
              <Upload size={15} /> Importar
            </button>
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
          </span>
        )}
      </header>

      {importing && (
        <section className="book-new" aria-label="Importar um texto">
          <p className="muted small">Traga um texto de .docx, .md ou .txt. Vira uma história nova, dividida em cenas; depois, ela pode entrar num livro. Nada vira ficha sozinho.</p>
          <BookImport onDone={() => setImporting(false)} />
        </section>
      )}

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
          <BookHero
            key={selected.id}
            book={selected}
            books={books}
            hasText={hasText}
            onReview={() => setReviewing(selected.id)}
            onReaders={() => setReadersOf(selected.id)}
            onNextVolume={() => {
              setStyleFrom(selected.id)
              setAdding(true)
            }}
            onRemoved={() => setSelectedId(null)}
          />
          {!readOnly && source.kind === 'proprio' && <ShelfPublish book={selected} title={bookTitle(universe, selected)} status={shelfStatus} onSocial={() => setSocialOpen(true)} />}
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
      {/* As explicações só com a estante vazia; com um livro, o caminho dele explica. */}
      {!selected && (
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
              <strong>Sai em PDF</strong> para gráfica ou impressão, e também em e-book, Word e texto.
            </span>
          </li>
        </ul>
      )}

      {socialOpen && <SocialDialog publicUrl={prefs.publicUrl} onClose={() => setSocialOpen(false)} />}
      {reviewBookRecord && <ReviewDialog design={reviewBookRecord} title={bookTitle(universe, reviewBookRecord)} onClose={() => setReviewing(null)} />}
      {readersBook && <ReadersFor book={readersBook} onClose={() => setReadersOf(null)} />}
    </div>
  )
}

interface HeroProps {
  book: BookRecord
  books: BookRecord[]
  hasText: boolean
  onReview: () => void
  onReaders: () => void
  onNextVolume: () => void
  onRemoved: () => void
}

/** O livro escolhido: capa, botões e o caminho até o livro pronto. */
function BookHero({ book, books, hasText, onReview, onReaders, onNextVolume, onRemoved }: HeroProps) {
  const { universe, update, openBookDesigner, openReader, readOnly, source, go } = useWorkspace()
  const { user } = useAccount()
  const title = bookTitle(universe, book)
  const author = book.author.trim()
  const issues = useMemo(() => reviewBook(universe, book), [universe, book])
  const text = textStep(universe, book, issues)
  const review = reviewStep(issues)
  const readers = useBookReaders(book)
  const said = readersSummary(readers)
  const chapters = text.chapters > 0
  const download = async (format: 'epub' | 'docx' | 'md') => {
    if (format === 'epub') return void import('../book/epubDownload').then((m) => m.downloadEpub(universe, book))
    const { bookFromDesign, bookToDocx, bookToMarkdown, downloadBytes } = await import('../export/exportBook')
    const out = bookFromDesign(universe, book)
    if (format === 'docx') downloadBytes(fileNameFor(title, 'docx'), bookToDocx(out), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    else downloadText(fileNameFor(title, 'md'), bookToMarkdown(out))
  }
  // O menu "Baixar" (no alto e no último passo): todos os formatos, sempre a partir do livro.
  const baixar = (small: boolean) => (
    <MoreMenu
      label={`Baixar “${title}”`}
      button={
        <>
          <FileDown size={small ? 14 : 16} aria-hidden="true" /> Baixar
        </>
      }
      buttonClass={small ? 'btn btn-sm btn-ghost' : 'btn'}
    >
      {(close) => (
        <>
          <button
            type="button"
            className="more-menu-item"
            disabled={!chapters || readOnly}
            onClick={() => {
              close()
              openBookDesigner(book.id)
            }}
          >
            <Printer size={16} />{' '}
            <span>
              PDF para imprimir<small className="more-menu-hint">abre a prévia, para conferir antes</small>
            </span>
          </button>
          <button
            type="button"
            className="more-menu-item"
            disabled={!chapters}
            onClick={() => {
              close()
              void download('epub')
            }}
          >
            <BookOpen size={16} />{' '}
            <span>
              E-book (EPUB)<small className="more-menu-hint">Kindle, Kobo, Apple Livros</small>
            </span>
          </button>
          <button
            type="button"
            className="more-menu-item"
            disabled={!chapters}
            onClick={() => {
              close()
              void download('docx')
            }}
          >
            <FileType size={16} />{' '}
            <span>
              Word (.docx)<small className="more-menu-hint">para editora ou revisor</small>
            </span>
          </button>
          <button
            type="button"
            className="more-menu-item"
            disabled={!chapters}
            onClick={() => {
              close()
              void download('md')
            }}
          >
            <FileText size={16} />{' '}
            <span>
              Texto (.md)<small className="more-menu-hint">só o texto, em Markdown</small>
            </span>
          </button>
          {!readOnly && (
            <button
              type="button"
              className="more-menu-item"
              disabled={!chapters}
              onClick={() => {
                close()
                openBookDesigner(book.id, 'grafica')
              }}
            >
              <Ruler size={16} />{' '}
              <span>
                Capa para gráfica<small className="more-menu-hint">lombada, capa inteira e o molde</small>
              </span>
            </button>
          )}
        </>
      )}
    </MoreMenu>
  )
  const steps: { id: string; title: string; state: StepState; detail: string; action: React.ReactNode }[] = [
    {
      id: 'texto',
      title: 'O texto',
      ...text,
      action: (
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => go('organizar')}>
          Ver no Mapa
        </button>
      ),
    },
    {
      id: 'revisar',
      title: 'Revisar',
      state: review.state,
      detail: review.detail,
      action: (
        <button type="button" className="btn btn-sm btn-ghost" disabled={!chapters} onClick={onReview}>
          Revisar
        </button>
      ),
    },
    {
      id: 'leitores',
      title: 'Leitores',
      state: said.open ? 'olhar' : 'neutro',
      detail: said.detail,
      action: (
        <button type="button" className="btn btn-sm btn-ghost" onClick={onReaders}>
          Ver
        </button>
      ),
    },
    {
      id: 'diagramar',
      title: 'Diagramar',
      state: book.cover ? 'ok' : 'neutro',
      detail: `${PAGE_SIZES[book.pageSize].label.replace(/ \(.*/, '')} · ${BOOK_FONTS[BODY_FONT_KEY[book.bodyFont]].label} · capítulos em estilo ${STYLE_LABEL[book.chapterStyle]}${book.cover ? '' : ' · sem capa ainda'}`,
      action: !readOnly && (
        <button type="button" className="btn btn-sm btn-ghost" disabled={!chapters} onClick={() => openBookDesigner(book.id)}>
          Diagramar
        </button>
      ),
    },
    {
      id: 'baixar',
      title: 'Baixar e publicar',
      state: 'neutro',
      detail: `PDF para imprimir, e-book, Word ou texto${user && source.kind === 'proprio' ? ` · no seu perfil: ${VISIBILITY_LABEL[book.shelfVisibility].toLowerCase()}` : ''}`,
      action: baixar(true),
    },
  ]
  return (
    <section className="book-hero" aria-label={`Livro ${title}`}>
      <button type="button" className="book-hero-cover" onClick={() => openBookDesigner(book.id)} disabled={readOnly || !hasText} aria-label={`Diagramar ${title}`}>
        <Cover book={book} title={title} />
      </button>
      <div className="book-hero-info">
        <p className="eyebrow">{books.length > 1 ? `Livro ${books.indexOf(book) + 1} de ${books.length}` : 'Seu livro'}</p>
        <h2>{title}</h2>
        {author && <p className="book-hero-author">{author}</p>}
        <div className="book-hero-actions" data-tour="livro-acoes">
          {!readOnly && (
            <button type="button" className="btn btn-primary" disabled={!hasText} onClick={() => openBookDesigner(book.id)}>
              <Palette size={16} /> Diagramar
            </button>
          )}
          <button type="button" className="btn" disabled={!chapters} onClick={openReader}>
            <BookOpen size={16} /> Ler
          </button>
          {baixar(false)}
          {!readOnly && (
            <MoreMenu label={`Mais de “${title}”`}>
              {(close) => (
                <>
                  <button
                    type="button"
                    className="more-menu-item"
                    onClick={() => {
                      close()
                      onNextVolume()
                    }}
                  >
                    <Copy size={16} /> Próximo volume, com o mesmo estilo
                  </button>
                  <ConfirmButton
                    className="more-menu-item more-menu-danger"
                    title={`Tirar ${title} da estante`}
                    question="Tirar este livro da estante? As histórias continuam; só a capa e a diagramação vão para a lixeira."
                    confirmLabel="Tirar da estante"
                    onConfirm={() => {
                      close()
                      update((u) => removeBook(u, book.id))
                      onRemoved()
                    }}
                  >
                    <Trash2 size={16} aria-hidden="true" /> Tirar da estante
                  </ConfirmButton>
                </>
              )}
            </MoreMenu>
          )}
        </div>
        <ol className="book-path" aria-label="Do manuscrito ao livro" data-tour="livro-caminho">
          {steps.map((st, i) => (
            <li key={st.id} className={`book-step is-${st.state}`}>
              <span className="book-step-dot" aria-hidden="true">
                {st.state === 'ok' ? <Check size={13} /> : i + 1}
              </span>
              <span className="book-step-text">
                <strong>{st.title}</strong>
                <span>{st.detail}</span>
              </span>
              <span className="book-step-action">{st.action}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
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

/** A janela dos leitores, com os dados do livro (comentários e reações). */
function ReadersFor({ book, onClose }: { book: BookRecord; onClose: () => void }) {
  const { universe } = useWorkspace()
  const readers = useBookReaders(book)
  return <BookReadersDialog readers={readers} title={bookTitle(universe, book)} onClose={onClose} />
}
