import { InstallButton } from '../ui/InstallButton'
import { OficinaPage } from '../oficina/OficinaPage'
import {
  BookOpen,
  GraduationCap,
  Cloud,
  Coffee,
  Dices,
  Eye,
  FileText,
  FileUp,
  FolderOpen,
  LogOut,
  Moon,
  Pencil,
  Plus,
  Rocket,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  Users,
  Wand2,
} from 'lucide-react'
import { AccountButton, AccountDialog } from '../account/AccountDialog'
import { authClient, useAccount } from '../account/auth'
import { removeFromCloud, syncedMap } from '../account/cloud'
import { useCloudStatus } from '../account/useCloud'
import { useEffect, useRef, useState } from 'react'
import { leaveShared, mySharedIds, sharedWithMe, shortName, stopSharing, type SharedWithMe } from '../share/sharing'
import { migrate } from '../model/migrations'
import { restoreEmbeddedImages } from '../images/backup'
import { setImageServer } from '../images/resolve'
import { Picture } from '../images/Picture'
import { sampleUniverse } from '../model/sample'
import type { Universe } from '../model/schema'
import { createUniverse, newId } from '../model/universe'
import { UNIVERSE_TEMPLATES, applyTemplate, type UniverseTemplate } from '../model/templates'
import { SYSTEM_TEMPLATES } from '../rpg/systems'
import type { Library, LibraryEntry } from '../persistence/repository'
import { readBackupFromFolder, pickFolder, supportsFolders } from '../persistence/folder'
import type { usePrefs } from '../state/prefs'
import type { View } from '../state/workspace'
import { ConfirmButton } from '../ui/ConfirmButton'
import { ProfilePage } from '../social/ProfilePage'
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

const TEMPLATE_ICON: Record<UniverseTemplate['id'], typeof Plus> = {
  branco: FileText,
  fantasia: Wand2,
  ficcao: Rocket,
  misterio: Search,
  realista: Coffee,
  rpg: Dices,
}

