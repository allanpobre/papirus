import { useEffect, useState, useSyncExternalStore } from 'react'
import type { TablePresence } from './server'

/** Quem não avisa há mais que isto saiu (fechou o celular sem dizer). */
export const PRESENCE_TTL = 50_000
/** De quanto em quanto tempo cada aparelho diz que continua na mesa. */
export const PRESENCE_EVERY = 20_000

export type Present = TablePresence & { seen: number }

/** Junta uma presença na lista (a mais nova de cada aparelho vale). */
export function withPresence(list: Present[], p: TablePresence, now: number): Present[] {
  return [...list.filter((x) => x.id !== p.id), { ...p, seen: now }]
}

/** Só quem avisou há pouco. */
export const alive = (list: Present[], now: number) => list.filter((p) => now - p.seen < PRESENCE_TTL)

/**
 * Os jogadores na mesa, um por nome: o mesmo personagem em dois aparelhos conta uma vez,
 * e quem ainda não escolheu o personagem aparece como "alguém".
 */
export function playersAt(list: Present[], now: number): { name: string | null; count: number }[] {
  const out = new Map<string, { name: string | null; count: number }>()
  for (const p of alive(list, now)) {
    if (p.role !== 'jogador') continue
    const key = p.who ?? `?${p.id}`
    const prev = out.get(key)
    out.set(key, { name: p.who, count: (prev?.count ?? 0) + 1 })
  }
  return [...out.values()].sort((a, b) => (a.name === null ? 1 : b.name === null ? -1 : a.name.localeCompare(b.name)))
}

// ─── No Papirus do mestre: quem está em cada mesa ──────────────────────

const byGroup = new Map<string, Present[]>()
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function notePresence(groupId: string, p: TablePresence) {
  byGroup.set(groupId, withPresence(byGroup.get(groupId) ?? [], p, Date.now()))
  emit()
}

export function noteLeft(groupId: string, id: string) {
  const list = byGroup.get(groupId)
  if (!list?.some((p) => p.id === id)) return
  byGroup.set(
    groupId,
    list.filter((p) => p.id !== id),
  )
  emit()
}

export function forgetGroup(groupId: string) {
  if (!byGroup.delete(groupId)) return
  emit()
}

/** Um relógio que bate a cada `ms`: quem parou de avisar some da lista sozinho. */
export function useNow(ms = 10_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

/** Os jogadores com a mesa aberta agora (a lista se atualiza sozinha). */
export function useTablePresence(groupId: string | undefined) {
  const list = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => (groupId ? byGroup.get(groupId) : undefined),
  )
  const now = useNow()
  return playersAt(list ?? [], now)
}
