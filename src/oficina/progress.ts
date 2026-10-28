import { useSyncExternalStore } from 'react'

/**
 * O caminho de cada pessoa na Oficina, neste aparelho: guias já abertos e exercícios feitos.
 * Não vai para o universo nem para a conta: é um caderninho de estudo.
 */
export interface OficinaProgress {
  read: string[]
  done: string[]
}

const KEY = 'papirus:oficina'
const EMPTY: OficinaProgress = { read: [], done: [] }
let cache: OficinaProgress | null = null
const listeners = new Set<() => void>()

function load(): OficinaProgress {
  if (cache) return cache
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<OficinaProgress> | null
    cache = { read: Array.isArray(raw?.read) ? raw.read : [], done: Array.isArray(raw?.done) ? raw.done : [] }
  } catch {
    cache = EMPTY
  }
  return cache
}

function save(next: OficinaProgress) {
  cache = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Sem armazenamento: o progresso vale só até fechar.
  }
  for (const l of listeners) l()
}

/** Chave de um exercício: guia + título. */
export const exerciseKey = (guide: string, title: string) => `${guide}:${title}`

export function markRead(guide: string) {
  const p = load()
  if (!p.read.includes(guide)) save({ ...p, read: [...p.read, guide] })
}

export function toggleDone(key: string) {
  const p = load()
  save({ ...p, done: p.done.includes(key) ? p.done.filter((k) => k !== key) : [...p.done, key] })
}

export function useOficinaProgress(): OficinaProgress {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    load,
    () => EMPTY,
  )
}
