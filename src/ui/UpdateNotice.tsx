import { RefreshCw, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { hasUpdate, subscribeUpdate } from '../pwa'

/**
 * Aviso de versão nova do Papirus (para quem deixa o app aberto e não recarrega). "Atualizar"
 * recarrega a página: o que estava aberto é salvo ao sair, como sempre. "Depois" esconde até a próxima vez.
 */
export function UpdateNotice() {
  const [ready, setReady] = useState(hasUpdate)
  const [later, setLater] = useState(false)
  useEffect(() => subscribeUpdate(() => setReady(true)), [])
  if (!ready || later) return null
  return (
    <div className="update-notice" role="status">
      <RefreshCw size={16} aria-hidden="true" />
      <span className="update-notice-text">Versão nova do Papirus</span>
      <button type="button" className="btn btn-sm btn-primary" onClick={() => location.reload()}>
        Atualizar
      </button>
      <button type="button" className="btn-icon btn-sm" aria-label="Depois" title="Depois" onClick={() => setLater(true)}>
        <X size={14} />
      </button>
    </div>
  )
}
