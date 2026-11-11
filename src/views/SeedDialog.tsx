import { Sprout } from 'lucide-react'
import { useState } from 'react'
import { DEFAULT_SEED, SEED_QUESTIONS, sowWorld, type SeedAnswers } from '../logic/worldSeed'
import { useWorkspace } from '../state/workspace'
import { Modal } from '../ui/Modal'

/** Semente do mundo: cinco perguntas, e o mundo ganha as primeiras fichas já ligadas. */
export function SeedDialog({ onClose }: { onClose: () => void }) {
  const { update, toast } = useWorkspace()
  const [answers, setAnswers] = useState<SeedAnswers>(DEFAULT_SEED)
  const set = (id: keyof SeedAnswers, v: string) => setAnswers((a) => ({ ...a, [id]: v }))

  const sow = () => {
    let created = 0
    update((u) => {
      const out = sowWorld(u, answers)
      created = out.created
      return out.universe
    })
    toast(`${created} fichas plantadas, já ligadas. Mude nomes e resumos à vontade.`)
    onClose()
  }

  return (
    <Modal title="Semente do mundo" onClose={onClose} size="sm">
      <form
        className="seed-form"
        onSubmit={(e) => {
          e.preventDefault()
          sow()
        }}
      >
        <p className="muted small">Cinco perguntas, e o Papirus planta as primeiras fichas: quem manda, a capital, quem governa, quem se opõe, o que move o mundo e o que o ameaça. Tudo vira rascunho seu.</p>
        {SEED_QUESTIONS.map((q) => (
          <fieldset key={q.id} className="seed-q">
            <legend>{q.label}</legend>
            <div className="start-chips" role="radiogroup" aria-label={q.label}>
              {q.options.map(([v, label]) => (
                <button key={v} type="button" role="radio" aria-checked={answers[q.id] === v} className="start-chip" onClick={() => set(q.id, v)}>
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
        ))}
        <label className="field">
          <span className="field-label">Nome da ameaça (opcional)</span>
          <input className="input" value={answers.ameacaNome ?? ''} placeholder="O Papirus sugere um" onChange={(e) => set('ameacaNome', e.target.value)} />
        </label>
        <button type="submit" className="btn btn-primary">
          <Sprout size={16} aria-hidden="true" /> Plantar a semente
        </button>
      </form>
    </Modal>
  )
}
