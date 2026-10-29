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
  /** Começa a sessão (sem `id`: a planejada, ou uma nova) com a abertura em tela cheia, e vai para a mesa. */
  startSession: (id?: string) => void
  /** Encerra a sessão: o registro vai para Ideias e aparece o resumo. */
  endSession: (id: string) => void
  /** Abre o convite: o link e o QR code para os jogadores. */
  invite: () => void
  /** Volta para o modo sessão (a sessão ao vivo na tela toda). */
  enterSession: () => void
}

export const RpgContext = createContext<RpgState | null>(null)

export function useRpg(): RpgState {
  const v = useContext(RpgContext)
  if (!v) throw new Error('useRpg fora do RpgContext')
  return v
}
