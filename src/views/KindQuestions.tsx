import { answerOf, questionsFor } from '../logic/kindQuestions'
import { kindLabel } from '../model/labels'
import type { Entity } from '../model/schema'

/** As perguntas de uma ficha vazia: uma linha basta em cada, e dá para pular. */
export function KindQuestions({ entity: e, onAnswer, onSkip }: { entity: Entity; onAnswer: (key: string, value: string) => void; onSkip: () => void }) {
  const questions = questionsFor(e.kind)
  return (
    <section className="kind-questions" aria-label="Para começar">
      <header className="kind-questions-head">
        <h2 className="section-title">Para começar</h2>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onSkip}>
          Pular
        </button>
        <p className="muted small">
          {questions.length} perguntas sobre {kindLabel(e.kind).toLowerCase()}. Uma linha basta; as respostas viram campos da ficha.
        </p>
      </header>
      {questions.map((q) => (
        <label key={q.key} className="kind-question">
          <span className="kind-question-ask">{q.ask}</span>
          <input className="input" placeholder={q.example} value={answerOf(e.fields, q.key)} onChange={(ev) => onAnswer(q.key, ev.target.value)} />
        </label>
      ))}
    </section>
  )
}
