import type { ContinuityAnswer, Universe } from '../../model/schema'

/** Registra (ou troca) a resposta do autor para uma pergunta de continuidade. */
export function answerQuestion(
  universe: Universe,
  key: string,
  answer: ContinuityAnswer['answer'],
  note = '',
): Universe {
  const rest = universe.continuity.filter((a) => a.key !== key)
  return {
    ...universe,
    continuity: [...rest, { key, answer, note, at: new Date().toISOString() }],
    updatedAt: new Date().toISOString(),
  }
}

/** Esquece a resposta, reabrindo a pergunta. */
export function clearAnswer(universe: Universe, key: string): Universe {
  return { ...universe, continuity: universe.continuity.filter((a) => a.key !== key), updatedAt: new Date().toISOString() }
}
