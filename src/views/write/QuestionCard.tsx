import { useState } from 'react'
import type { Question } from '../../logic/continuity'
import { useWorkspace } from '../../state/workspace'
import { answerQuestion, clearAnswer } from './continuityActions'

const ANSWER_LABEL = {
  erro: 'Marcado para corrigir',
  intencional: 'Intencional',
  explicacao: 'Explicado',
  depois: 'Adiado',
} as const

/** Uma pergunta de continuidade, com as respostas possíveis. */
export function QuestionCard({ q, compact = false }: { q: Question; compact?: boolean }) {
  const { update } = useWorkspace()
  const [explaining, setExplaining] = useState(false)
  const [note, setNote] = useState(q.answer?.note ?? '')
  const answer = (a: Parameters<typeof answerQuestion>[2], n = '') => update((u) => answerQuestion(u, q.key, a, n))

  return (
    <div className={`question${q.answer && q.answer.answer !== 'depois' ? ' question-answered' : ''}${compact ? ' question-compact' : ''}`}>
      <p className="question-text">{q.text}</p>
      {q.answer && q.answer.answer !== 'depois' ? (
        <div className="question-answer">
          <span className={`badge answer-${q.answer.answer}`}>{ANSWER_LABEL[q.answer.answer]}</span>
          {q.answer.note && <span className="muted small">{q.answer.note}</span>}
          <button type="button" className="link-btn" onClick={() => update((u) => clearAnswer(u, q.key))}>
            Reabrir
          </button>
        </div>
      ) : explaining ? (
        <div className="question-explain">
          <label className="sr-only" htmlFor={`exp-${q.key}`}>
            Explicação
          </label>
          <input
            id={`exp-${q.key}`}
            className="input input-sm"
            autoFocus
            placeholder="Ex.: ela usou o portal das brumas"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') answer('explicacao', note)
              if (e.key === 'Escape') setExplaining(false)
            }}
          />
          <button type="button" className="btn btn-sm btn-primary" onClick={() => answer('explicacao', note)}>
            Salvar
          </button>
        </div>
      ) : (
        <div className="question-actions">
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => answer('intencional')}>
            É intencional
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setExplaining(true)}>
            Explicar
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => answer('erro')}>
            É um erro
          </button>
          {!q.answer && (
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => answer('depois')}>
              Depois
            </button>
          )}
        </div>
      )}
    </div>
  )
}
