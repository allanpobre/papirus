import { useSyncExternalStore } from 'react'
import { recall, remember } from '../state/prefs'

const KEY = 'sessao-fora'
const listeners = new Set<() => void>()
let value: string | null | undefined

const read = () => (value === undefined ? (value = recall(KEY)) : value)

/**
 * De qual sessão ao vivo a pessoa saiu ("Sair" do modo sessão). Fica guardado (sobrevive a recarregar)
 * e vale para todas as telas na hora: a pílula "Sessão ao vivo · Voltar" limpa daqui.
 */
export function setOutsideSession(id: string | null) {
  value = id
  remember(KEY, id)
  for (const l of listeners) l()
}

export function useOutsideSession(): string | null {
  return useSyncExternalStore((cb) => {
    listeners.add(cb)
    return () => listeners.delete(cb)
  }, read)
}
