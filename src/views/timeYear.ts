import { useSyncExternalStore } from 'react'

/** O ano escolhido na máquina do tempo (vale também para as Fichas e os Mapas). */
export const timeKey = (universeId: string) => `ano-mundo:${universeId}`

/**
 * O ano escolhido vale só enquanto o app está aberto (sessionStorage): ao voltar outro dia,
 * os Mapas mostram tudo de novo, sem marcadores escondidos por um ano esquecido.
 */
export function chosenYear(universeId: string): number | null {
  let v: string | null = null
  try {
    v = sessionStorage.getItem(timeKey(universeId))
  } catch {
    v = null
  }
  return v === null || v === '' || Number.isNaN(Number(v)) ? null : Number(v)
}

/** Quem quer saber quando o ano muda (a Máquina do tempo, as Fichas, os Mapas): todos veem o mesmo ano. */
const listeners = new Set<() => void>()
const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

export function rememberYear(universeId: string, year: number | null) {
  try {
    if (year === null) sessionStorage.removeItem(timeKey(universeId))
    else sessionStorage.setItem(timeKey(universeId), String(year))
  } catch {
    // Sem armazenamento: o ano vale só nesta tela.
  }
  for (const fn of listeners) fn()
}

/** O ano escolhido (ou null) e como mudá-lo. Muda em todas as telas ao mesmo tempo. */
export function useChosenYear(universeId: string): [number | null, (year: number | null) => void] {
  const year = useSyncExternalStore(
    subscribe,
    () => chosenYear(universeId),
    () => null,
  )
  return [year, (y) => rememberYear(universeId, y)]
}
