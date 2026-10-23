import { useSyncExternalStore } from 'react'
import type { Library } from '../persistence/repository'
import { authClient } from './auth'
import { syncAll, type SyncReport } from './cloud'

export interface CloudStatus {
  state: 'parado' | 'sincronizando' | 'ok' | 'erro'
  at?: string
  error?: string
  report?: SyncReport
}

let status: CloudStatus = { state: 'parado' }
const listeners = new Set<() => void>()
export const reportCloud = (change: Partial<CloudStatus>) => emit({ ...status, ...change })
const emit = (s: CloudStatus) => {
  status = s
  for (const l of listeners) l()
}

export function useCloudStatus(): CloudStatus {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => status,
  )
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err))

/** Sincroniza a biblioteca toda (ao entrar, ao voltar para a biblioteca, no botão). */
export async function syncLibrary(lib: Library, server: Parameters<typeof authClient>[0], userId: string): Promise<SyncReport | null> {
  emit({ ...status, state: 'sincronizando' })
  try {
    const sb = await authClient(server)
    const report = await syncAll(sb, userId, lib)
    emit({ state: 'ok', at: new Date().toISOString(), report })
    return report
  } catch (err) {
    emit({ state: 'erro', error: message(err) })
    return null
  }
}
