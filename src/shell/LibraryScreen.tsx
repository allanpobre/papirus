import { BookOpen, Cloud, Dices, Eye, Feather, FileUp, FolderOpen, LogOut, Moon, Pencil, Plus, ShieldCheck, Sparkles, Sun, Trash2, Users } from 'lucide-react'
import { AccountButton, AccountDialog } from '../account/AccountDialog'
import { authClient, useAccount } from '../account/auth'
import { removeFromCloud, syncedMap } from '../account/cloud'
import { useCloudStatus } from '../account/useCloud'
import { useEffect, useRef, useState } from 'react'
import { leaveShared, mySharedIds, sharedWithMe, shortName, stopSharing, type SharedWithMe } from '../share/sharing'
import { migrate } from '../model/migrations'
import { sampleUniverse } from '../model/sample'
import type { Universe } from '../model/schema'
import { createUniverse, newId } from '../model/universe'
import type { Library, LibraryEntry } from '../persistence/repository'
import { readBackupFromFolder, pickFolder, supportsFolders } from '../persistence/folder'
import type { usePrefs } from '../state/prefs'
import type { View } from '../state/workspace'
import { ConfirmButton } from '../ui/ConfirmButton'
import { Brand } from './Brand'

interface Props {
  library: Library
  entries: LibraryEntry[]
  prefs: ReturnType<typeof usePrefs>
  onOpen: (id: string) => void
  onCreated: (u: Universe) => void
  onChanged: () => void
  onOpenShared: (item: SharedWithMe) => void
}

const dateFmt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' })

