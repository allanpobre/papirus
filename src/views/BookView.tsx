import { BookOpen, BookOpenText, FileDown, Palette, Printer } from 'lucide-react'
import { useMemo } from 'react'
import { BOOK_FONTS } from '../export/bookFonts'
import { BODY_FONT_KEY, PAGE_SIZES, bookContent, bookTitle, defaultDesign } from '../export/bookDesign'
import { useWorkspace } from '../state/workspace'
import { BookCard } from './BookCard'

const STYLE_LABEL = { classico: 'clássico', moderno: 'moderno', minimalista: 'minimalista', ornamentado: 'ornamentado', manuscrito: 'manuscrito' } as const

/** O livro: a capa, a diagramação em PDF, a leitura e os outros formatos, num lugar só. */
export default function BookView() {
  const { universe, openBookDesigner, openReader, readOnly } = useWorkspace()
  const design = useMemo(() => universe.book ?? defaultDesign(), [universe.book])
  const { parts, words } = useMemo(() => bookContent(universe, design), [universe, design])
  const chapters = parts.reduce((n, p) => n + p.chapters.length, 0)
  const title = bookTitle(universe, design)
  const author = design.author.trim()

  return (
    <div className="view book-view">
      <header className="view-head">
        <h1>Livro</h1>
      </header>

      <section className="book-hero" aria-label="Seu livro">
        <button type="button" className="book-hero-cover" onClick={openBookDesigner} disabled={readOnly || !chapters} aria-label="Abrir a diagramação">
          {design.cover ? (
            <img src={design.cover} alt={`Capa de ${title}`} />
          ) : (
            <span className="book-hero-placeholder">
              <span className="book-hero-placeholder-title">{title}</span>
              {author && <span className="book-hero-placeholder-author">{author}</span>}
              <span className="book-hero-placeholder-hint">Sua capa aqui</span>
            </span>
          )}
        </button>
        <div className="book-hero-info">
          <p className="eyebrow">Seu livro</p>
          <h2>{title}</h2>
          {author && <p className="book-hero-author">{author}</p>}
          <p className="muted small">
            {chapters} {chapters === 1 ? 'capítulo' : 'capítulos'} · {words.toLocaleString('pt-BR')} palavras
          </p>
          <p className="book-hero-spec small">
            {PAGE_SIZES[design.pageSize].label.replace(/ \(.*/, '')} · {BOOK_FONTS[BODY_FONT_KEY[design.bodyFont]].label} · capítulos em estilo {STYLE_LABEL[design.chapterStyle]}
          </p>
          <div className="book-hero-actions">
            {!readOnly && (
              <button type="button" className="btn btn-primary btn-lg" disabled={!chapters} onClick={openBookDesigner}>
                <Printer size={18} /> Diagramar e gerar PDF
              </button>
            )}
            <button type="button" className="btn btn-ghost" disabled={!chapters} onClick={openReader}>
              <BookOpen size={16} /> Ler como leitor
            </button>
          </div>
          {!chapters && <p className="muted small">Escreva a primeira cena: o livro se monta a partir dela.</p>}
        </div>
      </section>

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
            <strong>Prévia de verdade.</strong> Página por página, como livro aberto, com sumário e números.
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
    </div>
  )
}
