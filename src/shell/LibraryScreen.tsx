import { InstallButton } from '../ui/InstallButton'
import { OficinaCover } from '../oficina/OficinaHome'
import { OficinaPage } from '../oficina/OficinaPage'
import type { GuideId } from '../oficina/guides'
import { SocialDialog, type SocialTab } from '../social/SocialDialog'
import { getNoticeCount, subscribeNoticeCount } from '../social/social'
import { useMesaSector } from '../rpg/useMesaSector'
import { useOficinaSector } from '../oficina/useOficinaSector'
import {
  BookOpen,
  Download,
  GraduationCap,
  Cloud,
  Coffee,
  Dices,
  ArrowRight,
  Bell,
  Crown,
  Feather,
  Eye,
  Swords,
  Trophy,
  UserRound,
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
  Layers,
  X,
  Sun,
  Trash2,
  Users,
  Wand2,
} from 'lucide-react'
import { AccountButton, AccountDialog } from '../account/AccountDialog'
import { cleanName, families } from '../persistence/cloudCopy'
import { authClient, useAccount } from '../account/auth'
import { pendingConflicts, removeFromCloud, resolveConflict, syncedMap, type Diff } from '../account/cloud'
import { syncLibrary, useCloudStatus } from '../account/useCloud'
import { addVersion, baseName, keepVersion, repeatHints, replaceWith, trimVersions, versionLabel } from '../persistence/versions'
import { recall, remember } from '../state/prefs'
import { Modal } from '../ui/Modal'
import { TidyDialog } from './TidyDialog'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { leaveShared, mySharedIds, sharedWithMe, shortName, stopSharing, type SharedWithMe } from '../share/sharing'
import { migrate } from '../model/migrations'
import { restoreEmbeddedImages } from '../images/backup'
import { setImageServer } from '../images/resolve'
import { Picture } from '../images/Picture'
import { GeneratedCover } from '../ui/GeneratedCover'
import { sampleUniverse } from '../model/sample'
import type { Universe } from '../model/schema'
import { createUniverse, newId } from '../model/universe'
import { UNIVERSE_TEMPLATES, applyTemplate, type UniverseTemplate } from '../model/templates'
import { SYSTEM_TEMPLATES } from '../rpg/systems'
import { MESA_THEMES } from '../rpg/themes'
import { TreinoCard } from '../treino/TreinoCard'
import { countWords, type Library, type LibraryEntry } from '../persistence/repository'
import { readBackupFromFolder, pickFolder, supportsFolders } from '../persistence/folder'
import type { usePrefs } from '../state/prefs'
import type { View } from '../state/workspace'
import { ConfirmButton } from '../ui/ConfirmButton'
import { MoreMenu } from '../ui/MoreMenu'
import { relativeDate } from '../logic/relativeDate'
import { downloadText, fileNameFor } from '../export/download'
import { embeddedImages } from '../images/backup'
import { ProfilePage } from '../social/ProfilePage'
import { Brand } from './Brand'
import { PageHelp } from '../ui/PageTour'

