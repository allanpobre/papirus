import { createContext, useContext } from 'react'
import type { GameSystem, Group, Session } from '../../model/schema'
import type { RollOutcome } from '../../rpg/rolls'

export interface RpgState {
  group: Group
  system: GameSystem | undefined
  /** Sessão em andamento desta mesa, se houver. */
  activeSession: Session | undefined
  /** Mostra a rolagem na bandeja e, se configurado, registra na sessão em andamento. */
  report: (outcome: RollOutcome, who?: string) => void
  /** Registra um texto livre na sessão em andamento. */
  logText: (text: string, kind?: 'nota' | 'rolagem') => boolean
}

export const RpgContext = createContext<RpgState | null>(null)

export function useRpg(): RpgState {
  const v = useContext(RpgContext)
  if (!v) throw new Error('useRpg fora do RpgContext')
  return v
}
