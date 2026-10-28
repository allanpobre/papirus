import { MessageSquarePlus, Send, X } from 'lucide-react'
import { useBackLayer } from '../ui/useBackLayer'
import { useEffect, useState } from 'react'
import { recall, remember } from '../state/prefs'

export type SendComment = (f: { sceneId: string; quote: string; body: string; name: string }) => Promise<void>

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

export function CommentSheet({ sceneId, sceneTitle, quote, onSend, onClose, signedName }: { sceneId: string; sceneTitle: string; quote: string; onSend: SendComment; onClose: () => void; signedName?: string }) {
  useBackLayer(onClose)
  const [body, setBody] = useState('')
  const [name, setName] = useState(() => signedName ?? recall('nome-leitor') ?? '')
  const [state, setState] = useState<'escrevendo' | 'enviando' | 'enviado'>('escrevendo')
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="leitor-comment" role="dialog" aria-label="Comentar para quem escreveu">
      <header>
        <strong className="small">Comentar {quote ? 'o trecho' : `“${sceneTitle}”`}</strong>
        <button type="button" className="btn-icon btn-sm" aria-label="Fechar" onClick={onClose}>
          <X size={16} />
        </button>
      </header>
      {state === 'enviado' ? (
        <p className="small">Enviado. Obrigado! Só quem escreveu vê o seu comentário.</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setState('enviando')
            setError(null)
            if (!signedName) remember('nome-leitor', name.trim())
            onSend({ sceneId, quote, body, name })
              .then(() => setState('enviado'))
              .catch((err) => {
                setError(err instanceof Error ? err.message : String(err))
                setState('escrevendo')
              })
          }}
        >
          {quote && <blockquote className="leitor-comment-quote small">{quote}</blockquote>}
          <label className="sr-only" htmlFor="leitor-comentario">
            Seu comentário
          </label>
          <textarea id="leitor-comentario" className="input" rows={3} maxLength={2000} autoFocus placeholder="O que você sentiu aqui? Algo confuso, um erro, uma parte que pegou você…" value={body} onChange={(e) => setBody(e.target.value)} />
          {!signedName && (
            <>
              <label className="sr-only" htmlFor="leitor-nome">
                Seu nome
              </label>
              <input id="leitor-nome" className="input input-sm" maxLength={60} placeholder="Seu nome (opcional)" value={name} onChange={(e) => setName(e.target.value)} />
            </>
          )}
          {error && (
            <p className="notice notice-error small" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary btn-sm" disabled={state === 'enviando' || !body.trim()}>
            <Send size={14} /> {state === 'enviando' ? 'Enviando…' : 'Enviar para quem escreveu'}
          </button>
        </form>
      )}
    </div>
  )
}

export function CommentFab({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="btn btn-primary leitor-comment-fab"
      // Não deixa o toque desfazer a seleção antes do clique.
      onPointerDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      <MessageSquarePlus size={16} /> Comentar o trecho
    </button>
  )
}
