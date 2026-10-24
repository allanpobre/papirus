import type { SupabaseClient } from '@supabase/supabase-js'
import { ArrowLeft, BookOpen, Camera, Check, Cloud, Copy, Globe, LogIn, LogOut, RefreshCw, Search, Trash2, UserMinus, UserPlus, Users, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { authClient, signOut, useAccount } from '../account/auth'
import { syncLibrary, useCloudStatus } from '../account/useCloud'
import type { Library } from '../persistence/repository'
import { anonClient } from '../share/server'
import { ConfirmButton } from '../ui/ConfirmButton'
import { Modal } from '../ui/Modal'
import {
  acceptFriend,
  cleanHandle,
  draftFromMetadata,
  isHandle,
  myFriends,
  myProfile,
  profileLink,
  profileByHandle,
  removeFriend,
  requestFriend,
  saveProfile,
  setMyProfileCache,
  shelfOf,
  shrinkAvatar,
  suggestHandle,
  type FriendEntry,
  type Profile,
  type ProfileDraft,
  type ShelfRow,
} from './social'

type Tab = 'perfil' | 'amigos' | 'conta'

interface Props {
  onClose: () => void
  /** Abre a janela de entrar (quando não há conta). */
  onAccount?: () => void
  /** Abre direto o perfil de alguém (link `?perfil=`). */
  initialHandle?: string
  /** Endereço público do app (para o link do perfil). */
  publicUrl?: string
  initialTab?: Tab
  /** Biblioteca deste navegador (para "Sincronizar agora"). */
  library?: Library | null
  onSynced?: () => void
}

/**
 * A conta num lugar só: perfil, amigos (e a estante de cada um) e a sincronização.
 * Tudo opcional: cada livro só vai para a estante se o autor escolher.
 */
export function SocialDialog({ onClose, onAccount, initialHandle, publicUrl = '', initialTab = 'perfil', library = null, onSynced }: Props) {
  const { user, server } = useAccount()
  const [tab, setTab] = useState<Tab>(initialTab)
  const [me, setMe] = useState<Profile | null>(null)
  const [draft, setDraft] = useState<ProfileDraft | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [friends, setFriends] = useState<FriendEntry[]>([])
  const [viewing, setViewing] = useState<Profile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [nonce, setNonce] = useState(0)
  const userId = user?.id

  const client = useCallback((): Promise<SupabaseClient> => {
    if (!server) throw new Error('Sem servidor configurado.')
    return user ? authClient(server) : anonClient(server)
  }, [server, user])

  useEffect(() => {
    if (!server) return
    let off = false
    void (async () => {
      try {
        const sb = await client()
        let [p, list, start] = await Promise.all([
          userId ? myProfile(sb, userId) : null,
          userId ? myFriends(sb, userId) : [],
          initialHandle && nonce === 0 ? profileByHandle(sb, initialHandle) : null,
        ])
        // Perfil preenchido ao criar a conta (antes de confirmar o e-mail): vira perfil agora.
        if (userId && !p) {
          const { data } = await sb.auth.getUser()
          const d = draftFromMetadata(data.user?.user_metadata)
          if (d) {
            try {
              p = await saveProfile(sb, userId, { ...d, avatar: null })
            } catch {
              if (!off) setDraft(d)
            }
          }
        }
        if (off) return
        setMe(p)
        if (userId) setMyProfileCache(userId, p)
        setFriends(list)
        if (start) setViewing(start)
        else if (initialHandle && nonce === 0) setError(`Não achei @${cleanHandle(initialHandle)}, ou a estante não está aberta para você.`)
      } catch (err) {
        if (!off) setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!off) setLoaded(true)
      }
    })()
    return () => {
      off = true
    }
  }, [server, userId, client, initialHandle, nonce])

  const act = async (fn: (sb: SupabaseClient) => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn(await client())
      setNonce((n) => n + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const relation = (p: Profile): FriendEntry | undefined => friends.find((f) => f.other.user_id === p.user_id)

  if (!server) {
    return (
      <Modal title="Perfil e amigos" size="sm" onClose={onClose}>
        <p className="small">Perfis e amigos precisam de um servidor. Configure em Ajustes → Servidor.</p>
      </Modal>
    )
  }

  if (viewing) {
    return (
      <Modal title={viewing.name || `@${viewing.handle}`} size="lg" onClose={onClose}>
        <div className="social">
          {(user || !initialHandle) && (
            <button type="button" className="btn btn-ghost btn-sm social-back" onClick={() => setViewing(null)}>
              <ArrowLeft size={15} /> Voltar
            </button>
          )}
          {error && <p className="notice notice-error small" role="alert">{error}</p>}
          <PersonView
            person={viewing}
            isMe={viewing.user_id === userId}
            relation={relation(viewing)}
            signedIn={!!user}
            busy={busy}
            client={client}
            onAdd={() => void act((sb) => requestFriend(sb, userId!, viewing.user_id))}
            onAccept={() => void act((sb) => acceptFriend(sb, userId!, viewing.user_id))}
            onRemove={() => void act((sb) => removeFriend(sb, userId!, viewing.user_id))}
            onAccount={onAccount}
          />
        </div>
      </Modal>
    )
  }

  if (!user) {
    return (
      <Modal title="Perfil e amigos" size="sm" onClose={onClose}>
        <div className="social">
          {error && <p className="notice notice-error small" role="alert">{error}</p>}
          <p className="small">Com uma conta, você tem um perfil com @, adiciona amigos e vê a estante deles. Os seus livros só aparecem lá se você escolher, um por um.</p>
          {onAccount && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                onClose()
                onAccount()
              }}
            >
              <LogIn size={15} /> Entrar ou criar conta
            </button>
          )}
        </div>
      </Modal>
    )
  }

  const incoming = friends.filter((f) => f.status === 'pendente' && !f.outgoing)
  const tabs: [Tab, string][] = [
    ['perfil', 'Perfil'],
    ['amigos', 'Amigos'],
    ['conta', 'Conta'],
  ]

  return (
    <Modal title="Sua conta" size="lg" onClose={onClose}>
      <div className="social">
        <header className="social-me">
          <Avatar p={me ?? { avatar: null, name: draft?.name ?? '', handle: user.email ?? '?' }} size={48} />
          <div className="social-me-text">
            <strong>{me ? me.name || `@${me.handle}` : 'Sem perfil ainda'}</strong>
            <span className="muted tiny">
              {me?.name && `@${me.handle} · `}
              {user.email}
            </span>
          </div>
        </header>
        <div className="segmented social-tabs" role="tablist" aria-label="Seções da conta">
          {tabs.map(([t, label]) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} aria-checked={tab === t} onClick={() => setTab(t)}>
              {label}
              {t === 'amigos' && incoming.length > 0 && (
                <span className="social-badge" aria-label={`${incoming.length} pedidos`}>
                  {incoming.length}
                </span>
              )}
            </button>
          ))}
        </div>
        {error && <p className="notice notice-error small" role="alert">{error}</p>}

        {tab === 'conta' ? (
          <AccountPanel library={library} onSynced={onSynced} onClose={onClose} />
        ) : !loaded ? (
          <p className="muted small">Carregando…</p>
        ) : !me ? (
          <>
            <p className="small">
              {tab === 'amigos' ? 'Para adicionar amigos, crie seu perfil primeiro. ' : ''}Só o @ é obrigatório: é como as pessoas te acham. Nome, foto e o resto, se quiser.
            </p>
            <ProfileForm
              initial={{ handle: draft?.handle ?? suggestHandle(user.email ?? ''), name: draft?.name ?? '', bio: draft?.bio ?? '', avatar: null }}
              busy={busy}
              submitLabel="Criar perfil"
              onSave={(p) => void act(async (sb) => void (await saveProfile(sb, user.id, p)))}
            />
          </>
        ) : tab === 'perfil' ? (
          <>
            <ProfileForm key={me.handle + me.name + me.bio + (me.avatar?.length ?? 0)} initial={me} busy={busy} submitLabel="Salvar perfil" onSave={(p) => void act(async (sb) => void (await saveProfile(sb, user.id, p)))} />
            <div className="social-row">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setViewing(me)}>
                <BookOpen size={15} /> Ver como os outros veem
              </button>
              <CopyLink url={profileLink(publicUrl, me.handle)} />
            </div>
            <p className="muted tiny">
              Seus livros entram na estante pela página Livro de cada universo: “Só eu”, “Amigos” ou “Todo mundo”. O link do perfil sem conta só mostra o que for “Todo mundo”.
            </p>
          </>
        ) : (
          <FriendsTab
            friends={friends}
            busy={busy}
            onFind={async (handle) => {
              setError(null)
              try {
                const p = await profileByHandle(await client(), handle)
                if (p) setViewing(p)
                else setError(`Ninguém com @${cleanHandle(handle)} (ainda).`)
              } catch (err) {
                setError(err instanceof Error ? err.message : String(err))
              }
            }}
            onOpen={setViewing}
            onAccept={(f) => void act((sb) => acceptFriend(sb, user.id, f.other.user_id))}
            onRemove={(f) => void act((sb) => removeFriend(sb, user.id, f.other.user_id))}
          />
        )}
      </div>
    </Modal>
  )
}

