import { NotebookPen, Pencil, X } from 'lucide-react'
import { useId, useState } from 'react'
import { nextNoteOf, setNextNote } from '../logic/homeToday'
import { byId, sceneTitle } from '../model/universe'
import { useWorkspace } from '../state/workspace'

/**
 * Bilhete para amanhã: uma linha sobre o que vem depois, deixada ao parar de escrever
 * (Hemingway parava sabendo o que vinha a seguir, para não travar no dia seguinte). É um
 * só por universo, ligado à cena em que foi escrito; aparece no fim dela e no Início.
 */
export function NextNote({ sceneId, place }: { sceneId: string | null; place: 'pagina' | 'inicio' }) {
  const { universe, update, readOnly, go } = useWorkspace()
  const note = nextNoteOf(universe)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const id = useId()
  // Na página, só o bilhete desta cena; no Início, o bilhete do universo (dizendo de que cena é).
  const shown = note && (place === 'inicio' || note.sceneId === sceneId) ? note : null
  const other = shown?.sceneId && shown.sceneId !== sceneId ? byId(universe, 'scenes', shown.sceneId) : undefined

  const save = () => {
    update((u) => setNextNote(u, draft, sceneId))
    setEditing(false)
  }
  const edit = () => {
    setDraft(shown?.text ?? '')
    setEditing(true)
  }

  if (editing) {
    return (
      <div className={`next-note is-editing next-note-${place}`}>
        <label htmlFor={id} className="next-note-label">
          <NotebookPen size={14} aria-hidden="true" /> Bilhete para amanhã
        </label>
        <textarea
          id={id}
          className="input next-note-input"
          rows={2}
          maxLength={280}
          autoFocus
          value={draft}
          placeholder="O que acontece depois? Uma linha para começar amanhã sem travar."
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              save()
            } else if (e.key === 'Escape') {
              e.stopPropagation()
              setEditing(false)
            }
          }}
        />
        <span className="next-note-actions">
          <button type="button" className="btn btn-sm btn-primary" onClick={save}>
            Guardar o bilhete
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing(false)}>
            Cancelar
          </button>
          <span className="muted tiny">Pare sabendo o que vem depois: amanhã começa mais fácil.</span>
        </span>
      </div>
    )
  }

  if (shown) {
    return (
      <div className={`next-note next-note-${place}`} role="note" aria-label="Bilhete para amanhã">
        <NotebookPen size={15} aria-hidden="true" className="next-note-icon" />
        <p>
          <strong>{place === 'inicio' ? 'Seu bilhete:' : 'Bilhete para amanhã:'}</strong> {shown.text}
          {other && (
            <>
              {' '}
              <button type="button" className="link-btn" onClick={() => go('escrever', other.id)}>
                (em “{sceneTitle(other)}”)
              </button>
            </>
          )}
        </p>
        {!readOnly && (
          <span className="next-note-tools">
            <button type="button" className="btn-icon btn-xs" aria-label="Mudar o bilhete" title="Mudar o bilhete" onClick={edit}>
              <Pencil size={13} />
            </button>
            <button type="button" className="btn-icon btn-xs" aria-label="Apagar o bilhete" title="Apagar o bilhete (já foi)" onClick={() => update((u) => setNextNote(u, '', null))}>
              <X size={13} />
            </button>
          </span>
        )}
      </div>
    )
  }

  if (readOnly) return null
  return (
    <button type="button" className={`link-btn next-note-add next-note-${place}`} onClick={edit}>
      <NotebookPen size={14} aria-hidden="true" /> Deixar um bilhete para amanhã
    </button>
  )
}
