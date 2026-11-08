import { BookOpen } from 'lucide-react'
import { BookImport } from './BookImport'
import { useWorkspace } from '../state/workspace'

/**
 * Trazer um livro escrito em outro lugar. Baixar o livro (Word, EPUB, PDF, Markdown) fica num lugar só:
 * o Livro, que monta a partir do livro escolhido. Aqui fica o atalho.
 */
export function BookCard() {
  const { go } = useWorkspace()
  return (
    <section className="settings-card">
      <h2 className="section-title">Importar um livro</h2>
      <p className="muted small">Traga um texto de .docx, .md ou .txt. Vira uma história nova, dividida em cenas. Nada vira ficha sozinho.</p>
      <BookImport />
      <h3 className="section-label">Baixar o livro</h3>
      <p className="muted small">Word, EPUB, PDF para imprimir e Markdown ficam no Livro, com a capa, os capítulos e a prévia.</p>
      <div className="inline-fields">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => go('livro')}>
          <BookOpen size={14} /> Abrir o Livro
        </button>
      </div>
    </section>
  )
}
