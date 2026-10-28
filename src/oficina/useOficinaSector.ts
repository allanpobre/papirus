import { useSyncExternalStore } from 'react'
import { useSectorClimate } from '../ui/sectorClimate'

const darkQuery = () => matchMedia('(prefers-color-scheme: dark)')

/** Está no escuro? A escolha em Ajustes (data-theme) ou, sem escolha, a do aparelho. */
function isDark(): boolean {
  const forced = document.documentElement.getAttribute('data-theme')
  return forced ? forced === 'dark' : darkQuery().matches
}

function useDark(): boolean {
  return useSyncExternalStore(
    (fn) => {
      const q = darkQuery()
      q.addEventListener('change', fn)
      const mo = new MutationObserver(fn)
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
      return () => {
        q.removeEventListener('change', fn)
        mo.disconnect()
      }
    },
    isDark,
    () => false,
  )
}

/** A Oficina tem o seu clima: luz âmbar de bancada, no app inteiro enquanto ela está aberta. */
export function useOficinaSector(enabled = true) {
  const dark = useDark()
  useSectorClimate(enabled ? { sector: 'oficina', oficinaModo: dark ? 'escuro' : 'claro' } : null)
}