const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })

/** Nuvem e sair. */
function AccountPanel({ library, onSynced, onClose }: { library: Library | null; onSynced?: () => void; onClose: () => void }) {
  const { user, server } = useAccount()
  const cloud = useCloudStatus()
  const [error, setError] = useState<string | null>(null)
  if (!user || !server) return null
  return (
    <div className="account">
      <p className="small">Seus universos são salvos neste navegador e na sua conta. Ao entrar em outro aparelho, eles aparecem lá.</p>
      <p className="small muted" role="status">
        <Cloud size={14} aria-hidden="true" />{' '}
        {cloud.state === 'sincronizando'
          ? 'Sincronizando…'
          : cloud.state === 'erro'
            ? `Não sincronizou: ${cloud.error}`
            : cloud.at
              ? `Sincronizado às ${timeFmt.format(new Date(cloud.at))}${cloud.report?.conflicts ? `. ${cloud.report.conflicts} universo(s) mudaram nos dois lugares: a versão da nuvem ficou como cópia.` : '.'}`
              : 'Ainda não sincronizou nesta visita.'}
      </p>
      {library && (
        <button type="button" className="btn btn-ghost btn-sm account-signout" disabled={cloud.state === 'sincronizando'} onClick={() => void syncLibrary(library, server, user.id).then(() => onSynced?.())}>
          <RefreshCw size={14} /> Sincronizar agora
        </button>
      )}
      <button
        type="button"
        className="btn account-signout"
        onClick={async () => {
          try {
            await signOut(server)
            onClose()
            goToLanding()
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
          }
        }}
      >
        <LogOut size={16} /> Sair da conta
      </button>
      {error && <p className="notice notice-error small" role="alert">{error}</p>}
      <p className="muted tiny">Ao sair, você volta para a apresentação do Papirus. Os universos continuam neste navegador; nada é apagado.</p>
    </div>
  )
}

