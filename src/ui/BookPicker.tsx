import { BookOpen, Check } from 'lucide-react'
import { useState } from 'react'
import { bookIdsOf, chosenBook, isSeries, seriesId } from '../model/universe'
import { useWorkspace } from '../state/workspace'

const SEVERAL = '__varios'

/**
 * Escolher o livro (uma história do universo) em que se está. Só aparece num universo com mais de um
 * livro; "Todos os livros" mostra tudo junto e "Vários livros…" junta dois ou mais numa série ("Oz 1–3" sem
 * a Zixi). Mora no Início e no topo da lista de cenas do Escrever; nas outras áreas vira um selo pequeno,
 * só quando há um livro escolhido (`onlyWhenChosen`).
 */
export function BookPicker({ className = 'book-bar', onlyWhenChosen = false }: { className?: string; onlyWhenChosen?: boolean }) {
  const { universe, bookId, setBookId } = useWorkspace()
  const [picking, setPicking] = useState<string[] | null>(null)
  if (universe.stories.length < 2) return null
  // O selo das outras áreas só aparece quando há um livro escolhido (lembra que a tela está filtrada).
  if (onlyWhenChosen && !bookId) return null
  const series = isSeries(bookId) ? chosenBook(universe, bookId) : undefined
  const id = `livro-atual-${className}`
  return (
    <div className={className} data-tour="livro-atual">
      <BookOpen size={15} aria-hidden="true" />
      <label htmlFor={id} className={onlyWhenChosen ? 'sr-only' : undefined}>
        Livro
      </label>
      <select
        id={id}
        value={bookId ?? ''}
        onChange={(e) => {
          if (e.target.value === SEVERAL) return setPicking(bookIdsOf(bookId) ?? [])
          setPicking(null)
          setBookId(e.target.value || null)
        }}
      >
        <option value="">Todos os livros</option>
        {universe.stories.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title || 'Sem título'}
          </option>
        ))}
        {series && <option value={series.id}>{series.title}</option>}
        {universe.stories.length > 2 && <option value={SEVERAL}>Vários livros…</option>}
      </select>
      {picking && (
        <div className="book-series" role="group" aria-label="Escolher os livros da série">
          {universe.stories.map((s) => (
            <label key={s.id} className="check">
              <input
                type="checkbox"
                checked={picking.includes(s.id)}
                onChange={(e) => {
                  const on = e.target.checked
                  setPicking((p) => (on ? [...(p ?? []), s.id] : (p ?? []).filter((x) => x !== s.id)))
                }}
              />{' '}
              {s.title || 'Sem título'}
            </label>
          ))}
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={picking.length < 2}
            onClick={() => {
              setBookId(seriesId(universe, picking))
              setPicking(null)
            }}
          >
            <Check size={14} aria-hidden="true" /> Juntar {picking.length} livros
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setPicking(null)}>
            Cancelar
          </button>
        </div>
      )}
    </div>
  )
}
