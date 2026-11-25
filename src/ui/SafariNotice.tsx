import { Share, X } from 'lucide-react'
import { useState } from 'react'
import { useAccount } from '../account/auth'
import { isInstalled, isIos } from '../pwa'
import { recall, remember } from '../state/prefs'

/*
 * No iPhone e no iPad, o Safari apaga o que um site guardou se ele passar 7 dias sem ser aberto (a não ser que
 * esteja instalado na Tela de Início). Quem escreve só neste aparelho e sem conta pode perder tudo sem aviso.
 * Este aviso aparece uma vez, no Início de um universo com conteúdo, e explica as duas saídas.
 */
const KEY = 'aviso-safari'

export function SafariNotice({ hasContent }: { hasContent: boolean }) {
  const { user } = useAccount()
  const [closed, setClosed] = useState(() => recall(KEY) === 'visto')
  if (closed || !hasContent || user || !isIos() || isInstalled()) return null
  const close = () => {
    remember(KEY, 'visto')
    setClosed(true)
  }
  return (
    <div className="notice safari-notice" role="note">
      <p>
        <strong>Neste {/ipad/i.test(navigator.userAgent) ? 'iPad' : 'iPhone'}, o Safari pode apagar o que fica só aqui</strong> se você passar 7 dias sem abrir o Papirus.
        Para não perder nada: instale na Tela de Início (toque em <Share size={13} aria-label="Compartilhar" /> e depois em “Adicionar à Tela de Início”) ou entre com uma conta.
        Um backup de vez em quando também ajuda.
      </p>
      <button type="button" className="btn btn-sm" onClick={close}>
        Entendi
      </button>
      <button type="button" className="btn-icon btn-sm safari-notice-x" aria-label="Fechar o aviso" onClick={close}>
        <X size={14} />
      </button>
    </div>
  )
}
