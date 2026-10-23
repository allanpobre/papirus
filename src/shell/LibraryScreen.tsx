import { BookOpen, FileUp, Moon, Plus, Sparkles, Sun, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { migrate } from '../model/migrations'
import { sampleUniverse } from '../model/sample'
import type { Universe } from '../model/schema'
import { createUniverse, newId } from '../model/universe'
import type { Library, LibraryEntry } from '../persistence/repository'
import type { usePrefs } from '../state/prefs'
import { ConfirmButton } from '../ui/ConfirmButton'
import { Brand } from './Brand'

interface Props {
  library: Library
  entries: LibraryEntry[]
  prefs: ReturnType<typeof usePrefs>
  onOpen: (id: string) => void
  onCreated: (u: Universe) => void
  onChanged: () => void
}

const dateFmt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' })

export function LibraryScreen({ library, entries, prefs, onOpen, onCreated, onChanged }: Props) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const { prefs: p, setPref } = prefs
  const dark = p.theme === 'escuro' || (p.theme === 'sistema' && matchMedia('(prefers-color-scheme: dark)').matches)

  const importFile = async (file: File) => {
    setError(null)
    try {
      const file_ = migrate(JSON.parse(await file.text()))
      let u = file_.universe
      // Importar nunca sobrescreve: se o ID já existe, vira uma cópia.
      if (entries.some((e) => e.id === u.id)) u = { ...u, id: newId(), name: `${u.name} (importado)` }
      onCreated(u)
    } catch (err) {
      setError(`Não foi possível importar “${file.name}”: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return (
    <div className="library">
      <header className="library-top">
        <Brand />
        <button
          type="button"
          className="btn-icon"
          aria-label={dark ? 'Usar tema claro' : 'Usar tema escuro'}
          onClick={() => setPref('theme', dark ? 'claro' : 'escuro')}
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>

      <main className="library-main">
        <section className="library-hero">
          <h1>Seus universos</h1>
          <p className="lede">
            Escreva primeiro. Estruture quando for útil. Tudo fica guardado neste navegador — exporte um backup de vez em quando.
          </p>
        </section>

        <form
          className="library-new"
          onSubmit={(e) => {
            e.preventDefault()
            onCreated(createUniverse(name.trim() || 'Novo universo'))
            setName('')
          }}
        >
          <label htmlFor="novo-universo" className="sr-only">
            Nome do novo universo
          </label>
          <input
            id="novo-universo"
            className="input input-lg"
            placeholder="Nome do novo universo"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className="btn btn-primary btn-lg">
            <Plus size={18} /> Criar universo
          </button>
        </form>

        <div className="library-alt">
          <button type="button" className="btn btn-ghost" onClick={() => onCreated(sampleUniverse())}>
            <Sparkles size={16} /> Abrir um universo de exemplo
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
            <FileUp size={16} /> Importar backup (.json)
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void importFile(f)
              e.target.value = ''
            }}
          />
        </div>
        {error && (
          <p className="notice notice-error" role="alert">
            {error}
          </p>
        )}

        {entries.length > 0 ? (
          <ul className="library-list" aria-label="Universos">
            {entries.map((e) => (
              <li key={e.id} className="library-item">
                <button type="button" className="library-open" onClick={() => onOpen(e.id)}>
                  <BookOpen size={20} aria-hidden="true" />
                  <span className="library-name">{e.name || 'Sem nome'}</span>
                  <span className="library-meta">
                    {e.words.toLocaleString('pt-BR')} palavras · {dateFmt.format(new Date(e.updatedAt))}
                  </span>
                </button>
                <ConfirmButton
                  className="btn-icon"
                  title={`Apagar ${e.name}`}
                  question="Apagar de vez este universo e seus snapshots?"
                  confirmLabel="Apagar universo"
                  onConfirm={async () => {
                    await library.remove(e.id)
                    onChanged()
                  }}
                >
                  <Trash2 size={16} aria-label={`Apagar ${e.name}`} />
                </ConfirmButton>
              </li>
            ))}
          </ul>
        ) : (
          <p className="library-empty">Nenhum universo ainda. Dê um nome e comece, ou explore o exemplo.</p>
        )}
      </main>
    </div>
  )
}
