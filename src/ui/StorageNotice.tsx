import { HardDrive } from 'lucide-react'
import { useState } from 'react'
import { formatBytes } from '../persistence/storageQuota'
import { useStorageUse } from '../persistence/useStorageUse'
import { recall, remember } from '../state/prefs'
import { useWorkspace } from '../state/workspace'

const SNOOZE_KEY = 'espaco-aviso-ate'
const WEEK = 7 * 86400000

/**
 * Aviso de espaço quase cheio (mais de 80% do que o navegador permite). No Início, discreto: uma linha com
 * "Ver o que fazer" e "Lembrar depois" (some por uma semana). Em Ajustes › Seus dados, completo, com as saídas.
 */
export function StorageNotice({ where }: { where: 'inicio' | 'ajustes' }) {
  const { go, downloadBackup } = useWorkspace()
  const use = useStorageUse()
  const [hidden, setHidden] = useState(() => where === 'inicio' && Number(recall(SNOOZE_KEY) ?? 0) > Date.now())
  if (!use || use.level === 'ok' || hidden) return null
  const full = use.level === 'cheio'
  const message = `O espaço deste navegador está ${full ? 'quase acabando' : 'ficando cheio'}: ${use.percent}% usado (${formatBytes(use.usage)} de ${formatBytes(use.quota)}).`

  if (where === 'inicio')
    return (
      <p className={`storage-notice${full ? ' is-full' : ''}`} role="status">
        <span className="storage-notice-text">
          <HardDrive size={14} aria-hidden="true" /> {message}
        </span>
        <button type="button" className="link-btn" onClick={() => go('config', 'dados')}>
          Ver o que fazer
        </button>
        <button
          type="button"
          className="link-btn"
          onClick={() => {
            remember(SNOOZE_KEY, String(Date.now() + WEEK))
            setHidden(true)
          }}
        >
          Lembrar depois
        </button>
      </p>
    )

  return (
    <div className={`storage-notice storage-notice-card${full ? ' is-full' : ''}`} role="status">
      <p>
        <HardDrive size={16} aria-hidden="true" /> <strong>{message}</strong>
      </p>
      <p className="small">
        Quando acaba, o navegador para de guardar e você pode perder o que escrever depois. Baixe um backup e limpe as imagens que nenhum universo usa mais.
      </p>
      <div className="inline-fields">
        <button type="button" className="btn btn-primary btn-sm" onClick={downloadBackup}>
          Baixar backup agora
        </button>
        <button type="button" className="btn btn-sm" onClick={() => document.getElementById('imagens-titulo')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
          Ir para “Limpar imagens sem uso”
        </button>
      </div>
    </div>
  )
}