/** Volta para a página de apresentação (quando o app está em …/app/). */
function goToLanding() {
  if (/\/app\/?$/.test(location.pathname)) location.assign(new URL('../', location.href).toString())
}

export function Avatar({ p, size = 40 }: { p: Pick<Profile, 'avatar' | 'name' | 'handle'>; size?: number }) {
  const initial = (p.name || p.handle || '?').trim().charAt(0).toUpperCase()
  return p.avatar ? (
    <img className="social-avatar" src={p.avatar} alt="" width={size} height={size} style={{ width: size, height: size }} />
  ) : (
    <span className="social-avatar social-avatar-empty" style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden="true">
      {initial}
    </span>
  )
}

function ProfileForm({
  initial,
  busy,
  submitLabel,
  onSave,
}: {
  initial: Pick<Profile, 'handle' | 'name' | 'bio' | 'avatar'>
  busy: boolean
  submitLabel: string
  onSave: (p: Pick<Profile, 'handle' | 'name' | 'bio' | 'avatar'>) => void
}) {
  const [handle, setHandle] = useState(initial.handle)
  const [name, setName] = useState(initial.name)
  const [bio, setBio] = useState(initial.bio)
  const [avatar, setAvatar] = useState(initial.avatar)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const clean = cleanHandle(handle)
  const valid = isHandle(clean)

  return (
    <form
      className="social-form"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onSave({ handle: clean, name, bio, avatar })
      }}
    >
      <div className="social-photo">
        <Avatar p={{ avatar, name, handle: clean }} size={72} />
        <label className="btn btn-ghost btn-sm">
          <Camera size={15} /> {avatar ? 'Trocar foto' : 'Pôr foto'}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              try {
                setPhotoError(null)
                setAvatar(await shrinkAvatar(file))
              } catch (err) {
                setPhotoError(err instanceof Error ? err.message : String(err))
              }
            }}
          />
        </label>
        {avatar && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAvatar(null)}>
            <Trash2 size={15} /> Tirar foto
          </button>
        )}
        {photoError && <span className="social-invalid small">{photoError}</span>}
      </div>
      <label className="social-field">
        <span className="field-label">@ (como te acham)</span>
        <span className="social-handle-input">
          <span aria-hidden="true">@</span>
          <input className="input" value={handle} maxLength={30} autoCapitalize="off" autoCorrect="off" spellCheck={false} aria-invalid={!valid} onChange={(e) => setHandle(e.target.value)} />
        </span>
        <span className={`tiny ${valid ? 'muted' : 'social-invalid'}`}>{valid ? `Fica @${clean}.` : 'De 3 a 24 caracteres: letras minúsculas, números, "." ou "_".'}</span>
      </label>
      <label className="social-field">
        <span className="field-label">Nome</span>
        <input className="input" value={name} maxLength={80} placeholder="Como quer aparecer" onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="social-field">
        <span className="field-label">Sobre você</span>
        <textarea className="input" rows={3} value={bio} maxLength={600} placeholder="O que você escreve, o que joga, o que lê…" onChange={(e) => setBio(e.target.value)} />
      </label>
      <button type="submit" className="btn btn-primary" disabled={busy || !valid}>
        <Check size={15} /> {submitLabel}
      </button>
    </form>
  )
}

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      title={url}
      onClick={() => {
        void navigator.clipboard?.writeText(url).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        })
      }}
    >
      {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copiado' : 'Copiar link do perfil'}
    </button>
  )
}

