import { BookOpen } from 'lucide-react'
import { useWorkspace } from '../state/workspace'

/**
 * Escolher o livro (uma história do universo) em que se está. Só aparece num universo com mais de um
 * livro; "Todos os livros" mostra tudo junto. Mora no Início e no topo da lista de cenas do Escrever;
 * nas outras áreas vira um selo pequeno, só quando há um livro escolhido (`onlyWhenChosen`).
 */
export function BookPicker({ className = 'book-bar', onlyWhenChosen = false }: { className?: string; onlyWhenChosen?: boolean }) {
  const { universe, bookId, setBookId } = useWorkspace()
  if (universe.stories.length < 2) return null
  // O selo das outras áreas só aparece quando há um livro escolhido (lembra que a tela está filtrada).
  if (onlyWhenChosen && !bookId) return null
  return (
    <div className={className} data-tour="livro-atual">
      <BookOpen size={15} aria-hidden="true" />
      <label htmlFor={`livro-atual-${className}`} className={onlyWhenChosen ? 'sr-only' : undefined}>
        Livro
      </label>
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