const dateFmt = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export function LibraryScreen({ library, entries, prefs, onOpen, onCreated, onChanged, onOpenShared }: Props) {
  const [name, setName] = useState('')
  const [template, setTemplate] = useState<UniverseTemplate['id']>('branco')
  const [rpgSystem, setRpgSystem] = useState('t20')
  const [error, setError] = useState<string | null>(null)
  const [accountOpen, setAccountOpen] = useState(false)
  const [oficinaOpen, setOficinaOpen] = useState(false)
  // Link de perfil (?perfil=fulano) abre direto a estante dessa pessoa.
  const [profileHandle, setProfileHandle] = useState<string | undefined>(() => new URLSearchParams(location.search).get('perfil') ?? undefined)
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
  // Capas que não estão neste aparelho vêm do servidor da conta.
  useEffect(() => {
    setImageServer(accountServer)
  }, [accountServer])
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
                <span className={`share-tag${item.role === 'editar' ? ' share-tag-edit' : ''}`}>
                  compartilhado por {shortName(item.owner_email) || 'alguém'} · {item.role === 'editar' ? 'pode editar' : 'só leitura'}
                </span>
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
      const raw: unknown = JSON.parse(await file.text())
      const file_ = migrate(raw)
      await restoreEmbeddedImages(raw)
      let u = file_.universe
      // Importar nunca sobrescreve: se o ID já existe, vira uma cópia.
      if (entries.some((e) => e.id === u.id)) u = { ...u, id: newId(), name: `${u.name} (importado)` }
      onCreated(u)
    } catch (err) {
      setError(`Não foi possível importar “${file.name}”: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const chosen = UNIVERSE_TEMPLATES.find((t) => t.id === template) ?? UNIVERSE_TEMPLATES[0]
  // Na primeira vez, o tipo escolhido arruma o menu (dá para mudar em Ajustes).
  const menuFor = (t: UniverseTemplate['id']): View[] | null => (t === 'rpg' ? ['organizar', 'conhecimento', 'livro'] : t === 'branco' ? null : ['rpg'])
  const menuNote = !p.onboarded && menuFor(template) ? (template === 'rpg' ? ' O menu começa só com o que é de mesa.' : ' A mesa de RPG fica fora do menu.') + ' Dá para mudar em Ajustes.' : ''
  const [creating, setCreating] = useState(false)
  const sampleEntry = entries.find((e) => e.sample)
  const own = entries.filter((e) => e !== sampleEntry)
  const openSample = () => (sampleEntry ? onOpen(sampleEntry.id) : void sampleUniverse().then(onCreated))

  const form = (
    <form
      className="start-card"
      aria-label="Novo universo"
      onSubmit={(e) => {
        e.preventDefault()
        if (!p.onboarded) {
          setPref('hiddenViews', menuFor(template) ?? [])
          setPref('onboarded', true)
        }
        onCreated(applyTemplate(createUniverse(name.trim() || 'Novo universo'), template, { system: rpgSystem }))
        setName('')
      }}
    >
      {!first && <h2 className="start-card-title">Novo universo</h2>}
      <label htmlFor="novo-universo" className={first ? 'start-label' : 'sr-only'}>
        Nome do novo universo
      </label>
      <div className="start-row">
        <input id="novo-universo" className="input input-lg" placeholder={first ? 'Ex.: As Cinzas de Ostria' : 'Nome'} autoFocus={!first} value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="btn btn-primary btn-lg start-submit">
          <Plus size={18} /> Criar universo
        </button>
      </div>
      <p className="start-label" id="comecar-como">
        Começar como
      </p>
      <div className="start-chips" role="radiogroup" aria-labelledby="comecar-como">
        {UNIVERSE_TEMPLATES.map((t) => {
          const Icon = TEMPLATE_ICON[t.id]
          return (
            <button key={t.id} type="button" role="radio" aria-checked={template === t.id} aria-label={t.label} className="start-chip" onClick={() => setTemplate(t.id)}>
              <Icon size={15} aria-hidden="true" /> {t.label}
            </button>
          )
        })}
      </div>
      {template === 'rpg' && (
        <>
          <p className="start-label" id="sistema-campanha">
            Sistema
          </p>
          <div className="start-chips" role="radiogroup" aria-labelledby="sistema-campanha">
            {SYSTEM_TEMPLATES.map((t) => (
              <button key={t.id} type="button" role="radio" aria-checked={rpgSystem === t.id} className="start-chip" title={t.description} onClick={() => setRpgSystem(t.id)}>
                {t.name.replace(/^Estilo /, '')}
              </button>
            ))}
          </div>
        </>
      )}
      <p className="tiny muted start-hint">
        {chosen.hint}
        {menuNote}
      </p>
    </form>
  )

  const sampleCard = (
    <section className={`sample-card${sampleEntry || !first ? ' sample-card-slim' : ''}`} aria-labelledby="exemplo-titulo">
      <span className="sample-cover" aria-hidden="true">
        <Sparkles size={20} />
      </span>
      <div className="sample-body">
        <h2 id="exemplo-titulo" className="sample-title">
          {sampleEntry ? sampleEntry.name : 'Conhecer pelo exemplo'}
        </h2>
        <p className="small muted">
          {sampleEntry
            ? `${sampleEntry.words.toLocaleString('pt-BR')} palavras. Fica só neste aparelho e não conta nas suas metas.`
            : 'O Alienista, de Machado de Assis, já montado: fichas, relações, mapa e linha do tempo. Fica só neste aparelho; mexa à vontade.'}
        </p>
        <div className="sample-actions">
          <button type="button" className={`btn btn-sm${first ? ' btn-primary' : ''}`} onClick={openSample}>
            {sampleEntry ? (
              <>
                <BookOpen size={15} /> Continuar o exemplo
              </>
            ) : (
              <>
                <Sparkles size={15} /> Abrir um universo de exemplo
              </>
            )}
          </button>
          {sampleEntry && (
            <>
              <ConfirmButton
                className="btn btn-ghost btn-sm"
                title="Recomeçar o exemplo"
                question="Desfazer o que você mexeu no exemplo e abrir de novo, como novo?"
                confirmLabel="Recomeçar"
                onConfirm={async () => {
                  await library.remove(sampleEntry.id)
                  onCreated(await sampleUniverse())
                }}
              >
                <RotateCcw size={15} /> Recomeçar
              </ConfirmButton>
              <ConfirmButton
                className="btn btn-ghost btn-sm"
                title="Tirar o exemplo"
                question="Tirar o exemplo daqui? Dá para abrir de novo quando quiser."
                confirmLabel="Tirar"
                onConfirm={async () => {
                  await library.remove(sampleEntry.id)
                  onChanged()
                }}
              >
                <Trash2 size={15} /> Tirar
              </ConfirmButton>
            </>
          )}
        </div>
      </div>
    </section>
  )

  const start = (
    <>
      <div className="library-alt">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOficinaOpen(true)}>
          <GraduationCap size={15} /> Oficina de escrita
        </button>
        <InstallButton />
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
          <FileUp size={15} /> Importar backup (.json)
        </button>
        {supportsFolders() && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
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
            <FolderOpen size={15} /> Abrir de uma pasta
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

  if (profileHandle) {
    return (
      <>
        <ProfilePage
          handle={profileHandle}
          publicUrl={p.publicUrl}
          onAccount={() => setAccountOpen(true)}
          accountButton={<AccountButton onClick={() => setAccountOpen(true)} />}
          onLeave={() => {
            history.replaceState(null, '', location.pathname)
            setProfileHandle(undefined)
          }}
        />
        {accountOpen && <AccountDialog library={library} prefs={p} setPref={setPref} onClose={() => setAccountOpen(false)} onSynced={onChanged} />}
      </>
    )
  }

  return (
    <div className={`library${first ? ' library-first' : ''}`}>
      <header className="library-top">
        {/\/app\/?$/.test(location.pathname) ? (
          <a href="../" className="library-brand" title="O que é o Papirus?">
            <Brand />
          </a>
        ) : (
          <Brand />
        )}
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
            <p className="lede">Dê um nome e comece a escrever. O resto aparece quando você precisar.</p>
          </section>
          {sharedList}
          {form}
          {sampleCard}
          {start}
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
                {cloud.state === 'sincronizando' ? 'Sincronizando com a sua conta…' : cloud.state === 'erro' ? `Não sincronizou: ${cloud.error}` : `Na sua conta (${account.user.email}).`}
              </p>
            ) : (
              <p className="lede">Tudo fica guardado neste navegador. Entre numa conta para levar seus universos para outros aparelhos, ou exporte um backup de vez em quando.</p>
            )}
          </section>

          {own.length > 0 && (
            <ul className="library-list" aria-label="Universos">
              {own.map((e) => (
                <li key={e.id} className="library-item">
                  <button type="button" className="library-open" onClick={() => onOpen(e.id)}>
                    {e.cover ? <Picture value={e.cover} className="library-cover" /> : <BookOpen size={20} aria-hidden="true" />}
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
          )}
          {sharedList}
          {creating || own.length === 0 ? (
            form
          ) : (
            <button type="button" className="btn library-new" onClick={() => setCreating(true)}>
              <Plus size={18} /> Novo universo
            </button>
          )}
          {sampleCard}
          {start}
        </main>
      )}

      {accountOpen && <AccountDialog library={library} prefs={p} setPref={setPref} onClose={() => setAccountOpen(false)} onSynced={onChanged} />}
      {oficinaOpen && <OficinaPage onClose={() => setOficinaOpen(false)} />}
    </div>
  )
}