function FriendsTab({
  friends,
  busy,
  onFind,
  onOpen,
  onAccept,
  onRemove,
}: {
  friends: FriendEntry[]
  busy: boolean
  onFind: (handle: string) => Promise<void>
  onOpen: (p: Profile) => void
  onAccept: (f: FriendEntry) => void
  onRemove: (f: FriendEntry) => void
}) {
  const [q, setQ] = useState('')
  const incoming = friends.filter((f) => f.status === 'pendente' && !f.outgoing)
  const outgoing = friends.filter((f) => f.status === 'pendente' && f.outgoing)
  const accepted = friends.filter((f) => f.status === 'aceita')

  const row = (f: FriendEntry, actions: React.ReactNode) => (
    <li key={f.other.user_id} className="social-person">
      <button type="button" className="social-person-open" onClick={() => onOpen(f.other)}>
        <Avatar p={f.other} />
        <span className="social-person-name">
          <strong>{f.other.name || `@${f.other.handle}`}</strong>
          <span className="muted tiny">@{f.other.handle}</span>
        </span>
      </button>
      <span className="social-person-actions">{actions}</span>
    </li>
  )

  return (
    <div className="social-friends">
      <form
        className="social-find"
        onSubmit={(e) => {
          e.preventDefault()
          if (q.trim()) void onFind(q)
        }}
      >
        <label htmlFor="achar-amigo" className="sr-only">
          @ da pessoa
        </label>
        <input id="achar-amigo" className="input" placeholder="@ de quem você quer adicionar" value={q} autoCapitalize="off" autoCorrect="off" spellCheck={false} onChange={(e) => setQ(e.target.value)} />
        <button type="submit" className="btn btn-sm" disabled={!q.trim()}>
          <Search size={15} /> Procurar
        </button>
      </form>

      {incoming.length > 0 && (
        <section aria-labelledby="pedidos">
          <h3 id="pedidos" className="social-h">
            Pedidos para você
          </h3>
          <ul className="social-list">
            {incoming.map((f) =>
              row(
                f,
                <>
                  <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => onAccept(f)}>
                    <Check size={15} /> Aceitar
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => onRemove(f)} aria-label={`Recusar @${f.other.handle}`}>
                    <X size={15} /> Recusar
                  </button>
                </>,
              ),
            )}
          </ul>
        </section>
      )}

      <section aria-labelledby="amigos">
        <h3 id="amigos" className="social-h">
          <Users size={15} aria-hidden="true" /> Amigos
        </h3>
        {accepted.length ? (
          <ul className="social-list">
            {accepted.map((f) =>
              row(
                f,
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => onOpen(f.other)}>
                  <BookOpen size={15} /> Estante
                </button>,
              ),
            )}
          </ul>
        ) : (
          <p className="muted small">Ninguém ainda. Procure pelo @ de alguém, ou mande o link do seu perfil.</p>
        )}
      </section>

      {outgoing.length > 0 && (
        <section aria-labelledby="enviados">
          <h3 id="enviados" className="social-h">
            Esperando resposta
          </h3>
          <ul className="social-list">
            {outgoing.map((f) =>
              row(
                f,
                <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => onRemove(f)}>
                  <X size={15} /> Cancelar
                </button>,
              ),
            )}
          </ul>
        </section>
      )}
    </div>
  )
}

