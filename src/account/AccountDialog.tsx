import { ArrowLeft, CloudOff, Eye, EyeOff, LogIn, Mail, MailCheck, UserPlus } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import type { Library } from '../persistence/repository'
import type { Prefs } from '../state/prefs'
import { BrandMark } from '../shell/Brand'
import { cleanHandle, getMyProfileCache, getNoticeCount, isHandle, loadMyProfile, loadNotices, noticesSeenAt, saveProfile, setNoticeCount, subscribeMyProfile, pushChallengeWords, subscribeNoticeCount, suggestHandle, unseenCount } from '../social/social'
import { todayTotal } from '../social/dailyWords'
import { todayKey } from '../logic/stats'
import { Avatar, SocialDialog } from '../social/SocialDialog'
import { Field } from '../ui/bits'
import { Modal } from '../ui/Modal'
import { ServerFields } from '../views/ServerCard'
import { authClient, sendMagicLink, sendPasswordReset, signIn, signUp, useAccount } from './auth'
import { useCloudStatus } from './useCloud'

type Mode = 'entrar' | 'criar' | 'link'

/** Entrar ou criar conta; com conta, abre o perfil, os amigos e a sincronização. */
export function AccountDialog({
  library,
  prefs,
  setPref,
  onClose,
  onSynced,
}: {
  library: Library | null
  prefs: Prefs
  setPref: <K extends keyof Prefs>(k: K, v: Prefs[K]) => void
  onClose: () => void
  onSynced?: () => void
}) {
  const { user, server, loading } = useAccount()
  const [mode, setMode] = useState<Mode>('entrar')
  const [step, setStep] = useState<1 | 2>(1)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [handle, setHandle] = useState('')
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [checkEmail, setCheckEmail] = useState<string | null>(null)
  const [showServer, setShowServer] = useState(!server)

  if (user && server) return <SocialDialog library={library} onSynced={onSynced} publicUrl={prefs.publicUrl} onClose={onClose} />

  const act = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await fn()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const switchMode = (m: Mode) => {
    setMode(m)
    setStep(1)
    setError(null)
    setNotice(null)
  }

  const mismatch = mode === 'criar' && confirm.length > 0 && confirm !== password
  const cleanedHandle = cleanHandle(handle)

  const submit = () =>
    act(async () => {
      if (!server) return
      if (mode === 'entrar') {
        await signIn(server, email.trim(), password)
      } else if (mode === 'link') {
        await sendMagicLink(server, email.trim())
        setNotice(`Enviamos um link para ${email.trim()}. Abra-o neste aparelho para entrar.`)
      } else if (step === 1) {
        if (password.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.')
        if (password !== confirm) throw new Error('As duas senhas não são iguais.')
        if (!handle) setHandle(suggestHandle(email.trim()))
        setStep(2)
      } else {
        if (!isHandle(cleanedHandle)) throw new Error('O @ precisa ter de 3 a 24 caracteres: letras minúsculas, números, "." ou "_".')
        const profile = { handle: cleanedHandle, name: name.trim(), bio: bio.trim() }
        const needsConfirm = await signUp(server, email.trim(), password, profile)
        if (needsConfirm) {
          setCheckEmail(email.trim())
          return
        }
        // Entrou direto: o perfil já nasce agora (sem o script social, fica para depois).
        const { data } = await (await authClient(server)).auth.getUser()
        if (data.user) await saveProfile(await authClient(server), data.user.id, { ...profile, avatar: null }).catch(() => undefined)
      }
    })

  if (checkEmail) {
    return (
      <Modal title="Entrar no Papirus" size="sm" onClose={onClose}>
        <div className="account account-done">
          <MailCheck size={36} aria-hidden="true" className="account-done-icon" />
          <h3>Confira seu e-mail</h3>
          <p className="small">
            Mandamos um link para <strong>{checkEmail}</strong>. Abra-o neste aparelho para confirmar a conta. Seu perfil (@{cleanedHandle}) fica pronto quando você entrar.
          </p>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setCheckEmail(null)
              switchMode('entrar')
            }}
          >
            Já confirmei: entrar
          </button>
        </div>
      </Modal>
    )
  }

  const passwordToggle = (
    <button type="button" className="btn-icon account-eye" aria-label={show ? 'Esconder o que digitei' : 'Ver o que digitei'} aria-pressed={show} onClick={() => setShow((v) => !v)}>
      {show ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  )

  return (
    <Modal title="Entrar no Papirus" size="sm" onClose={onClose}>
      <div className="account">
        <div className="account-hero">
          <BrandMark size={34} />
          <p className="small">A conta é opcional. Com ela, seus universos vão para todos os seus aparelhos, e você ganha um perfil para amigos verem sua estante.</p>
        </div>

        {!server || showServer ? (
          <>
            {!server && (
              <p className="notice small">
                <CloudOff size={14} aria-hidden="true" /> Falta configurar o servidor das contas.
              </p>
            )}
            <ServerFields prefs={prefs} setPref={setPref} />
            {server && (
              <button type="button" className="link-btn small" onClick={() => setShowServer(false)}>
                Pronto
              </button>
            )}
          </>
        ) : (
          <>
            {mode !== 'link' && (
              <div className="segmented account-tabs" role="tablist" aria-label="Como entrar">
                {(
                  [
                    ['entrar', 'Entrar'],
                    ['criar', 'Criar conta'],
                  ] as const
                ).map(([m, label]) => (
                  <button key={m} type="button" role="tab" aria-selected={mode === m} aria-checked={mode === m} onClick={() => switchMode(m)}>
                    {label}
                  </button>
                ))}
              </div>
            )}

            {mode === 'criar' && (
              <ol className="account-steps" aria-label="Passos">
                <li aria-current={step === 1 ? 'step' : undefined}>Acesso</li>
                <li aria-current={step === 2 ? 'step' : undefined}>Seu perfil</li>
              </ol>
            )}

            <form
              className="account-form"
              onSubmit={(e) => {
                e.preventDefault()
                void submit()
              }}
            >
              {mode === 'link' && (
                <p className="small">
                  <strong>Entrar sem senha.</strong> Mandamos um link para o seu e-mail; é só abrir neste aparelho.
                </p>
              )}

              {(mode !== 'criar' || step === 1) && (
                <>
                  <Field label="E-mail">
                    {(id) => <input id={id} className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
                  </Field>
                  {mode !== 'link' && (
                    <Field label="Senha" hint={mode === 'criar' ? 'Pelo menos 6 caracteres.' : undefined}>
                      {(id) => (
                        <span className="account-password">
                          <input
                            id={id}
                            className="input"
                            type={show ? 'text' : 'password'}
                            autoComplete={mode === 'criar' ? 'new-password' : 'current-password'}
                            required
                            minLength={6}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                          />
                          {passwordToggle}
                        </span>
                      )}
                    </Field>
                  )}
                  {mode === 'criar' && (
                    <Field label="Repita a senha" hint={mismatch ? 'As duas senhas não são iguais.' : undefined}>
                      {(id) => (
                        <input
                          id={id}
                          className="input"
                          type={show ? 'text' : 'password'}
                          autoComplete="new-password"
                          required
                          aria-invalid={mismatch}
                          value={confirm}
                          onChange={(e) => setConfirm(e.target.value)}
                        />
                      )}
                    </Field>
                  )}
                </>
              )}

              {mode === 'criar' && step === 2 && (
                <>
                  <p className="small">Como as pessoas vão te ver no Papirus. Só o @ é obrigatório; foto e o resto dá para mudar depois.</p>
                  <Field label="@ (como te acham)" hint={isHandle(cleanedHandle) ? `Fica @${cleanedHandle}.` : 'De 3 a 24 caracteres: letras minúsculas, números, "." ou "_".'}>
                    {(id) => (
                      <span className="social-handle-input">
                        <span aria-hidden="true">@</span>
                        <input id={id} className="input" value={handle} maxLength={30} autoCapitalize="off" autoCorrect="off" spellCheck={false} aria-invalid={!isHandle(cleanedHandle)} onChange={(e) => setHandle(e.target.value)} />
                      </span>
                    )}
                  </Field>
                  <Field label="Nome">{(id) => <input id={id} className="input" value={name} maxLength={80} placeholder="Como quer aparecer" onChange={(e) => setName(e.target.value)} />}</Field>
                  <Field label="Sobre você">
                    {(id) => <textarea id={id} className="input" rows={3} value={bio} maxLength={600} placeholder="O que você escreve, o que joga, o que lê…" onChange={(e) => setBio(e.target.value)} />}
                  </Field>
                </>
              )}

              <div className="account-actions">
                {mode === 'criar' && step === 2 && (
                  <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>
                    <ArrowLeft size={16} /> Voltar
                  </button>
                )}
                <button type="submit" className="btn btn-primary account-submit" disabled={busy || loading || mismatch}>
                  {mode === 'link' ? <Mail size={16} /> : mode === 'entrar' ? <LogIn size={16} /> : step === 2 ? <UserPlus size={16} /> : null}
                  {busy ? 'Aguarde…' : mode === 'entrar' ? 'Entrar' : mode === 'link' ? 'Mandar o link' : step === 1 ? 'Continuar' : 'Criar conta'}
                </button>
              </div>
            </form>

            <div className="account-links">
              {mode === 'entrar' && (
                <button
                  type="button"
                  className="link-btn small"
                  disabled={!email.trim()}
                  title={email.trim() ? undefined : 'Escreva o e-mail primeiro'}
                  onClick={() =>
                    void act(async () => {
                      await sendPasswordReset(server, email.trim())
                      setNotice(`Se existir uma conta com ${email.trim()}, chegou um e-mail para trocar a senha.`)
                    })
                  }
                >
                  Esqueci a senha
                </button>
              )}
              {mode === 'link' ? (
                <button type="button" className="link-btn small" onClick={() => switchMode('entrar')}>
                  Entrar com senha
                </button>
              ) : (
                mode === 'entrar' && (
                  <button type="button" className="link-btn small" onClick={() => switchMode('link')}>
                    Entrar sem senha (link por e-mail)
                  </button>
                )
              )}
            </div>
            {error && (
              <p className="notice notice-error small" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="notice small" role="status">
                {notice}
              </p>
            )}
            <button type="button" className="link-btn tiny account-server-link" onClick={() => setShowServer(true)}>
              Servidor: {new URL(server.url).host}
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}

/** Botão da conta: "Entrar", ou a foto (ou inicial) do perfil. Abre perfil, amigos e a nuvem. */
export function AccountButton({ onClick, compact = false }: { onClick: () => void; compact?: boolean }) {
  const { user, server } = useAccount()
  const cloud = useCloudStatus()
  const cache = useSyncExternalStore(subscribeMyProfile, getMyProfileCache)
  const profile = user && cache?.userId === user.id ? cache.profile : null
  const userId = user?.id
  const notices = useSyncExternalStore(subscribeNoticeCount, getNoticeCount)
  const hasProfile = !!profile
  useEffect(() => {
    if (!userId || !server) return
    void authClient(server).then((sb) => loadMyProfile(sb, userId))
  }, [userId, server])
  // Avisos novos (pedidos, comentários, "quero ler", livros de amigos): confere ao abrir e a cada 3 minutos.
  useEffect(() => {
    if (!userId || !server || !hasProfile) return
    let off = false
    const check = async () => {
      if (document.hidden) return
      try {
        const sb = await authClient(server)
        const list = await loadNotices(sb, userId)
        if (!off) setNoticeCount(unseenCount(list, noticesSeenAt(userId)))
        // Palavras de hoje para os desafios de escrita em andamento.
        await pushChallengeWords(sb, userId, todayKey(), todayTotal()).catch(() => 0)
      } catch {
        // Sem a parte social no servidor: sem avisos.
      }
    }
    void check()
    const t = setInterval(() => void check(), 180_000)
    const onVisible = () => !document.hidden && void check()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      off = true
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [userId, server, hasProfile])

  if (!user) {
    return (
      <button type="button" data-tour="conta" className="account-btn" title="Entrar ou criar conta" aria-label="Entrar" onClick={onClick}>
        <LogIn size={16} aria-hidden="true" />
        {!compact && <span className="account-btn-label">Entrar</span>}
      </button>
    )
  }
  // Só o @ ou o começo do e-mail: o endereço inteiro estoura o topo no celular.
  const label = profile ? `@${profile.handle}` : user.email?.split('@')[0] || 'Conta'
  return (
    <button
      type="button"
      data-tour="conta"
      className="account-btn signed"
      title={`Conta: ${user.email}`}
      aria-label={`Conta: ${user.email}${notices ? ` (${notices} ${notices === 1 ? 'aviso novo' : 'avisos novos'})` : ''}`}
      onClick={onClick}
    >
      <span className="account-btn-avatar">
        <Avatar p={profile ?? { avatar: null, name: '', handle: user.email ?? '?' }} size={24} />
        {cloud.state === 'erro' && <CloudOff size={12} aria-label="Não sincronizou" className="account-btn-warn" />}
        {notices > 0 && cloud.state !== 'erro' && <span className="account-btn-dot" aria-hidden="true" />}
      </span>
      {!compact && <span className="account-btn-label">{label}</span>}
    </button>
  )
}
