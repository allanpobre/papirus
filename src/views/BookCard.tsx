import { BookDown, BookUp } from 'lucide-react'
import { useRef, useState } from 'react'
import { downloadText, fileNameFor } from '../export/download'
import { sceneToMarkdown } from '../export/markdown'
import type { SplitMode } from '../export/importBook'
import { addScene, addStory, patch, scenesOf, updateScene } from '../model/universe'
import { useWorkspace } from '../state/workspace'
import { Field, Select } from '../ui/bits'

/** Trazer um livro escrito em outro lugar e levar uma história para fora como livro. */
export function BookCard() {
  const { universe, update, toast, go, openBookDesigner } = useWorkspace()
  const fileRef = useRef<HTMLInputElement>(null)
  const [split, setSplit] = useState<SplitMode>('titulos')
  const [storyId, setStoryId] = useState(universe.stories[0]?.id ?? '')
  const [author, setAuthor] = useState('')
  const [titles, setTitles] = useState(true)
  const [busy, setBusy] = useState(false)
  const story = universe.stories.find((s) => s.id === storyId) ?? null
  const count = scenesOf(universe, story?.id ?? null).length

  const importBook = async (file: File) => {
    setBusy(true)
    try {
      const { importBookFile } = await import('../export/importBook')
      const book = await importBookFile(file, split)
      if (!book.scenes.length) {
        toast('O arquivo não tem texto para importar.', { tone: 'erro' })
        return
      }
      let first = ''
      update((u) => {
        let [next, s] = addStory(u, book.title)
        if (book.front) next = patch(next, 'stories', s.id, { synopsis: book.front })
        for (const sc of book.scenes) {
          let scene
          ;[next, scene] = addScene(next, s.id, sc.title)
          next = updateScene(next, scene.id, { doc: sc.doc, text: sc.text })
          first ||= scene.id
        }
        return next
      })
      toast(`“${book.title}” importado em ${book.scenes.length} ${book.scenes.length === 1 ? 'cena' : 'cenas'}.`, {
        action: { label: 'Abrir', run: () => go('escrever', first) },
      })
    } catch (err) {
      toast(`Não foi possível importar: ${err instanceof Error ? err.message : String(err)}`, { tone: 'erro' })
    } finally {
      setBusy(false)
    }
  }

  const exportBook = async (format: 'docx' | 'epub' | 'md') => {
    const name = story?.title || universe.name
    if (format === 'md') {
      const scenes = scenesOf(universe, story?.id ?? null)
      downloadText(fileNameFor(name, 'md'), [`# ${name}`, ...scenes.map((s) => sceneToMarkdown(s, 2).trimEnd())].join('\n\n') + '\n')
      return
    }
    const { bookFrom, bookToDocx, bookToEpub, downloadBytes } = await import('../export/exportBook')
    const book = bookFrom(universe, story, { author: author.trim(), sceneTitles: titles })
    if (format === 'docx') downloadBytes(fileNameFor(name, 'docx'), bookToDocx(book), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    else downloadBytes(fileNameFor(name, 'epub'), bookToEpub(book), 'application/epub+zip')
  }

  return (
    <section className="settings-card">
      <h2 className="section-title">Livros</h2>
      <h3 className="section-label">Importar</h3>
      <p className="muted small">Traga um texto de .docx, .md ou .txt. Vira uma história nova, dividida em cenas. Nada vira ficha sozinho.</p>
      <div className="import-row">
        <Select
          label="Dividir em cenas"
          value={split}
          onChange={setSplit}
          options={[
            { value: 'titulos', label: 'Por títulos (capítulos)' },
            { value: 'separadores', label: 'Por separadores (* * *)' },
            { value: 'nada', label: 'Não dividir' },
          ]}
        />
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => fileRef.current?.click()}>
          <BookUp size={16} /> {busy ? 'Importando…' : 'Importar livro'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".docx,.md,.markdown,.txt,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          hidden
          aria-label="Arquivo do livro"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void importBook(f)
            e.target.value = ''
          }}
        />
      </div>

      <h3 className="section-label">Livro impresso (PDF)</h3>
      <p className="muted small">Você escolhe a capa; o Papirus monta o miolo: fontes, títulos de capítulo, margens, sumário, cabeçalhos. Com prévia página por página.</p>
      <div className="inline-fields">
        <button type="button" className="btn btn-primary btn-sm" disabled={!universe.scenes.some((s) => s.text.trim())} onClick={openBookDesigner}>
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