function PersonView({
  person,
  isMe,
  relation,
  signedIn,
  busy,
  client,
  onAdd,
  onAccept,
  onRemove,
  onAccount,
}: {
  person: Profile
  isMe: boolean
  relation: FriendEntry | undefined
  signedIn: boolean
  busy: boolean
  client: () => Promise<SupabaseClient>
  onAdd: () => void
  onAccept: () => void
  onRemove: () => void
  onAccount?: () => void
}) {
  const [books, setBooks] = useState<ShelfRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const status = relation?.status
  useEffect(() => {
    let off = false
    void (async () => {
      try {
        const rows = await shelfOf(await client(), person.user_id)
        if (!off) setBooks(rows)
      } catch (err) {
        if (!off) setError(err instanceof Error ? err.message : String(err))
      }
    })()
    return () => {
      off = true
    }
    // A estante muda de acordo com a amizade (aceitar abre os livros "amigos").
  }, [person.user_id, client, status])

  return (
    <div className="social-person-view">
      <header className="social-profile-head">
        <Avatar p={person} size={72} />
        <div>
          <h3 className="social-profile-name">{person.name || `@${person.handle}`}</h3>
          <p className="muted small">@{person.handle}</p>
          {person.bio && <p className="small social-bio">{person.bio}</p>}
        </div>
        <div className="social-profile-actions">
          {isMe ? (
            <span className="share-tag">Você</span>
          ) : !signedIn ? (
            onAccount && (
              <button type="button" className="btn btn-sm" onClick={onAccount}>
                <LogIn size={15} /> Entrar para adicionar
              </button>
            )
          ) : !relation ? (
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={onAdd}>
              <UserPlus size={15} /> Adicionar amigo
            </button>
          ) : relation.status === 'pendente' && relation.outgoing ? (
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={onRemove}>
              <X size={15} /> Cancelar pedido
            </button>
          ) : relation.status === 'pendente' ? (
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={onAccept}>
              <Check size={15} /> Aceitar pedido
            </button>
          ) : (
            <>
              <span className="share-tag share-tag-edit">
                <Users size={13} aria-hidden="true" /> Amigos
              </span>
              <ConfirmButton className="btn btn-ghost btn-sm" title={`Desfazer amizade com @${person.handle}`} question="Desfazer a amizade? Os livros só para amigos deixam de aparecer para os dois." confirmLabel="Desfazer" onConfirm={onRemove}>
                <UserMinus size={15} aria-label={`Desfazer amizade com @${person.handle}`} />
              </ConfirmButton>
            </>
          )}
        </div>
      </header>

      <h3 className="social-h">Estante</h3>
      {error ? (
        <p className="notice notice-error small" role="alert">
          {error}
        </p>
      ) : !books ? (
        <p className="muted small">Carregando…</p>
      ) : books.length === 0 ? (
        <p className="muted small">
          {isMe
            ? 'Nenhum livro à mostra. Na página Livros de um universo, escolha “Amigos” ou “Todo mundo”.'
            : relation?.status === 'aceita'
              ? 'Nenhum livro à mostra por enquanto.'
              : 'Nada aberto para você. Livros só para amigos aparecem depois que o pedido é aceito.'}
        </p>
      ) : (
        <ul className="social-shelf" aria-label={`Estante de @${person.handle}`}>
          {books.map((b) => (
            <li key={b.id} className="social-book">
              {b.cover ? (
                <img className="social-book-cover" src={b.cover} alt={`Capa de ${b.title}`} />
              ) : (
                <span className="social-book-cover book-hero-placeholder" aria-hidden="true">
                  <span className="book-hero-placeholder-title">{b.title}</span>
                </span>
              )}
              <div className="social-book-info">
                <strong className="social-book-title">{b.title}</strong>
                {b.author && <span className="small">{b.author}</span>}
                <span className="muted tiny">
                  {b.chapters} {b.chapters === 1 ? 'capítulo' : 'capítulos'} · {b.words.toLocaleString('pt-BR')} palavras
                  {b.universe_name && ` · ${b.universe_name}`}
                  {b.visibility === 'publico' ? (
                    <>
                      {' '}
                      · <Globe size={11} aria-label="público" />
                    </>
                  ) : (
                    <>
                      {' '}
                      · <Users size={11} aria-label="só amigos" />
                    </>
                  )}
                </span>
                {b.blurb && <p className="small social-book-blurb">{b.blurb}</p>}
                {b.read_link && /^https?:\/\//i.test(b.read_link) && (
                  <a className="btn btn-sm social-book-read" href={b.read_link}>
                    <BookOpen size={15} /> Ler
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
