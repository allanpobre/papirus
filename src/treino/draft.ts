import { recall } from '../state/prefs'
import type { TreinoSetup } from './treino'

export const DRAFT = 'treino-em-andamento'

export interface Draft {
  prompt: string
  daily: boolean
  setup: TreinoSetup
  text: string
  /** Milissegundos já escritos (o relógio para quando a página fecha). */
  elapsed: number
  id: string
}

export function readDraft(): Draft | null {
  try {
    const d = JSON.parse(recall(DRAFT) ?? 'null') as Draft | null
    return d && typeof d.text === 'string' && d.setup ? d : null
  } catch {
    return null
  }
}

export const hasDraft = () => readDraft() !== null