export function LibraryScreen({ library, entries, prefs, onOpen, onCreated, onChanged, onOpenShared }: Props) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [accountOpen, setAccountOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const { prefs: p, setPref } = prefs
  const dark = p.theme === 'escuro' || (p.theme === 'sistema' && matchMedia('(prefers-color-scheme: dark)').matches)
  const account = useAccount()
  const cloud = useCloudStatus()
  const synced = account.user ? syncedMap(account.user.id) : {}
  const first = entries.length === 0

  // Com conta: o que outras pessoas compartilharam comigo, e quais dos meus estão compartilhados.
  const [shared, setShared] = useState<SharedWithMe[]>([])
  const [mine, setMine] = useState<Set<string>>(new Set())
  const userId = account.user?.id
  const userEmail = account.user?.email
  const accountServer = account.server
  const [sharedNonce, setSharedNonce] = useState(0)
  useEffect(() => {
    if (!userId || !userEmail || !accountServer) return
    let off = false
    void (async () => {
      try {
        const sb = await authClient(accountServer)
        const [theirs, ours] = await Promise.all([sharedWithMe(sb, userId, userEmail), mySharedIds(sb, userId)])
        if (off) return
        setShared(theirs)
        setMine(ours)
      } catch {
        // Servidor sem o script de compartilhar: a lista só não aparece.
      }
    })()
    return () => {
      off = true
    }
  }, [userId, userEmail, accountServer, sharedNonce])
  const visibleShared = userId ? shared : []

  const sharedList = visibleShared.length > 0 && (
    <section className="library-shared" aria-labelledby="compartilhados">
      <h2 id="compartilhados" className="library-shared-title">
        <Users size={16} aria-hidden="true" /> Compartilhados com você
      </h2>
      <ul className="library-list" aria-label="Compartilhados com você">
        {visibleShared.map((item) => (
          <li key={`${item.owner_id}:${item.universe_id}`} className="library-item">
            <button type="button" className="library-open" onClick={() => onOpenShared(item)}>
              {item.role === 'editar' ? <Pencil size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
              <span className="library-name">{item.name || 'Sem nome'}</span>
              <span className="library-meta">
                <span className={`share-tag${item.role === 'editar' ? ' share-tag-edit' : ''}`}>compartilhado por {shortName(item.owner_email) || 'alguém'} · {item.role === 'editar' ? 'pode editar' : 'só leitura'}</span>
              </span>
            </button>
            <ConfirmButton
              className="btn-icon"
              title={`Sair de ${item.name}`}
              question="Sair deste universo? Ele some da sua lista; só quem é dono pode convidar de novo."
              confirmLabel="Sair"
              onConfirm={async () => {
                if (!accountServer || !userEmail) return
                try {
                  await leaveShared(await authClient(accountServer), item, userEmail)
                  setSharedNonce((n) => n + 1)
                } catch (err) {
                  setError(err instanceof Error ? err.message : String(err))
                }
              }}
            >
              <LogOut size={16} aria-label={`Sair de ${item.name}`} />
            </ConfirmButton>
          </li>
        ))}
      </ul>
    </section>
  )

  const importFile = async (file: File) => {
    setError(null)
    try {
      const file_ = migrate(JSON.parse(await file.text()))
      let u = file_.universe
      // Importar nunca sobrescreve: se o ID já existe, vira uma cópia.
      if (entries.some((e) => e.id === u.id)) u = { ...u, id: newId(), name: `${u.name} (importado)` }
      onCreated(u)
    } catch (err) {
      setError(`Não foi possível importar “${file.name}”: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const start = (
    <>
      <form
        className="library-new"
        onSubmit={(e) => {
          e.preventDefault()
          onCreated(createUniverse(name.trim() || 'Novo universo'))
          setName('')
        }}
      >
        <label htmlFor="novo-universo" className="sr-only">
          Nome do novo universo
        </label>
        <input id="novo-universo" className="input input-lg" placeholder="Nome do novo universo" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="btn btn-primary btn-lg">
          <Plus size={18} /> Criar universo
        </button>
      </form>

      <div className="library-alt">
        <button type="button" className="btn btn-ghost" onClick={() => onCreated(sampleUniverse())}>
          <Sparkles size={16} /> Abrir um universo de exemplo
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
          <FileUp size={16} /> Importar backup (.json)
        </button>
        {supportsFolders() && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={async () => {
              setError(null)
              try {
                const dir = await pickFolder('read')
                const file_ = migrate(await readBackupFromFolder(dir))
                let u = file_.universe
                if (entries.some((e) => e.id === u.id)) u = { ...u, id: newId(), name: `${u.name} (da pasta)` }
                onCreated(u)
              } catch (err) {
                if (err instanceof DOMException && err.name === 'AbortError') return
                setError(`Não foi possível abrir a pasta: ${err instanceof Error ? err.message : String(err)}`)
              }
            }}
          >
            <FolderOpen size={16} /> Abrir de uma pasta
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void importFile(f)
            e.target.value = ''
          }}
        />
      </div>
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
    </>
  )

  return (
    <div className={`library${first ? ' library-first' : ''}`}>
      <header className="library-top">
        <Brand />
        <div className="library-top-actions">
          <button type="button" className="btn-icon" aria-label={dark ? 'Usar tema claro' : 'Usar tema escuro'} onClick={() => setPref('theme', dark ? 'claro' : 'escuro')}>
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <AccountButton onClick={() => setAccountOpen(true)} />
        </div>
      </header>

      {first ? (
        <main className="library-main">
          <section className="library-hero">
            <h1>Comece seu primeiro universo</h1>
            <p className="lede">Dê um nome ao seu mundo e comece a escrever. Fichas, linha do tempo e mesa de RPG vêm quando você quiser.</p>
          </section>
          {sharedList}
          {start}
          {!p.onboarded && <Welcome onChoose={(hidden) => { setPref('hiddenViews', hidden); setPref('onboarded', true) }} />}
          <p className="landing-note small">
            <ShieldCheck size={15} aria-hidden="true" /> Sem cadastro: tudo fica neste navegador. Com uma conta (opcional), seus universos aparecem em todos os seus aparelhos.{' '}
            <a href="../">O que é o Papirus?</a>
          </p>
        </main>
      ) : (
        <main className="library-main">
          <section className="library-hero">
            <h1>Seus universos</h1>
            {account.user ? (
              <p className="library-cloud small" role="status">
                <Cloud size={14} aria-hidden="true" />{' '}
                {cloud.state === 'sincronizando'
                  ? 'Sincronizando com a sua conta…'
                  : cloud.state === 'erro'
                    ? `Não sincronizou: ${cloud.error}`
                    : `Na sua conta (${account.user.email}).`}
              </p>
            ) : (
              <p className="lede">Tudo fica guardado neste navegador. Entre numa conta para levar seus universos para outros aparelhos, ou exporte um backup de vez em quando.</p>
            )}
          </section>

          {!p.onboarded && <Welcome onChoose={(hidden) => { setPref('hiddenViews', hidden); setPref('onboarded', true) }} />}

          {start}

          <ul className="library-list" aria-label="Universos">
            {entries.map((e) => (
              <li key={e.id} className="library-item">
                <button type="button" className="library-open" onClick={() => onOpen(e.id)}>
                  <BookOpen size={20} aria-hidden="true" />
                  <span className="library-name">{e.name || 'Sem nome'}</span>
                  <span className="library-meta">
                    {e.words.toLocaleString('pt-BR')} palavras · {dateFmt.format(new Date(e.updatedAt))}
                    {account.user && (synced[e.id] ? ' · na conta' : ' · só neste aparelho')}
                    {account.user && mine.has(e.id) && (
                      <>
                        {' '}
                        <span className="share-tag">compartilhado</span>
                      </>
                    )}
                  </span>
                </button>
                <ConfirmButton
                  className="btn-icon"
                  title={`Apagar ${e.name}`}
                  question={account.user ? 'Apagar de vez este universo, aqui e na sua conta?' : 'Apagar de vez este universo e seus snapshots?'}
                  confirmLabel="Apagar universo"
                  onConfirm={async () => {
                    await library.remove(e.id)
                    if (account.user && account.server && synced[e.id]) {
                      try {
                        const sb = await authClient(account.server)
                        if (mine.has(e.id)) await stopSharing(sb, account.user.id, e.id)
                        await removeFromCloud(sb, account.user.id, e.id)
                      } catch (err) {
                        setError(`Apagado aqui, mas não na conta: ${err instanceof Error ? err.message : String(err)}`)
                      }
                    }
                    onChanged()
                  }}
                >
                  <Trash2 size={16} aria-label={`Apagar ${e.name}`} />
                </ConfirmButton>
              </li>
            ))}
          </ul>
          {sharedList}
        </main>
      )}

      {accountOpen && <AccountDialog library={library} prefs={p} setPref={setPref} onClose={() => setAccountOpen(false)} onSynced={onChanged} />}
    </div>
  )
}

/** Primeira visita: como a pessoa vai usar o Papirus, para ajustar o menu. Pode ser mudado depois. */
function Welcome({ onChoose }: { onChoose: (hiddenViews: View[]) => void }) {
  return (
    <section className="welcome" aria-label="Boas-vindas">
      <p className="welcome-title">Vou usar para:</p>
      <div className="welcome-options">
        <button type="button" className="welcome-option" onClick={() => onChoose(['rpg'])}>
          <Feather size={16} aria-hidden="true" /> Escrever histórias
        </button>
        <button type="button" className="welcome-option" onClick={() => onChoose(['organizar', 'conhecimento', 'livro'])}>
          <Dices size={16} aria-hidden="true" /> Mestrar RPG
        </button>
        <button type="button" className="welcome-option" onClick={() => onChoose([])}>
          <BookOpen size={16} aria-hidden="true" /> Os dois
        </button>
      </div>
      <p className="muted tiny">Só arruma o menu. Tudo continua disponível e dá para mudar em Ajustes.</p>
    </section>
  )
}
