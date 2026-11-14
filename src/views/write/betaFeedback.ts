import { useEffect, useSyncExternalStore } from 'react'
import { authClient, useAccount } from '../../account/auth'
import { listFeedback, type Feedback } from '../../share/feedback'
import { useWorkspace } from '../../state/workspace'

/** Comentários dos leitores beta deste universo, buscados uma vez por abertura (e a cada ação). */
let cache: { key: string; list: Feedback[]; at: number } | null = null
/** Depois disto, ao trocar de cena, busca de novo. */
const FRESH_MS = 30_000
let loading: string | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function useBetaFeedback(sceneId: string): Feedback[] {
  const { universe, source } = useWorkspace()
  const { user, server } = useAccount()
  const key = user && server && source.kind === 'proprio' ? `${user.id}:${universe.id}` : null
  const list = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => (key && cache?.key === key ? cache.list : EMPTY),
  )
  useEffect(() => {
    if (!key || !user || !server || loading === key || (cache?.key === key && Date.now() - cache.at < FRESH_MS)) return
    loading = key
    void authClient(server)
      .then((sb) => listFeedback(sb, user.id, universe.id))
      .then((got) => {
        cache = { key, list: got, at: Date.now() }
        emit()
      })
      // Sem o script no servidor (ou sem rede), a seção simplesmente não aparece.
      .catch(() => undefined)
      .finally(() => {
        loading = null
      })
  }, [key, user, server, universe.id, sceneId])
  return list
}
const EMPTY: Feedback[] = []

export function change(id: string, next: Feedback | null) {
  if (!cache) return
  cache = { ...cache, list: next ? cache.list.map((f) => (f.id === id ? next : f)) : cache.list.filter((f) => f.id !== id) }
  emit()
}
