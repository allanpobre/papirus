import { Download, Share } from 'lucide-react'
import { useState, useSyncExternalStore } from 'react'
import { canInstall, install, isInstalled, isIos, subscribeInstall } from '../pwa'

/**
 * "Instalar o app": aparece só quando o navegador oferece (Chrome, Edge, Android).
 * No iPhone/iPad, explica o caminho pelo menu Compartilhar. Já instalado, some.
 */
export function InstallButton({ className = 'btn btn-ghost btn-sm' }: { className?: string }) {
  const available = useSyncExternalStore(subscribeInstall, canInstall)
  const [iosHelp, setIosHelp] = useState(false)
  if (isInstalled()) return null
  if (available)
    return (
      <button type="button" className={className} onClick={() => void install()}>
        <Download size={15} /> Instalar o app
      </button>
    )
  if (!isIos()) return null
  return (
    <>
      <button type="button" className={className} aria-expanded={iosHelp} onClick={() => setIosHelp(!iosHelp)}>
        <Download size={15} /> Instalar o app
      </button>
      {iosHelp && (
        <p className="small muted install-help">
          No Safari, toque em <Share size={13} aria-label="Compartilhar" /> e depois em “Adicionar à Tela de Início”.
        </p>
      )}
    </>
  )
}
