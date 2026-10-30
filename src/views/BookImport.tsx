import { BookUp } from 'lucide-react'
import { useRef, useState } from 'react'
import type { SplitMode } from '../export/importBook'
import { addScene, addStory, patch, updateScene } from '../model/universe'
import { useWorkspace } from '../state/workspace'
import { Select } from '../ui/bits'

/** Trazer um texto escrito em outro lugar (.docx, .md, .txt): vira uma história nova, em cenas. */
export function BookImport({ onDone }: { onDone?: () => void }) {
  const { update, toast, go } = useWorkspace()
  const fileRef = useRef<HTMLInputElement>(null)
  const [split, setSplit] = useState<SplitMode>('titulos')
  const [busy, setBusy] = useState(false)

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
      onDone?.()
    } catch (err) {
      toast(`Não foi possível importar: ${err instanceof Error ? err.message : String(err)}`, { tone: 'erro' })
    } finally {
      setBusy(false)
    }
  }

  return (
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
  )
}
