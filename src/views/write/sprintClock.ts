import { unlockAudio } from '../../editor/keySounds'
import type { Universe } from '../../model/schema'
import { bookOnly } from '../../model/universe'
import { countWords } from '../../persistence/repository'

/**
 * Sprint de escrita: X minutos para escrever o quanto der. Continua contando se você
 * sair do Escrever; no fim, um aviso com quantas palavras saíram.
 */
export interface SprintState {
  universeId: string
  endsAt: number
  minutes: number
  /** Palavras do livro (ou do universo todo, se nenhum livro estava escolhido) quando o sprint começou. */
  startWords: number
  /** O livro do sprint: só as palavras dele contam, mesmo que se troque de livro no meio. `null` = todos. */
  bookId: string | null
}

let current: SprintState | null = null
const listeners = new Set<() => void>()
export const setSprint = (s: SprintState | null) => {
  current = s
  for (const l of listeners) l()
}
export const subscribeSprint = (cb: () => void) => {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/** Um sprint novo, valendo para o livro escolhido (`null` = o universo todo). */
export function newSprint(universe: Universe, minutes: number, bookId: string | null, now = Date.now()): SprintState {
  return { universeId: universe.id, endsAt: now + minutes * 60_000, minutes, startWords: countWords(bookOnly(universe, bookId)), bookId }
}

/** Quantas palavras saíram no sprint: só as do livro dele (apagar não conta como negativo). */
export function sprintGain(universe: Universe, sprint: SprintState): number {
  return Math.max(0, countWords(bookOnly(universe, sprint.bookId)) - sprint.startWords)
}

/** Começa um sprint de fora do Escrever (o Início tem "15 minutos"); o relógio aparece no rodapé da cena. */
export function startSprint(universe: Universe, minutes: number, bookId: string | null) {
  unlockAudio()
  setSprint(newSprint(universe, minutes, bookId))
}

export const sprintNow = () => current
