import { X } from 'lucide-react'
import { useEffect, useState } from 'react'

// Falta de internet já é avisada em cada lugar; aqui não repete.
const NETWORK = /Failed to fetch|NetworkError|Load failed|network|AbortError|The operation was aborted|offline/i
// Avisos inofensivos do navegador.
const NOISE = /ResizeObserver loop|Script error\.?$/i

/**
 * Quando uma ação falha sem ninguém tratar (baixar um arquivo, gerar o wiki…), mostra o
 * motivo num aviso pequeno, em vez de não acontecer nada.
 */
export function GlobalErrors() {
  const [message, setMessage] = useState<string | null>(null)
  useEffect(() => {
    let timer = 0
    const show = (reason: unknown) => {
      const text = reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : ''
      if (!text || NETWORK.test(text) || NOISE.test(text)) return
      setMessage(text)
      clearTimeout(timer)
      timer = window.setTimeout(() => setMessage(null), 9000)
    }
    const onRejection = (e: PromiseRejectionEvent) => show(e.reason)
    const onError = (e: ErrorEvent) => {
      // Erros de extensões do navegador não são do Papirus.
      if (e.filename && !e.filename.startsWith(location.origin)) return
      show(e.error ?? e.message)
    }
    addEventListener('unhandledrejection', onRejection)
    addEventListener('error', onError)
    return () => {
      clearTimeout(timer)
      removeEventListener('unhandledrejection', onRejection)
      removeEventListener('error', onError)
    }
  }, [])
  if (!message) return null
  return (
    <div className="global-error" role="alert">
      <span className="small">
        <strong>Não deu certo:</strong> {message}
      </span>
      <button type="button" className="btn-icon btn-sm" aria-label="Fechar o aviso" onClick={() => setMessage(null)}>
        <X size={14} />
      </button>
    </div>
  )
}
