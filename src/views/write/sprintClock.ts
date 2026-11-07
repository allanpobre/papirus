import { unlockAudio } from '../../editor/keySounds'
import type { Universe } from '../../model/schema'
import { countWords } from '../../persistence/repository'

/**
 * Sprint de escrita: X minutos para escrever o quanto der. Continua contando se você
 * sair do Escrever; no fim, um aviso com quantas palavras saíram.
 */
interface SprintState {
  universeId: string
  endsAt: number
  minutes: number
  startWords: number
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

/** Começa um sprint de fora do Escrever (o Início tem "15 minutos"); o relógio aparece no rodapé da cena. */
export function startSprint(universe: Universe, minutes: number) {
  unlockAudio()
  setSprint({ universeId: universe.id, endsAt: Date.now() + minutes * 60_000, minutes, startWords: countWords(universe) })
}

export const sprintNow = () => current
