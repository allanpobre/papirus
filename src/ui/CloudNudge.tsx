import { CloudUpload, X } from 'lucide-react'
import { useState } from 'react'
import { useAccount } from '../account/auth'
import { countWords } from '../persistence/repository'
import { isSample } from '../model/sample'
import { recall, remember } from '../state/prefs'
import { useWorkspace } from '../state/workspace'

/*
 * O convite para guardar na nuvem, na hora certa (auditoria 26, Lia: “onde está o meu livro?”). Quando o livro
 * passa de mil palavras e ainda só existe neste aparelho, sem conta e sem pasta sincronizada, o Início diz isso
 * com todas as letras e oferece as duas saídas. “Agora não” some por duas semanas.
 */
export const NUDGE_WORDS = 1000
const DAYS = 14

export function CloudNudge() {
  const { universe, source, readOnly, folder, downloadBackup, openAccount } = useWorkspace()
  const { user } = useAccount()
  const key = `nuvem-convite:${universe.id}`
  const [hidden, setHidden] = useState(() => {
    const at = Date.parse(recall(key) ?? '')
    return Number.isFinite(at) && Date.now() - at < DAYS * 86400_000
  })
  if (hidden || readOnly || user || source.kind !== 'proprio' || isSample(universe) || folder.state === 'ok') return null
  const words = countWords(universe)
  if (words < NUDGE_WORDS) return null
  const later = () => {
    remember(key, new Date().toISOString())
    setHidden(true)
  }
  return (
    <div className="notice cloud-nudge" role="note" aria-label="Seu livro só está neste aparelho">
      <CloudUpload size={18} aria-hidden="true" />
      <p className="small">
        <strong>Seu livro já tem {words.toLocaleString('pt-BR')} palavras e só está neste aparelho.</strong> Se o aparelho se perder, ele vai junto.
        Com uma conta, ele fica guardado e abre em qualquer aparelho seu.
      </p>
      <span className="cloud-nudge-actions">
        <button type="button" className="btn btn-sm btn-primary" onClick={openAccount}>
          Guardar na minha conta
        </button>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => {
            downloadBackup()
            later()
          }}
        >
          Baixar uma cópia
        </button>
      </span>
      <button type="button" className="btn-icon btn-sm cloud-nudge-x" aria-label="Agora não (lembrar em duas semanas)" onClick={later}>
        <X size={14} />
      </button>
    </div>
  )
}
