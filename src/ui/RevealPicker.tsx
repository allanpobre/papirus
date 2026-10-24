import { BookOpenCheck } from 'lucide-react'
import { useState, type RefObject } from 'react'
import { revealIndex, splitReveals, unmarkReveals, wrapReveal } from '../logic/reveals'
import { manuscriptOrder } from '../model/universe'
import { useWorkspace } from '../state/workspace'

/**
 * Botão pequeno ao lado de um campo de uma linha: "o leitor só vê isto a partir da cena…".
 * Marca a seleção, ou o campo inteiro se nada estiver selecionado. Marcado, mostra a cena e desmarca.
 */
export function RevealPicker({ value, onChange, inputRef, label }: { value: string; onChange: (v: string) => void; inputRef: RefObject<HTMLInputElement | null>; label: string }) {
  const { universe, readOnly } = useWorkspace()
  const order = manuscriptOrder(universe)
  const [picking, setPicking] = useState(false)
  const marked = splitReveals(value).find((p) => p.sceneTitle !== null)
  if (!order.length || readOnly) return null

  if (marked) {
    const at = revealIndex(marked, order)
    return (
      <button
        type="button"
        className="btn btn-ghost btn-xs reveal-chip"
        title="Tirar a marcação: o leitor passa a ver junto com a ficha"
        aria-label={`${label}: só a partir da cena ${at === null ? '?' : at + 1}. Tirar a marcação`}
        onClick={() => onChange(unmarkReveals(value))}
      >
        <BookOpenCheck size={13} /> cena {at === null ? '?' : at + 1}
      </button>
    )
  }

  if (picking)
    return (
      <select
        className="input input-sm"
        aria-label={`${label}: revelar ao leitor a partir de qual cena`}
        autoFocus
        defaultValue=""
        onBlur={() => setPicking(false)}
        onChange={(e) => {
          const scene = order.find((s) => s.id === e.target.value)
          setPicking(false)
          if (!scene) return
          const el = inputRef.current
          const start = el?.selectionStart ?? 0
          const end = el?.selectionEnd ?? 0
          onChange(start === end ? wrapReveal(value, 0, value.length, scene).text : wrapReveal(value, start, end, scene).text)
        }}
      >
        <option value="" disabled>
          A partir de qual cena?
        </option>
        {order.map((s, i) => (
          <option key={s.id} value={s.id}>
            {i + 1}. {s.title || 'Sem título'}
          </option>
        ))}
      </select>
    )

  return (
    <button
      type="button"
      className="btn-icon btn-sm"
      title="Spoiler? O leitor só vê a partir de uma cena (marca a seleção, ou o campo todo)"
      aria-label={`${label}: revelar a partir de…`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => setPicking(true)}
    >
      <BookOpenCheck size={14} />
    </button>
  )
}
