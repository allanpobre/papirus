import type { SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useRef, useSyncExternalStore } from 'react'
import { migrate } from '../model/migrations'
import type { Universe } from '../model/schema'
import { newId } from '../model/universe'
import type { Library } from '../persistence/repository'
import { authClient, useAccount } from './auth'
import { CloudError, syncAll, syncedMap, upload, type SyncReport } from './cloud'

export interface CloudStatus {
  state: 'parado' | 'sincronizando' | 'ok' | 'erro'
  at?: string
  error?: string
  report?: SyncReport
}

let status: CloudStatus = { state: 'parado' }
const listeners = new Set<() => void>()
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

/**
 * Sobe o universo aberto. Se a nuvem mudou desde a última sincronização (outro aparelho),
 * a versão de lá é guardada como cópia antes, para nada se perder.
 */
async function pushOpen(sb: SupabaseClient, userId: string, lib: Library, universe: Universe): Promise<string | null> {
  const last = syncedMap(userId)[universe.id]
  const { data, error } = await sb.from('papirus_universes').select('updated_at,deleted').eq('id', universe.id).maybeSingle()
  if (error) throw new CloudError(error.message)
  const row = data as { updated_at: string; deleted: boolean } | null
  let copied: string | null = null
  if (row && !row.deleted && last && Date.parse(row.updated_at) !== Date.parse(last) && Date.parse(row.updated_at) !== Date.parse(universe.updatedAt)) {
    const full = await sb.from('papirus_universes').select('data').eq('id', universe.id).single()
    if (full.error) throw new CloudError(full.error.message)
    const theirs = migrate((full.data as { data: unknown }).data).universe
    const copy = { ...theirs, id: newId(), name: `${theirs.name} (versão da nuvem)` }
    await lib.repository(copy.id).save(copy)
    await lib.touch(copy)
    copied = copy.name
  }
  await upload(sb, userId, universe)
  return copied
}

/** Na área de trabalho: depois de cada salvamento, sobe o universo para a conta (com uma pausa). */
export function useCloudPush(lib: Library, universe: Universe, saveStatus: string, onConflict: (copyName: string) => void) {
  const account = useAccount()
  const latest = useRef(universe)
  useEffect(() => {
    latest.current = universe
  })
  const conflict = useRef(onConflict)
  useEffect(() => {
    conflict.current = onConflict
  })

  useEffect(() => {
    const { user, server } = account
    if (!user || !server || saveStatus !== 'salvo') return
    const timer = setTimeout(async () => {
      emit({ ...status, state: 'sincronizando' })
      try {
        const sb = await authClient(server)
        const copied = await pushOpen(sb, user.id, lib, latest.current)
        if (copied) conflict.current(copied)
        emit({ ...status, state: 'ok', at: new Date().toISOString() })
      } catch (err) {
        emit({ ...status, state: 'erro', error: message(err) })
      }
    }, 3000)
    return () => clearTimeout(timer)
  }, [account, saveStatus, universe.updatedAt, lib])
}
