import { useSyncExternalStore } from 'react'

/** Acompanha uma media query (ex.: largura da tela). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => matchMedia(query).matches,
    () => false,
  )
}
