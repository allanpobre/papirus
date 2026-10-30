import { BookDown } from 'lucide-react'
import { useState } from 'react'
import { downloadText, fileNameFor } from '../export/download'
import { sceneToMarkdown } from '../export/markdown'
import { scenesOf } from '../model/universe'
import { BookImport } from './BookImport'
import { useWorkspace } from '../state/workspace'
import { Field, Select } from '../ui/bits'

/** Trazer um livro escrito em outro lugar e levar uma história para fora como livro. */
export function BookCard() {
  const { universe, openBookDesigner } = useWorkspace()
  const [storyId, setStoryId] = useState(universe.stories[0]?.id ?? '')
  const [author, setAuthor] = useState('')
  const [titles, setTitles] = useState(true)
  const story = universe.stories.find((s) => s.id === storyId) ?? null
  const count = scenesOf(universe, story?.id ?? null).length

  const exportBook = async (format: 'docx' | 'epub' | 'md') => {
    const name = story?.title || universe.name
    if (format === 'md') {
      const scenes = scenesOf(universe, story?.id ?? null)
      downloadText(fileNameFor(name, 'md'), [`# ${name}`, ...scenes.map((s) => sceneToMarkdown(s, 2).trimEnd())].join('\n\n') + '\n')
      return
    }
    const { bookFrom, bookToDocx, bookToEpub, downloadBytes } = await import('../export/exportBook')
    if (format === 'epub') await (await import('../images/bookImages')).prepareBookImages(universe)
    const book = bookFrom(universe, story, { author: author.trim(), sceneTitles: titles })
    if (format === 'docx') downloadBytes(fileNameFor(name, 'docx'), bookToDocx(book), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    else downloadBytes(fileNameFor(name, 'epub'), bookToEpub(book), 'application/epub+zip')
  }

  return (
    <section className="settings-card">
      <h2 className="section-title">Livros</h2>
      <h3 className="section-label">Importar</h3>
      <p className="muted small">Traga um texto de .docx, .md ou .txt. Vira uma história nova, dividida em cenas. Nada vira ficha sozinho.</p>
      <BookImport />

      <h3 className="section-label">Livro impresso (PDF)</h3>
      <p className="muted small">Você escolhe a capa; o Papirus monta o miolo: fontes, títulos de capítulo, margens, sumário, cabeçalhos. Com prévia página por página.</p>
      <div className="inline-fields">
        <button type="button" className="btn btn-primary btn-sm" disabled={!universe.scenes.some((s) => s.text.trim())} onClick={() => openBookDesigner()}>
          <BookDown size={14} /> Diagramar o livro
        </button>
      </div>

      <h3 className="section-label">Exportar</h3>
      <div className="form-grid">
        <Field label="História">
          {(id) => (
            <Select
              id={id}
              value={storyId}
              onChange={setStoryId}
              options={[...universe.stories.map((s) => ({ value: s.id, label: s.title || 'Sem título' })), { value: '', label: 'Cenas soltas' }]}
            />
          )}
        </Field>
        <Field label="Autoria" hint="Sai na capa. Opcional.">
          {(id) => <input id={id} className="input" value={author} placeholder="Seu nome" onChange={(e) => setAuthor(e.target.value)} />}
        </Field>
      </div>
      <label className="toggle">
        <input type="checkbox" role="switch" checked={titles} onChange={(e) => setTitles(e.target.checked)} />
        <span className="toggle-track" aria-hidden="true" />
        <span>Título de cada cena como capítulo</span>
      </label>
      <div className="inline-fields">
        <button type="button" className="btn btn-primary btn-sm" disabled={!count} onClick={() => void exportBook('docx')}>
          <BookDown size={14} /> Word (.docx)
        </button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={!count} onClick={() => void exportBook('epub')}>
          <BookDown size={14} /> EPUB
        </button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={!count} onClick={() => void exportBook('md')}>
          <BookDown size={14} /> Markdown
        </button>
        <span className="muted tiny">{count} {count === 1 ? 'cena' : 'cenas'}</span>
      </div>
      <p className="muted tiny">Só o texto sai: comentários, notas e segredos das fichas ficam no Papirus.</p>
    </section>
  )
}
