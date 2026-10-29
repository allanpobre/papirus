import { Check, Dices, Inbox, PenLine, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { rollIdea, type Idea, type IdeaMode } from './ideas'

/** Sorteia uma premissa (para escrever) ou um gancho (para a mesa). */
export function IdeaGenerator({ initial, onPractice, onKeep }: { initial: IdeaMode; onPractice?: (title: string, prompt: string) => void; onKeep?: (text: string) => void }) {
  const [mode, setMode] = useState<IdeaMode>(initial)
  const [idea, setIdea] = useState<Idea>(() => rollIdea(initial))
  const [spin, setSpin] = useState(0)
  const [kept, setKept] = useState(false)
  const roll = (m = mode) => {
    setIdea(rollIdea(m))
    setSpin((n) => n + 1)
    setKept(false)
  }
  return (
    <section className="oficina-ideas" aria-labelledby="oficina-ideias">
      <div className="oficina-ideas-top">
        <h2 className="oficina-h" id="oficina-ideias">
          <Sparkles size={18} aria-hidden="true" /> Gerador de ideias
        </h2>
        <div className="segmented" role="radiogroup" aria-label="Ideia para">
          {(
            [
              ['escrita', 'Para escrever'],
              ['mesa', 'Para a mesa'],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => {
                setMode(m)
                roll(m)
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <dl key={spin} className="oficina-idea" aria-live="polite">
        {idea.parts.map((p, n) => (
          <div key={p.label} style={{ '--i': n } as React.CSSProperties}>
            <dt>{p.label}</dt>
            <dd>{p.text}</dd>
          </div>
        ))}
      </dl>
      <div className="oficina-ideas-actions">
        <button type="button" className="btn btn-sm" onClick={() => roll()}>
          <Dices size={15} className={spin ? 'oficina-dice' : undefined} key={spin} /> Outra ideia
        </button>
        {mode === 'escrita' && onPractice && (
          <button type="button" className="btn btn-sm btn-primary" onClick={() => onPractice('Ideia sorteada', idea.sentence)}>
            <PenLine size={15} /> Escrever esta ideia
          </button>
        )}
        {onKeep && (
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            disabled={kept}
            onClick={() => {
              onKeep(idea.sentence)
              setKept(true)
            }}
          >
            {kept ? <Check size={15} /> : <Inbox size={15} />} {kept ? 'Guardada em Ideias' : 'Guardar em Ideias'}
          </button>
        )}
      </div>
    </section>
  )
}