interface Props {
  library: Library
  entries: LibraryEntry[]
  prefs: ReturnType<typeof usePrefs>
  onOpen: (id: string, view?: View) => void
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
  const [oficinaOpen, setOficinaOpen] = useState<GuideId | null>(null)
  const [socialTab, setSocialTab] = useState<SocialTab | null>(null)
  const [greeting] = useState(() => {
    const hour = new Date().getHours()
    return hour < 5 ? 'Boa noite' : hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  })
  // Link de perfil (?perfil=fulano) abre direto a estante dessa pessoa.
  const [profileHandle, setProfileHandle] = useState<string | undefined>(() => new URLSearchParams(location.search).get('perfil') ?? undefined)
  const fileRef = useRef<HTMLInputElement>(null)
  const { prefs: p, setPref } = prefs
  const dark = p.theme === 'escuro' || (p.theme === 'sistema' && matchMedia('(prefers-color-scheme: dark)').matches)
  const account = useAccount()
  const cloud = useCloudStatus()
  const synced = account.user ? syncedMap(account.user.id) : {}
  // Universos cujos dois lados mudaram no mesmo lugar: esperam a escolha da pessoa.
  const pending = account.user ? pendingConflicts(account.user.id) : {}
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
  // Vindo de "Começar a mestrar" na apresentação: abre já na aba Mesa.
  useEffect(() => {
    if (!new URLSearchParams(location.search).has('mestrar')) return
    history.replaceState(history.state, '', location.pathname)
    setPref('sector', 'rpg')
  }, [setPref])
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
      const u = file_.universe
      // Importar nunca sobrescreve sozinho: se este universo já está aqui, a pessoa escolhe o que fazer com o backup.
      const here = entries.find((e) => e.id === u.id)
      if (here) setImporting({ backup: u, here: here.cloudCopyOf ? (entries.find((e) => e.id === here.cloudCopyOf) ?? here) : here })
      else onCreated(u)
    } catch (err) {
      setError(`Não foi possível importar “${file.name}”: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  /** Backup de um universo direto da lista, sem abrir (com as imagens dentro, como o de dentro do universo). */
  const downloadBackup = async (e: LibraryEntry) => {
    const repo = library.repository(e.id)
    const u = await repo.load()
    if (!u) return
    const file = repo.toFile(u)
    const images = await embeddedImages(u).catch(() => ({}))
    const date = new Date().toISOString().slice(0, 10)
    downloadText(fileNameFor(`${u.name}-backup-${date}`, 'json'), JSON.stringify(Object.keys(images).length ? { ...file, images } : file, null, 2), 'application/json')
    setPref('backups', { ...p.backups, [e.id]: { ...p.backups[e.id], last: new Date().toISOString() } })
  }

  // Backup de um universo que já está aqui: esperando a escolha (versão, substituir ou outro universo).
  const [importing, setImporting] = useState<{ backup: Universe; here: LibraryEntry } | null>(null)
  /** Depois de mexer em versões: mostra a lista de novo e, com conta, leva para a nuvem o que mudou. */
  const afterVersions = () => {
    onChanged()
    if (account.user && account.server) void syncLibrary(library, account.server, account.user.id).then(() => onChanged())
  }
  /** Tira da nuvem os que deixaram de ser universo (viraram versão ou foram apagados). */
  const leaveCloud = async (ids: string[]) => {
    if (!account.user || !account.server || !ids.length) return
    const sb = await authClient(account.server)
    for (const id of ids) {
      if (mine.has(id)) await stopSharing(sb, account.user.id, id)
      await removeFromCloud(sb, account.user.id, id)
    }
  }
  // "São universos diferentes": pares de nome igual que a pessoa já disse que não são o mesmo livro.
  const [different, setDifferent] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(recall('repetidos-diferentes') ?? '[]') as string[])
    } catch {
      return new Set()
    }
  })
  const [tidying, setTidying] = useState(false)
  // O que há para arrumar: versões guardadas que ainda estão na nuvem, ou universos de mesmo nome.
  // "Agora não": grupos dispensados (pela lista dos ids); um grupo que muda volta a avisar.
  const groupKey = (g: LibraryEntry[]) => g.map((e) => e.id).sort().join('|')
  const [dismissed, setDismissed] = useState<string[]>(() => {
    try {
      return JSON.parse(recall('repetidos-dispensados') ?? '[]') as string[]
    } catch {
      return []
    }
  })
  const repeats = repeatHints(entries, (id) => Boolean(synced[id]), different).filter((g) => !dismissed.includes(groupKey(g)))
  const [notice, setNotice] = useState<string | null>(null)
  // O universo cuja escolha (juntar, ficar com um lado) está sendo aplicada.
  const [resolving, setResolving] = useState<string | null>(null)

  const chosen = UNIVERSE_TEMPLATES.find((t) => t.id === template) ?? UNIVERSE_TEMPLATES[0]
  const [creating, setCreating] = useState(false)
  // Um item por universo: as versões guardadas (cópias de quando os dois lados mudaram) ficam dentro do universo delas.
  const fams = useMemo(() => families(entries), [entries])
  const versionsOf = useMemo(() => new Map(fams.map((f) => [f.main.id, f.versions])), [fams])
  const mains = useMemo(() => fams.map((f) => f.main), [fams])
  const sampleEntry = mains.find((e) => e.sample)
  const own = mains.filter((e) => e !== sampleEntry)
  const writing = own.filter((e) => e.kind !== 'campanha')
  const campaigns = own.filter((e) => e.kind === 'campanha')
  // Universos de escrita que também têm uma mesa (o exemplo, por exemplo).
  const tablesInBooks = mains.filter((e) => e.kind !== 'campanha' && e.sessions !== undefined)
  // Livros sem Mesa: dá para começar uma Mesa no mesmo mundo.
  const booksToPlay = writing.filter((e) => e.sessions === undefined)
  const openSample = () => (sampleEntry ? onOpen(sampleEntry.id) : void sampleUniverse().then(onCreated))
  const sector = p.sector
  const news = useSyncExternalStore(subscribeNoticeCount, getNoticeCount)
  const setSector = (s: typeof sector) => {
    setCreating(false)
    setPref('sector', s)
    scrollTo({ top: 0 })
  }

  const create = (kind: 'escrita' | 'campanha') => {
    if (!p.onboarded) setPref('onboarded', true)
    const fallback = kind === 'campanha' ? 'Nova campanha' : 'Novo universo'
    onCreated(applyTemplate(createUniverse(name.trim() || fallback), kind === 'campanha' ? 'rpg' : template, { system: rpgSystem }))
    setName('')
  }

  const form = (
    <form
      className="start-card"
      aria-label="Novo universo"
      onSubmit={(e) => {
        e.preventDefault()
        create('escrita')
      }}
    >
      {writing.length > 0 && <h2 className="start-card-title">Novo universo</h2>}
      <label htmlFor="novo-universo" className={writing.length === 0 ? 'start-label' : 'sr-only'}>
        Nome do novo universo
      </label>
      <div className="start-row">
        <input id="novo-universo" className="input input-lg" placeholder={writing.length === 0 ? 'Ex.: As Cinzas de Ostria' : 'Nome'} autoFocus={writing.length > 0} value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="btn btn-primary btn-lg start-submit">
          <Plus size={18} /> Criar universo
        </button>
      </div>
      <p className="start-label" id="comecar-como">
        Começar como
      </p>
      <div className="start-chips" role="radiogroup" aria-labelledby="comecar-como">
        {UNIVERSE_TEMPLATES.filter((t) => t.id !== 'rpg').map((t) => {
          const Icon = TEMPLATE_ICON[t.id]
          return (
            <button key={t.id} type="button" role="radio" aria-checked={template === t.id} aria-label={t.label} className="start-chip" onClick={() => setTemplate(t.id)}>
              <Icon size={15} aria-hidden="true" /> {t.label}
            </button>
          )
        })}
      </div>
      <p className="tiny muted start-hint">{chosen.hint}</p>
    </form>
  )

  const campaignForm = (
    <form
      className="start-card"
      aria-label="Nova campanha"
      onSubmit={(e) => {
        e.preventDefault()
        create('campanha')
      }}
    >
      {campaigns.length > 0 && <h2 className="start-card-title">Nova campanha</h2>}
      <label htmlFor="nova-campanha" className={campaigns.length === 0 ? 'start-label' : 'sr-only'}>
        Nome da campanha
      </label>
      <div className="start-row">
        <input id="nova-campanha" className="input input-lg" placeholder="Ex.: A Queda de Valkaria" autoFocus={campaigns.length > 0} value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="btn btn-primary btn-lg start-submit">
          <Plus size={18} /> Criar campanha
        </button>
      </div>
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
      <p className="tiny muted start-hint">A mesa já vem pronta: o sistema, a sessão 1 e uma tabela de rumores. Você joga com dados de verdade; o Papirus guarda as fichas e mostra o Codex aos jogadores.</p>
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
            : 'O Alienista, de Machado de Assis, já montado: fichas, ligações, mapas e linha do tempo. Fica só neste aparelho; mexa à vontade.'}
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

  /** No setor RPG, cada mesa aparece nas cores do tema que o mestre escolheu para ela. */
  const themeStyle = (e: LibraryEntry): React.CSSProperties | undefined => {
    const t = sector === 'rpg' ? MESA_THEMES.find((x) => x.id === e.theme) : undefined
    if (!t) return undefined
    const [bg, card, accent] = dark ? t.dark : t.light
    return {
      '--accent': accent,
      '--surface': card,
      '--accent-faint': `color-mix(in srgb, ${accent} 14%, ${card})`,
      '--accent-soft': `color-mix(in srgb, ${accent} 24%, ${card})`,
      '--accent-ink': dark ? bg : '#fff',
      '--line': `color-mix(in srgb, ${accent} 32%, transparent)`,
    } as React.CSSProperties
  }

  /** O nome que dá a cor e o desenho da capa gerada (o exemplo, sem o "Exemplo —"). */
  const coverName = (e: LibraryEntry) => cleanName(e.name).replace(/^Exemplo\s*[—–-]\s*/, '') || 'Sem nome'

  const when = (e: LibraryEntry) => (
    <time dateTime={e.updatedAt} title={dateFmt.format(new Date(e.updatedAt))}>
      {relativeDate(e.updatedAt)}
    </time>
  )

  /** Apaga daqui e, se subiu algum dia, da conta. */
  const removeEverywhere = async (e: LibraryEntry) => {
    await library.remove(e.id)
    if (!account.user || !account.server || !synced[e.id]) return
    try {
      const sb = await authClient(account.server)
      if (mine.has(e.id)) await stopSharing(sb, account.user.id, e.id)
      await removeFromCloud(sb, account.user.id, e.id)
    } catch (err) {
      setError(`Apagado aqui, mas não na conta: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  /** O lado da nuvem da dupla: igual ao deste aparelho, a caminho, ou parado. */
  const cloudSide = (e: LibraryEntry): { state: 'ok' | 'busy' | 'warn'; text: string } => {
    if (pending[e.id]) return { state: 'warn', text: 'diferente' }
    const last = synced[e.id]
    if (last && Date.parse(last) === Date.parse(e.updatedAt)) return { state: 'ok', text: 'igual' }
    if (cloud.state === 'sincronizando') return { state: 'busy', text: 'enviando…' }
    if (cloud.state === 'erro') return { state: 'warn', text: 'não sincronizou' }
    return { state: 'busy', text: 'falta enviar' }
  }

  /** "3 cenas e 1 ficha mudaram". */
  const diffText = (d: Diff, verb: [string, string]) => {
    const parts = [d.scenes && `${d.scenes} ${d.scenes === 1 ? 'cena' : 'cenas'}`, d.entities && `${d.entities} ${d.entities === 1 ? 'ficha' : 'fichas'}`].filter(Boolean)
    if (!parts.length) return 'cenas e fichas iguais'
    return `${parts.join(' e ')} ${d.scenes + d.entities === 1 ? verb[0] : verb[1]}`
  }
  /** A escolha da pessoa para um universo com os dois lados diferentes. */
  const resolve = async (e: LibraryEntry, how: 'juntar' | 'aqui' | 'nuvem') => {
    if (!account.user || !account.server) return
    setResolving(e.id)
    setError(null)
    const name = cleanName(e.name) || 'Sem nome'
    try {
      const copies = await resolveConflict(await authClient(account.server), account.user.id, library, e.id, how)
      setNotice(
        how === 'juntar'
          ? `Juntei as duas versões de “${name}”.${copies.length ? ` Onde o mesmo item mudou dos dois lados (${copies.length === 1 ? `“${copies[0]}”` : `${copies.length} itens`}), o da nuvem entrou ao lado, com “(versão de outro aparelho)” no nome.` : ''}`
          : how === 'aqui'
            ? `“${name}” ficou com a versão deste aparelho. A da nuvem está guardada como versão.`
            : `“${name}” ficou com a versão da nuvem. A deste aparelho está guardada como versão.`,
      )
    } catch (err) {
      setError(`Não deu para resolver “${name}”: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setResolving(null)
      afterVersions()
    }
  }

  const universeItem = (e: LibraryEntry, view?: View) => {
    const versions = versionsOf.get(e.id) ?? []
    const conflict = account.user && !view ? pending[e.id] : undefined
    return (
    <li key={e.id} className={`library-item${themeStyle(e) ? ' is-themed' : ''}${e.sample ? ' is-sample' : ''}`} style={themeStyle(e)}>
      <button type="button" className="library-open" onClick={() => onOpen(e.id, view)}>
        {e.cover ? <Picture value={e.cover} className="library-cover" /> : <GeneratedCover name={coverName(e)} tone={themeStyle(e) ? 'var(--accent)' : undefined} className="library-cover" />}
        <span className="library-name">
          {/* O selo já diz que é exemplo: o nome fica só com o título. */}
          {e.sample ? (
            <>
              <span className="library-name-text">{cleanName(e.name).replace(/^Exemplo\s*[—–-]\s*/, '') || 'Sem nome'}</span>
              <span className="sample-chip">Exemplo</span>
            </>
          ) : (
            cleanName(e.name) || 'Sem nome'
          )}
        </span>
        <span className="library-meta">
          {e.sample
            ? 'Só neste aparelho · mexa à vontade'
            : e.kind === 'campanha' || view === 'rpg'
              ? `${e.sessions ?? 0} ${e.sessions === 1 ? 'sessão' : 'sessões'} · ${e.sheets ?? 0} ${e.sheets === 1 ? 'personagem' : 'personagens'}`
              : `${e.words.toLocaleString('pt-BR')} palavras`}
          {!e.sample && (
            <>
              {' · '}
              {when(e)}
            </>
          )}
          {account.user && mine.has(e.id) && (
            <>
              {' '}
              <span className="share-tag">compartilhado</span>
            </>
          )}
        </span>
      </button>
      {/* Menos usado fica no ···: baixar o backup e apagar (apagar fica no setor do próprio universo; um livro com mesa não some pelo RPG). */}
      {!view && (
        <MoreMenu label={`Mais ações de ${cleanName(e.name) || 'Sem nome'}`}>
          {(close) => (
            <>
              <button
                type="button"
                className="more-menu-item"
                onClick={() => {
                  close()
                  onOpen(e.id)
                }}
              >
                <BookOpen size={16} /> Abrir
              </button>
              {e.sample ? (
                <>
                  <ConfirmButton
                    className="more-menu-item"
                    question="Desfazer o que você mexeu no exemplo e abrir de novo, como novo?"
                    confirmLabel="Recomeçar"
                    onConfirm={async () => {
                      close()
                      await library.remove(e.id)
                      onCreated(await sampleUniverse())
                    }}
                  >
                    <RotateCcw size={16} /> Recomeçar o exemplo
                  </ConfirmButton>
                  <ConfirmButton
                    className="more-menu-item more-menu-danger"
                    question="Tirar o exemplo daqui? Dá para abrir de novo quando quiser."
                    confirmLabel="Tirar"
                    onConfirm={async () => {
                      close()
                      await library.remove(e.id)
                      onChanged()
                    }}
                  >
                    <Trash2 size={16} /> Tirar o exemplo
                  </ConfirmButton>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="more-menu-item"
                    onClick={() => {
                      close()
                      void downloadBackup(e)
                    }}
                  >
                    <Download size={16} /> Baixar backup (.json)
                  </button>
                  <ConfirmButton
                    className="more-menu-item more-menu-danger"
                    question={`${account.user ? 'Apagar de vez, aqui e na sua conta' : 'Apagar de vez, com os snapshots'}${versions.length ? ` (e ${versions.length === 1 ? 'a versão guardada' : `as ${versions.length} versões guardadas`})` : ''}?`}
                    confirmLabel={e.kind === 'campanha' ? 'Apagar campanha' : 'Apagar universo'}
                    onConfirm={async () => {
                      close()
                      // As versões guardadas são deste universo: vão junto.
                      for (const v of [...versions, e]) await removeEverywhere(v)
                      onChanged()
                    }}
                  >
                    <Trash2 size={16} /> Apagar…
                  </ConfirmButton>
                </>
              )}
            </>
          )}
        </MoreMenu>
      )}
      {!view && !e.sample && (account.user || versions.length > 0) && (
        <div className="library-extra">
          {/* A dupla: o deste aparelho e o da nuvem são o mesmo universo. */}
          {account.user && (
            <div className="library-pair" role="group" aria-label={`Onde está ${cleanName(e.name) || 'este universo'}`}>
              <span className={`pair-side${conflict ? ' is-warn' : ''}`}>
                <span className="pair-label">Neste aparelho</span>
                <span className="pair-value">{when(e)}</span>
              </span>
              <span className={`pair-side is-${cloudSide(e).state}`}>
                <span className="pair-label">Na nuvem</span>
                <span className="pair-value">{cloudSide(e).text}</span>
              </span>
            </div>
          )}
          {/* Os dois lados mudaram no mesmo lugar: a pergunta aparece aqui, dentro da dupla. */}
          {conflict && (
            <div className="pair-conflict" role="group" aria-label={`Duas versões de ${cleanName(e.name) || 'Sem nome'}`}>
              <p className="pair-conflict-title">Este universo mudou aqui e em outro aparelho</p>
              <div className="pair-conflict-sides">
                <div className="pair-conflict-side">
                  <span className="pair-label">Neste aparelho</span>
                  <strong>{when(e)}</strong>
                  <span>{e.words.toLocaleString('pt-BR')} palavras</span>
                  {conflict.here && <span className="muted">{diffText(conflict.here, ['mudou', 'mudaram'])}</span>}
                </div>
                <div className="pair-conflict-side">
                  <span className="pair-label">Na nuvem</span>
                  <strong>
                    <time dateTime={conflict.cloudAt} title={dateFmt.format(new Date(conflict.cloudAt))}>
                      {relativeDate(conflict.cloudAt)}
                    </time>
                  </strong>
                  <span>{conflict.cloudWords.toLocaleString('pt-BR')} palavras</span>
                  {conflict.cloud && <span className="muted">{diffText(conflict.cloud, ['mudou', 'mudaram'])}</span>}
                </div>
              </div>
              <p className="small pair-conflict-why">
                {conflict.overlap.length > 0
                  ? `Mudou dos dois lados: ${conflict.overlap.slice(0, 3).map((x) => (/^(o|a|os|as) /.test(x) ? x : `“${x}”`)).join(', ')}${conflict.overlap.length > 3 ? ` e mais ${conflict.overlap.length - 3}` : ''}.`
                  : `Entre as duas: ${diffText(conflict.between, ['diferente', 'diferentes'])}.`}
              </p>
              <div className="pair-conflict-actions">
                {conflict.canMerge && (
                  <button type="button" className="btn btn-sm btn-primary" disabled={resolving !== null} onClick={() => void resolve(e, 'juntar')}>
                    Juntar as duas
                  </button>
                )}
                <button type="button" className="btn btn-sm" disabled={resolving !== null} onClick={() => void resolve(e, 'aqui')}>
                  Ficar com a deste aparelho
                </button>
                <button type="button" className="btn btn-sm" disabled={resolving !== null} onClick={() => void resolve(e, 'nuvem')}>
                  Ficar com a da nuvem
                </button>
              </div>
              <p className="tiny muted">
                A que não ficar vira versão guardada. {conflict.canMerge && 'Juntando, onde o mesmo item mudou dos dois lados, fica o deste aparelho e o da nuvem entra ao lado.'}
              </p>
            </div>
          )}
          {versions.length > 0 && (
            <details className="library-versions">
              <summary>
                {versions.length === 1 ? '1 versão guardada' : `${versions.length} versões guardadas`}
                <span className="muted"> · só neste aparelho</span>
              </summary>
              <p className="tiny muted">Outras versões deste universo: a que estava na nuvem quando ele mudou em dois aparelhos, um backup importado, ou a que ele era antes de uma troca. Ficam só neste aparelho.</p>
              <ul className="library-version-list" aria-label={`Versões guardadas de ${cleanName(e.name) || 'Sem nome'}`}>
                {versions.map((v) => (
                  <li key={v.id} className="library-version">
                    <span className="library-version-what">
                      {v.versionKind === 'backup' || v.versionKind === 'anterior' ? <Layers size={13} aria-hidden="true" /> : <Cloud size={13} aria-hidden="true" />} {versionLabel(v.versionKind)} · {when(v)} ·{' '}
                      {v.words.toLocaleString('pt-BR')} palavras
                    </span>
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => onOpen(v.id)}>
                      Abrir
                    </button>
                    <ConfirmButton
                      className="btn btn-sm btn-ghost"
                      question="Trocar o universo por esta versão? O que está no universo agora fica guardado como versão."
                      confirmLabel="Ficar com esta"
                      onConfirm={async () => {
                        await keepVersion(library, e.id, v.id)
                        setNotice(`“${cleanName(e.name) || 'Sem nome'}” agora é a versão de ${relativeDate(v.updatedAt)}. A que estava antes ficou guardada.`)
                        afterVersions()
                      }}
                    >
                      Ficar com esta
                    </ConfirmButton>
                    <button type="button" className="btn-icon btn-sm" aria-label="Baixar backup desta versão" title="Baixar backup (.json)" onClick={() => void downloadBackup(v)}>
                      <Download size={15} />
                    </button>
                    <ConfirmButton
                      className="btn-icon btn-sm"
                      title="Apagar esta versão"
                      question="Apagar esta versão guardada? O universo continua como está."
                      confirmLabel="Apagar versão"
                      onConfirm={async () => {
                        await removeEverywhere(v)
                        onChanged()
                      }}
                    >
                      <Trash2 size={15} aria-label="Apagar esta versão" />
                    </ConfirmButton>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </li>
  )
  }

  /** Aviso de que há livros repetidos para arrumar, e o recado do que acabou de ser feito com uma versão. */
  const tidyCard = (
    <>
      {notice && (
        <p className="library-notice" role="status">
          <span>{notice}</span>
          <button type="button" className="btn-icon btn-sm" aria-label="Fechar o aviso" onClick={() => setNotice(null)}>
            <X size={14} />
          </button>
        </p>
      )}
      {repeats.length > 0 && (
        <section className="tidy-card" aria-label="Livros repetidos">
          <Layers size={20} aria-hidden="true" />
          <p>
            <strong>{repeats.length === 1 ? 'Um livro aparece mais de uma vez.' : `${repeats.length} livros aparecem mais de uma vez.`}</strong> Arrumar deixa um universo por livro
            {account.user ? ', e um só na nuvem' : ''}. Você escolhe qual fica; os outros viram versões guardadas.
          </p>
          <span className="tidy-card-actions">
            <button type="button" className="btn btn-sm btn-primary" onClick={() => setTidying(true)}>
              Arrumar
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => {
                const next = [...dismissed, ...repeats.map(groupKey)]
                setDismissed(next)
                remember('repetidos-dispensados', JSON.stringify(next))
              }}
            >
              Agora não
            </button>
          </span>
        </section>
      )}
    </>
  )

  /** Backup de um universo que já está aqui: o que fazer com ele. */
  const importChoice = importing && (
    <Modal title="Este universo já está aqui" onClose={() => setImporting(null)} size="sm">
      <p>O backup é de “{cleanName(importing.here.name) || 'Sem nome'}”, que já está neste aparelho.</p>
      <dl className="import-compare">
        <div>
          <dt>Aqui</dt>
          <dd>
            {when(importing.here)} · {importing.here.words.toLocaleString('pt-BR')} palavras
          </dd>
        </div>
        <div>
          <dt>No backup</dt>
          <dd>
            {relativeDate(importing.backup.updatedAt)} · {countWords(importing.backup).toLocaleString('pt-BR')} palavras
          </dd>
        </div>
      </dl>
      <div className="import-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={async () => {
            const { backup, here } = importing
            setImporting(null)
            await addVersion(library, here.id, backup, 'backup')
            const out = await trimVersions(library, here.id)
            await leaveCloud(out.map((e) => e.id).filter((id) => synced[id])).catch(() => undefined)
            setNotice(`O backup ficou guardado como versão de “${cleanName(here.name) || 'Sem nome'}”.${out.length ? ' A versão mais antiga saiu para dar lugar (ficam 5).' : ''}`)
            afterVersions()
          }}
        >
          Guardar como versão
        </button>
        <button
          type="button"
          className="btn"
          onClick={async () => {
            const { backup, here } = importing
            setImporting(null)
            await replaceWith(library, here.id, backup)
            const out = await trimVersions(library, here.id)
            await leaveCloud(out.map((e) => e.id).filter((id) => synced[id])).catch(() => undefined)
            setNotice(`“${baseName(backup.name) || 'Sem nome'}” agora é o do backup. O que estava aqui ficou guardado como versão.`)
            afterVersions()
          }}
        >
          Substituir pelo backup
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            const { backup } = importing
            setImporting(null)
            onCreated({ ...backup, id: newId(), name: `${backup.name} (importado)` })
          }}
        >
          Criar outro universo
        </button>
      </div>
      <p className="tiny muted">Guardando como versão, o universo não muda: o backup fica dentro dele, para abrir ou ficar com ele depois. Substituindo, o que está aqui agora vira versão guardada.</p>
    </Modal>
  )

  /** O cartão grande do começo: voltar para onde parou. */
  const continueCard = (e: LibraryEntry, label: string, view?: View) => (
    <button type="button" className={`hub-continue${themeStyle(e) ? ' is-themed' : ''}`} style={themeStyle(e)} onClick={() => onOpen(e.id, view)}>
      {e.cover ? <Picture value={e.cover} className="hub-continue-cover" /> : <GeneratedCover name={coverName(e)} tone={themeStyle(e) ? 'var(--accent)' : undefined} className="hub-continue-cover" />}
      <span className="hub-continue-text">
        <span className="hub-kicker">{label}</span>
        <strong className="hub-continue-name">{cleanName(e.name) || 'Sem nome'}</strong>
        <span className="muted small">
          {e.kind === 'campanha' ? `${e.sessions ?? 0} ${e.sessions === 1 ? 'sessão' : 'sessões'}` : `${e.words.toLocaleString('pt-BR')} palavras`} · {when(e)}
          {account.user && ` · na nuvem: ${cloudSide(e).text}`}
        </span>
      </span>
      <ArrowRight size={20} className="hub-continue-go" aria-hidden="true" />
    </button>
  )

  const notices = news
  const socialCard = (
    <section className="hub-social" aria-labelledby="amigos-titulo">
      <h2 id="amigos-titulo" className="hub-h">
        <Users size={17} aria-hidden="true" /> Amigos e estante
      </h2>
      {account.user ? (
        <>
          <p className="small muted">O que seus amigos andam escrevendo, a estante deles e os desafios.</p>
          <button type="button" className="btn btn-sm btn-primary hub-to-community" onClick={() => setSector('comunidade')}>
            <Users size={15} aria-hidden="true" /> Abrir a Comunidade
          </button>
          <div className="hub-social-grid">
            <button type="button" className="hub-social-btn" onClick={() => setSocialTab('avisos')}>
              <Bell size={18} aria-hidden="true" /> Novidades
              {notices > 0 && <span className="rail-badge">{notices}</span>}
            </button>
            <button type="button" className="hub-social-btn" onClick={() => setSocialTab('amigos')}>
              <Users size={18} aria-hidden="true" /> Amigos
            </button>
            <button type="button" className="hub-social-btn" onClick={() => setSocialTab('desafios')}>
              <Trophy size={18} aria-hidden="true" /> Desafios
            </button>
            <button type="button" className="hub-social-btn" onClick={() => setSocialTab('perfil')}>
              <UserRound size={18} aria-hidden="true" /> Seu perfil
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="small muted">Com uma conta (opcional), você ganha um perfil, adiciona amigos, lê o que eles põem na estante e entra nos desafios. Seus livros só aparecem lá se você escolher.</p>
          <button type="button" className="btn btn-sm" onClick={() => setAccountOpen(true)}>
            <UserRound size={15} /> Criar conta ou entrar
          </button>
        </>
      )}
    </section>
  )


  const escrita = (
    <>
      <section className="hub-hero">
        <p className="hub-kicker">
          <Feather size={14} aria-hidden="true" /> Escrita
        </p>
        <h1>{writing.length ? `${greeting}. O que vamos escrever?` : 'Comece seu primeiro universo'}</h1>
        {!writing.length && <p className="lede">Dê um nome e comece a escrever. Fichas, mapas e linha do tempo aparecem quando você precisar.</p>}
        {account.user && (
          <p className="library-cloud small" role="status">
            <Cloud size={14} aria-hidden="true" />{' '}
            {cloud.state === 'sincronizando'
              ? 'Sincronizando com a sua conta…'
              : cloud.state === 'erro'
                ? `Não sincronizou: ${cloud.error}`
                : `Na sua conta (${account.user.email}).${cloud.report?.merged ? ` Juntei o que mudou aqui e em outro aparelho em ${cloud.report.merged === 1 ? '1 universo' : `${cloud.report.merged} universos`}.` : ''}`}
          </p>
        )}
      </section>
      {tidyCard}
      {/* Na primeira vez, criar vem primeiro; depois, o mais recente com "Continuar" e a lista (o exemplo no fim, com selo). */}
      {writing[0] && continueCard(writing[0], 'Continuar escrevendo')}
      {writing.length === 0 && form}
      {/* Com um universo só, o cartão de cima basta; a lista aparece se há mais, o exemplo, versões guardadas ou uma escolha à espera. */}
      {(writing.length > 1 || (writing.length > 0 && (sampleEntry || versionsOf.get(writing[0].id)?.length || pending[writing[0].id]))) && (
        <section aria-labelledby="universos-titulo">
          <h2 id="universos-titulo" className="hub-h">
            Todos os universos
          </h2>
          <ul className="library-list" aria-label="Universos">
            {writing.map((e) => universeItem(e))}
            {sampleEntry && universeItem(sampleEntry)}
          </ul>
        </section>
      )}
      {sharedList}
      {writing.length > 0 &&
        (creating ? (
          form
        ) : (
          <button type="button" className="btn library-new" onClick={() => setCreating(true)}>
            <Plus size={18} /> Novo universo
          </button>
        ))}
      <TreinoCard compact onAccount={() => setAccountOpen(true)} />
      {writing.length === 0 && sampleCard}
      {socialCard}
      {writing.length > 0 && !sampleEntry && sampleCard}
      {start}
    </>
  )

  const rpg = (
    <>
      <MesaClimate dark={dark} />
      <section className="hub-hero hub-hero-mesa">
        <p className="hub-kicker">
          <Swords size={14} aria-hidden="true" /> Mesa
        </p>
        <h1>{campaigns.length ? 'Suas campanhas' : 'Mestre uma campanha'}</h1>
        <p className="lede">Os dados são os de verdade. O Papirus guarda as fichas, a iniciativa e as sessões, e mostra aos jogadores um Codex no celular deles.</p>
      </section>
      {tidyCard}
      {campaigns[0] && continueCard(campaigns[0], 'Continuar a campanha')}
      {(campaigns.length > 1 || (campaigns.length > 0 && (versionsOf.get(campaigns[0].id)?.length || pending[campaigns[0].id]))) && (
        <section aria-labelledby="campanhas-titulo">
          <h2 id="campanhas-titulo" className="hub-h">
            Todas as campanhas
          </h2>
          <ul className="library-list" aria-label="Campanhas">
            {campaigns.map((e) => universeItem(e))}
          </ul>
        </section>
      )}
      {creating || campaigns.length === 0 ? (
        campaignForm
      ) : (
        <button type="button" className="btn library-new" onClick={() => setCreating(true)}>
          <Plus size={18} /> Nova campanha
        </button>
      )}
      {tablesInBooks.length > 0 && (
        <section aria-labelledby="mesas-livros">
          <h2 id="mesas-livros" className="hub-h">
            Livros com Mesa
          </h2>
          <p className="small muted hub-note">Livros em que você também mestra. Se um deles é mesmo uma campanha, mude o tipo em Ajustes → Universo, e ele passa a morar aqui.</p>
          <ul className="library-list" aria-label="Livros com Mesa">
            {tablesInBooks.map((e) => universeItem(e, 'rpg'))}
          </ul>
        </section>
      )}
      {booksToPlay.length > 0 && (
        <section aria-labelledby="jogar-livro">
          <h2 id="jogar-livro" className="hub-h">
            Jogar num mundo que você já tem
          </h2>
          <p className="small muted hub-note">Uma Mesa dentro do livro, com as fichas, as ligações e os mapas dele. O livro continua como está.</p>
          <ul className="library-list" aria-label="Livros para jogar">
            {booksToPlay.map((e) => universeItem(e, 'rpg'))}
          </ul>
        </section>
      )}
      <section className="hub-player" aria-labelledby="jogador-titulo">
        <h2 id="jogador-titulo" className="hub-h">
          <Crown size={17} aria-hidden="true" /> Vai jogar com outro mestre?
        </h2>
        <p className="small muted">Peça ao mestre o link do Codex. Ele abre no navegador, sem conta, com a sua ficha, o mapa e o que o grupo já descobriu.</p>
      </section>
    </>
  )

  const oficina = (
    <>
      <OficinaClimate />
      <OficinaCover onChoose={(id) => setOficinaOpen(id)} />
    </>
  )

  const SECTORS = [
    ['escrita', 'Escrita', Feather],
    ['rpg', 'Mesa', Dices],
    ['oficina', 'Oficina', GraduationCap],
    ['comunidade', 'Comunidade', Users],
  ] as const

  // A Comunidade: novidades, o que está lendo, pessoas, seus livros e desafios (o mesmo da janela "Sua conta").
  const comunidade = (
    <SocialDialog inline publicUrl={p.publicUrl} library={library} onSynced={onChanged} onClose={() => setPref('sector', 'escrita')} onAccount={() => setAccountOpen(true)} onOpenUniverse={(id) => onOpen(id)} />
  )

  return (
    <div className={`library hub hub-${sector}${first ? ' library-first' : ''}`}>
      <header className="library-top">
        {/\/app\/?$/.test(location.pathname) ? (
          <a href="../" className="library-brand" title="O que é o Papirus?">
            <Brand />
          </a>
        ) : (
          <Brand />
        )}
        <div className="library-top-actions">
          <PageHelp key={sector} tour={`hub-${sector}`} />
          <button type="button" className="btn-icon" aria-label={dark ? 'Usar tema claro' : 'Usar tema escuro'} onClick={() => setPref('theme', dark ? 'claro' : 'escuro')}>
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <AccountButton onClick={() => setAccountOpen(true)} />
        </div>
      </header>
      <nav className="hub-tabs" aria-label="Setores">
          {SECTORS.map(([id, label, Icon]) => (
            <button key={id} type="button" className="hub-tab" aria-current={sector === id ? 'page' : undefined} onClick={() => setSector(id)}>
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
              {id === 'comunidade' && news > 0 && (
                <span className="hub-badge" aria-label={`${news} novidades`}>
                  {news}
                </span>
              )}
            </button>
          ))}
        </nav>

      <main className={`library-main${sector === 'oficina' ? ' hub-main-wide' : ''}`}>
        {/* Cada setor entra com a sua animação ao ser escolhido. */}
        <div key={sector} className="hub-sector">
          {sector === 'rpg' ? rpg : sector === 'oficina' ? oficina : sector === 'comunidade' ? comunidade : escrita}
        </div>
        {first && sector === 'escrita' && (
          <p className="landing-note small">
            <ShieldCheck size={15} aria-hidden="true" /> Sem cadastro: tudo fica neste navegador. Com uma conta (opcional), seus universos aparecem em todos os seus aparelhos.{' '}
            <a href="../">O que é o Papirus?</a>
          </p>
        )}
      </main>

      {accountOpen && <AccountDialog library={library} prefs={p} setPref={setPref} onClose={() => setAccountOpen(false)} onSynced={onChanged} />}
      {importChoice}
      {tidying && (
        <TidyDialog
          library={library}
          candidates={repeats}
          inCloud={(id) => Boolean(synced[id])}
          leaveCloud={leaveCloud}
          onDifferent={(ids) => {
            const next = new Set(different)
            for (const a of ids) for (const b of ids) if (a < b) next.add(`${a}|${b}`)
            setDifferent(next)
            remember('repetidos-diferentes', JSON.stringify([...next]))
          }}
          onDownload={downloadBackup}
          onChanged={afterVersions}
          onClose={() => setTidying(false)}
        />
      )}
      {socialTab && account.user && (
        <SocialDialog
          initialTab={socialTab}
          library={library}
          onSynced={onChanged}
          publicUrl={p.publicUrl}
          onClose={() => setSocialTab(null)}
          shareProgress={{ on: p.shareProgress, set: (on) => setPref('shareProgress', on) }}
        />
      )}
      {oficinaOpen && <OficinaPage start={oficinaOpen} onClose={() => setOficinaOpen(null)} />}
    </div>
  )
}

/** A Oficina também: luz âmbar de bancada. */
function OficinaClimate() {
  useOficinaSector()
  return null
}

/** O setor de RPG muda o clima da tela, como a mesa. */
function MesaClimate({ dark }: { dark: boolean }) {
  useMesaSector('tempestade', dark)
  return null
}
