import { useSyncExternalStore } from 'react'

/*
 * O ponto da história escolhido (a cena até onde se olha) e se a pessoa quer ver como o leitor.
 * Vale para todas as telas ao mesmo tempo e só enquanto o app está aberto (sessionStorage), como o
 * ano da Máquina do tempo: noutro dia, a ficha abre de novo mostrando tudo.
 */
export interface StoryPoint {
  /** A cena até onde se olha; `null` = a história toda. */
  sceneId: string | null
  /** Ver como o leitor: só o que ele já sabe naquele ponto. Desligado = o autor vê tudo, com marcas. */
  reader: boolean
}

const EMPTY: StoryPoint = { sceneId: null, reader: false }
const key = (universeId: string) => `ponto-historia:${universeId}`
const cache = new Map<string, { raw: string | null; value: StoryPoint }>()
const listeners = new Set<() => void>()

function read(universeId: string): StoryPoint {
  let raw: string | null = null
  try {
    raw = sessionStorage.getItem(key(universeId))
  } catch {
    raw = null
  }
  const hit = cache.get(universeId)
  if (hit && hit.raw === raw) return hit.value
  let value = EMPTY
  try {
    const v = JSON.parse(raw ?? 'null') as Partial<StoryPoint> | null
    if (v && typeof v === 'object') value = { sceneId: typeof v.sceneId === 'string' ? v.sceneId : null, reader: v.reader === true }
  } catch {
    value = EMPTY
  }
  cache.set(universeId, { raw, value })
  return value
}

export function setStoryPoint(universeId: string, next: StoryPoint) {
  try {
    if (!next.sceneId && !next.reader) sessionStorage.removeItem(key(universeId))
    else sessionStorage.setItem(key(universeId), JSON.stringify(next))
  } catch {
    // Sem armazenamento: vale só até a próxima mudança de tela.
  }
  for (const fn of listeners) fn()
}

const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

/** O ponto escolhido e como mudá-lo. Muda em todas as telas ao mesmo tempo. */
export function useStoryPoint(universeId: string): [StoryPoint, (next: StoryPoint) => void] {
  const point = useSyncExternalStore(
    subscribe,
    () => read(universeId),
    () => EMPTY,
  )
  return [point, (next) => setStoryPoint(universeId, next)]
}
