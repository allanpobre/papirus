import { Map as MapIcon, PenLine, SearchCheck } from 'lucide-react'
import { useState } from 'react'
import { SCENE_SHIFTS, type Scene } from '../../model/schema'
import { updateScene } from '../../model/universe'
import { recall, remember } from '../../state/prefs'
import { useWorkspace } from '../../state/workspace'

/*
 * A escrita em três momentos (Stephen King: escreva com a porta fechada, revise com ela aberta):
 * o Mapa (planejar), a Página (escrever, sem nada em volta) e a Revisão (a margem e as perguntas).
 */

export type WritingMode = 'mapa' | 'pagina' | 'revisao'

/** Em que modo a tela de escrever abre: o último usado (Página, se nunca mudou). */
export const savedMode = (): 'pagina' | 'revisao' => (recall('escrita-modo') === 'revisao' ? 'revisao' : 'pagina')
export const saveMode = (m: 'pagina' | 'revisao') => remember('escrita-modo', m)

const MODES: [WritingMode, string, typeof PenLine][] = [
  ['mapa', 'Mapa', MapIcon],
  ['pagina', 'Página', PenLine],
  ['revisao', 'Revisão', SearchCheck],
]

/** Mapa · Página · Revisão, no alto da Escrita. */
export function WritingModes({ current, onPick }: { current: WritingMode; onPick: (m: WritingMode) => void }) {
  return (
    <nav className="writing-modes" aria-label="Momento da escrita" data-tour="modos">
      {MODES.map(([m, label, Icon]) => (
        <button key={m} type="button" aria-current={current === m ? 'page' : undefined} onClick={() => onPick(m)}>
          <Icon size={15} aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}

export const SHIFT_LABEL: Record<Exclude<Scene['shift'], ''>, string> = { melhor: 'Melhor', pior: 'Pior', igual: 'Igual' }
const SHIFT_HINT: Record<Exclude<Scene['shift'], ''>, string> = {
  melhor: 'A cena termina melhor para quem a vive',
  pior: 'A cena termina pior para quem a vive',
  igual: 'Nada muda até o fim da cena',
}

/** Como a cena termina: melhor, pior ou igual. Tocar de novo tira a marca. */
export function ShiftPicker({ scene, compact = false }: { scene: Scene; compact?: boolean }) {
  const { update, readOnly } = useWorkspace()
  return (
    <div className={`segmented shift-picker${compact ? ' is-compact' : ''}`} role="radiogroup" aria-label={`Como “${scene.title || 'Sem título'}” termina`}>
      {SCENE_SHIFTS.filter((s) => s !== '').map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          className={`shift-${s}`}
          aria-checked={scene.shift === s}
          title={SHIFT_HINT[s]}
          disabled={readOnly}
          onClick={() => update((u) => updateScene(u, scene.id, { shift: scene.shift === s ? '' : s }))}
        >
          <i aria-hidden="true" /> {SHIFT_LABEL[s]}
        </button>
      ))}
    </div>
  )
}

const FIELDS: [keyof Pick<Scene, 'want' | 'obstacle' | 'outcome'>, string, string][] = [
  ['want', 'Quem quer o quê', 'Mira quer entrar na Torre sem ser vista'],
  ['obstacle', 'O que atrapalha', 'A guardiã que devia estar morta'],
  ['outcome', 'Como termina', 'Pior: a guardiã a reconhece'],
]

/** Os três campos do cartão, para editar (no Mapa e na Revisão). */
export function CardFields({ scene, autoFocus = false }: { scene: Scene; autoFocus?: boolean }) {
  const { update, readOnly } = useWorkspace()
  return (
    <div className="card-fields">
      {FIELDS.map(([key, label, example], i) => (
        <label key={key} className="field">
          <span className="field-label">{label}</span>
          <input className="input input-sm" placeholder={example} autoFocus={autoFocus && i === 0} readOnly={readOnly} value={scene[key]} onChange={(e) => update((u) => updateScene(u, scene.id, { [key]: e.target.value.slice(0, 200) }))} />
        </label>
      ))}
    </div>
  )
}

/**
 * A moldura da Página (Anne Lamott: escreva só o que cabe numa moldura pequena): o que a cena
 * precisa fazer, em até três linhas. Sem nada preenchido, só um convite discreto.
 */
export function SceneFrame({ scene, compact = false }: { scene: Scene; compact?: boolean }) {
  const { readOnly } = useWorkspace()
  const [editing, setEditing] = useState(false)
  const filled = FIELDS.filter(([key]) => scene[key].trim())
  if (editing)
    return (
      <section className="scene-frame is-editing" aria-label="O que esta cena precisa fazer">
        <CardFields scene={scene} autoFocus />
        <button type="button" className="btn btn-sm" onClick={() => setEditing(false)}>
          Pronto
        </button>
      </section>
    )
  if (!filled.length)
    return readOnly ? null : (
      <button type="button" className="link-btn scene-frame-add" onClick={() => setEditing(true)}>
        + O que esta cena precisa fazer
      </button>
    )
  // No celular, só "como termina" (ou o que houver), para não empurrar o texto.
  const shown = compact
    ? filled
        .filter(([key]) => key === 'outcome')
        .concat(filled)
        .slice(0, 1)
    : filled
  return (
    <section className="scene-frame" aria-label="O que esta cena precisa fazer">
      {shown.map(([key, label]) => (
        <div key={key} className="scene-frame-cell">
          <span className="scene-frame-label">{label}</span>
          <span>{scene[key]}</span>
        </div>
      ))}
      {!readOnly && (
        <button type="button" className="btn-icon btn-xs scene-frame-edit" aria-label="Mudar o que esta cena precisa fazer" onClick={() => setEditing(true)}>
          <PenLine size={13} />
        </button>
      )}
    </section>
  )
}
