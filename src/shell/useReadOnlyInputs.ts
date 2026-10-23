import { useEffect } from 'react'

const TEXT = 'input:not([type]), input[type="text"], input[type="number"], input[type="url"], textarea'
const FREE = '[data-livre], [type="search"], .settings-layout'

/**
 * Só leitura: os campos de texto da área de conteúdo ficam travados (o cursor não engana).
 * Filtros e buscas (`data-livre`) continuam livres. A garantia de verdade é o servidor;
 * isto é só para a tela não fingir que dá para escrever.
 */
export function useReadOnlyInputs(on: boolean) {
  useEffect(() => {
    const root = document.getElementById('conteudo')
    if (!on || !root) return
    const lock = () => {
      for (const el of root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(TEXT)) {
        if (!el.readOnly && !el.closest(FREE)) {
          el.readOnly = true
          el.dataset.travado = ''
        }
      }
    }
    lock()
    const obs = new MutationObserver(lock)
    obs.observe(root, { childList: true, subtree: true })
    return () => obs.disconnect()
  }, [on])
}
