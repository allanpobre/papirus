import { useEffect, useState } from 'react'

/**
 * Leitor beta: selecionar um trecho (ou tocar em "Comentar esta cena") e mandar um comentário
 * para quem escreveu. O nome fica guardado neste aparelho.
 */
export function useSelectedQuote(container: React.RefObject<HTMLElement | null>, enabled: boolean): string {
  const [quote, setQuote] = useState('')
  useEffect(() => {
    if (!enabled) return
    const onChange = () => {
      const sel = document.getSelection()
      const text = sel?.toString().replace(/\s+/g, ' ').trim() ?? ''
      const inside = sel?.anchorNode && container.current?.contains(sel.anchorNode) && (sel.anchorNode.parentElement?.closest('.leitor-text') ?? null)
      setQuote(inside && text.length >= 3 ? text.slice(0, 600) : '')
    }
    document.addEventListener('selectionchange', onChange)
    return () => document.removeEventListener('selectionchange', onChange)
  }, [container, enabled])
  return quote
}
