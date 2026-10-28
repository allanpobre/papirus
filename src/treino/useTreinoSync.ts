import { useEffect, useSyncExternalStore } from 'react'
import { authClient, useAccount } from '../account/auth'
import { syncTreinos } from './cloud'

/** Como está a nuvem dos treinos: parada (sem conta), guardando, em dia ou com erro. */
export interface TreinoCloudState {
  state: 'sem-conta' | 'guardando' | 'ok' | 'erro'
  error?: string
}

let status: TreinoCloudState = { state: 'sem-conta' }
const listeners = new Set<() => void>()
const set = (s: TreinoCloudState) => {
  status = s
  for (const l of listeners) l()
}

let running: Promise<void> | null = null
let again = false

/** Sincroniza agora (se já estiver sincronizando, faz de novo logo depois). */
export function syncTreinosNow(account: ReturnType<typeof useAccount>) {
  const { user, server } = account
  if (!user || !server) return set({ state: 'sem-conta' })
  if (running) {
    again = true
    return
  }
  set({ state: 'guardando' })
  running = (async () => {
    try {
      await syncTreinos(await authClient(server), user.id)
      set({ state: 'ok' })
    } catch (err) {
      set({ state: 'erro', error: err instanceof Error ? err.message : String(err) })
    } finally {
      running = null
      if (again) {
        again = false
        syncTreinosNow(account)
      }
    }
  })()
}

/** O estado da nuvem dos treinos, e a primeira sincronização ao entrar com uma conta. */
export function useTreinoSync(): TreinoCloudState & { account: ReturnType<typeof useAccount> } {
  const account = useAccount()
  const userId = account.user?.id
  useEffect(() => {
    if (account.loading) return
    syncTreinosNow(account)
    // Só quando a conta muda; o resto é a cada treino guardado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, account.loading])
  const s = useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => status,
    () => status,
  )
  return { ...s, account }
}
