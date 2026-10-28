import { InstallButton } from '../ui/InstallButton'
import { OficinaCover, OficinaPage } from '../oficina/OficinaPage'
import type { GuideId } from '../oficina/guides'
import { SocialDialog, type SocialTab } from '../social/SocialDialog'
import { getNoticeCount } from '../social/social'
import { useMesaSector } from '../rpg/useMesaSector'
import { useOficinaSector } from '../oficina/useOficinaSector'
import {
  BookOpen,
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
import { MESA_THEMES } from '../rpg/themes'
import { TreinoCard } from '../treino/TreinoCard'
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
  const [creating, setCreating] = useState(false)
  const sampleEntry = entries.find((e) => e.sample)
  const own = entries.filter((e) => e !== sampleEntry)
  const writing = own.filter((e) => e.kind !== 'campanha')
  const campaigns = own.filter((e) => e.kind === 'campanha')
  // Universos de escrita que também têm uma mesa (o exemplo, por exemplo).
  const tablesInBooks = entries.filter((e) => e.kind !== 'campanha' && e.sessions !== undefined)
  const openSample = () => (sampleEntry ? onOpen(sampleEntry.id) : void sampleUniverse().then(onCreated))
  const sector = p.sector
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

  const universeItem = (e: LibraryEntry, view?: View) => (
    <li key={e.id} className={`library-item${themeStyle(e) ? ' is-themed' : ''}`} style={themeStyle(e)}>
      <button type="button" className="library-open" onClick={() => onOpen(e.id, view)}>
        {e.cover ? <Picture value={e.cover} className="library-cover" /> : e.kind === 'campanha' ? <Dices size={20} aria-hidden="true" /> : <BookOpen size={20} aria-hidden="true" />}
        <span className="library-name">{e.name || 'Sem nome'}</span>
        <span className="library-meta">
          {e.kind === 'campanha' || view === 'rpg'
            ? `${e.sessions ?? 0} ${e.sessions === 1 ? 'sessão' : 'sessões'} · ${e.sheets ?? 0} ${e.sheets === 1 ? 'personagem' : 'personagens'}`
            : `${e.words.toLocaleString('pt-BR')} palavras`}
          {' · '}
          {dateFmt.format(new Date(e.updatedAt))}
          {account.user && !e.sample && (synced[e.id] ? ' · na conta' : ' · só neste aparelho')}
          {account.user && mine.has(e.id) && (
            <>
              {' '}
              <span className="share-tag">compartilhado</span>
            </>
          )}
        </span>
      </button>
      {/* Apagar fica no setor do próprio universo (um livro com mesa não some pelo RPG). */}
      {!e.sample && !view && (
        <ConfirmButton
          className="btn-icon"
          title={`Apagar ${e.name}`}
          question={account.user ? 'Apagar de vez, aqui e na sua conta?' : 'Apagar de vez, com os snapshots?'}
          confirmLabel={e.kind === 'campanha' ? 'Apagar campanha' : 'Apagar universo'}
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
      )}
    </li>
  )

  /** O cartão grande do começo: voltar para onde parou. */
  const continueCard = (e: LibraryEntry, label: string, view?: View) => (
    <button type="button" className={`hub-continue${themeStyle(e) ? ' is-themed' : ''}`} style={themeStyle(e)} onClick={() => onOpen(e.id, view)}>
      {e.cover ? <Picture value={e.cover} className="hub-continue-cover" /> : <span className="hub-continue-cover hub-continue-blank" aria-hidden="true">{(e.name || '?').slice(0, 1)}</span>}
      <span className="hub-continue-text">
        <span className="hub-kicker">{label}</span>
        <strong className="hub-continue-name">{e.name || 'Sem nome'}</strong>
        <span className="muted small">
          {e.kind === 'campanha' ? `${e.sessions ?? 0} ${e.sessions === 1 ? 'sessão' : 'sessões'}` : `${e.words.toLocaleString('pt-BR')} palavras`} · {dateFmt.format(new Date(e.updatedAt))}
          {account.user && (synced[e.id] ? ' · na conta' : ' · só neste aparelho')}
        </span>
      </span>
      <ArrowRight size={20} className="hub-continue-go" aria-hidden="true" />
    </button>
  )

  const notices = getNoticeCount()
  const socialCard = (
    <section className="hub-social" aria-labelledby="amigos-titulo">
      <h2 id="amigos-titulo" className="hub-h">
        <Users size={17} aria-hidden="true" /> Amigos e estante
      </h2>
      {account.user ? (
        <>
          <p className="small muted">O que seus amigos andam escrevendo, a estante deles e os desafios.</p>
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
            {cloud.state === 'sincronizando' ? 'Sincronizando com a sua conta…' : cloud.state === 'erro' ? `Não sincronizou: ${cloud.error}` : `Na sua conta (${account.user.email}).`}
          </p>
        )}
      </section>
      {writing[0] && continueCard(writing[0], 'Continuar escrevendo')}
      <TreinoCard compact onAccount={() => setAccountOpen(true)} />
      {writing.length > 1 && (
        <section aria-labelledby="universos-titulo">
          <h2 id="universos-titulo" className="hub-h">
            Todos os universos
          </h2>
          <ul className="library-list" aria-label="Universos">
            {writing.map((e) => universeItem(e))}
          </ul>
        </section>
      )}
      {sharedList}
      {creating || writing.length === 0 ? (
        form
      ) : (
        <button type="button" className="btn library-new" onClick={() => setCreating(true)}>
          <Plus size={18} /> Novo universo
        </button>
      )}
      {socialCard}
      {sampleCard}
      {start}
    </>
  )

  const rpg = (
    <>
      <MesaClimate dark={dark} />
      <section className="hub-hero hub-hero-mesa">
        <p className="hub-kicker">
          <Swords size={14} aria-hidden="true" /> Mesa de RPG
        </p>
        <h1>{campaigns.length ? 'Suas campanhas' : 'Mestre uma campanha'}</h1>
        <p className="lede">Os dados são os de verdade. O Papirus guarda as fichas, a iniciativa e as sessões, e mostra aos jogadores um Codex no celular deles.</p>
      </section>
      {campaigns[0] && continueCard(campaigns[0], 'Continuar a campanha')}
      {campaigns.length > 1 && (
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
            Mesas dentro dos seus universos
          </h2>
          <p className="small muted hub-note">Universos de escrita que também têm uma mesa. Se um deles é mesmo uma campanha, mude o tipo em Ajustes → Menu e ajuda, e ele passa a morar aqui.</p>
          <ul className="library-list" aria-label="Mesas dentro dos seus universos">
            {tablesInBooks.map((e) => universeItem(e, 'rpg'))}
          </ul>
        </section>
      )}
      <section className="hub-player" aria-labelledby="jogador-titulo">
        <h2 id="jogador-titulo" className="hub-h">
          <Crown size={17} aria-hidden="true" /> Vai jogar na mesa de alguém?
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
    ['rpg', 'RPG', Dices],
    ['oficina', 'Oficina', GraduationCap],
  ] as const

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
            </button>
          ))}
        </nav>

      <main className={`library-main${sector === 'oficina' ? ' hub-main-wide' : ''}`}>
        {/* Cada setor entra com a sua animação ao ser escolhido. */}
        <div key={sector} className="hub-sector">
          {sector === 'rpg' ? rpg : sector === 'oficina' ? oficina : escrita}
        </div>
        {first && sector === 'escrita' && (
          <p className="landing-note small">
            <ShieldCheck size={15} aria-hidden="true" /> Sem cadastro: tudo fica neste navegador. Com uma conta (opcional), seus universos aparecem em todos os seus aparelhos.{' '}
            <a href="../">O que é o Papirus?</a>
          </p>
        )}
      </main>

      {accountOpen && <AccountDialog library={library} prefs={p} setPref={setPref} onClose={() => setAccountOpen(false)} onSynced={onChanged} />}
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
