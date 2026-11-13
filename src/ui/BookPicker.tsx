import { BookOpen } from 'lucide-react'
import { useWorkspace } from '../state/workspace'

/**
 * Escolher o livro (uma história do universo) em que se está. Só aparece num universo com mais de um
 * livro; "Todos os livros" mostra tudo junto. É a faixa no alto das áreas e, no celular, o topo da
 * lista de cenas do Escrever (onde a faixa não cabe).
 */
export function BookPicker({ className = 'book-bar' }: { className?: string }) {
  const { universe, bookId, setBookId } = useWorkspace()
  if (universe.stories.length < 2) return null
  return (
    <div className={className} data-tour="livro-atual">
      <BookOpen size={15} aria-hidden="true" />
      <label htmlFor={`livro-atual-${className}`}>Livro</label>
      <select id={`livro-atual-${className}`} value={bookId ?? ''} onChange={(e) => setBookId(e.target.value || null)}>
        <option value="">Todos os livros</option>
        {universe.stories.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title || 'Sem título'}
          </option>
        ))}
      </select>
    </div>
  )
}
