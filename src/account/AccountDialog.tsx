import { Cloud, CloudOff, LogIn, LogOut, Mail, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import type { Library } from '../persistence/repository'
import type { Prefs } from '../state/prefs'
import { Field } from '../ui/bits'
import { Modal } from '../ui/Modal'
import { ServerFields } from '../views/ServerCard'
import { sendMagicLink, sendPasswordReset, signIn, signOut, signUp, useAccount } from './auth'
import { syncLibrary, useCloudStatus } from './useCloud'

type Mode = 'entrar' | 'criar' | 'link'

const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })

/** Entrar, criar conta, ou ver a conta e a sincronização. */
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
  const cloud = useCloudStatus()
  const [mode, setMode] = useState<Mode>('entrar')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [showServer, setShowServer] = useState(!server)

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

  const submit = () =>
    act(async () => {
      if (!server) return
      if (mode === 'entrar') {
        await signIn(server, email.trim(), password)
      } else if (mode === 'criar') {
        const confirm = await signUp(server, email.trim(), password)
        if (confirm) setNotice(`Conta criada. Enviamos um e-mail para ${email.trim()}: abra o link para confirmar e depois entre.`)
      } else {
        await sendMagicLink(server, email.trim())
        setNotice(`Enviamos um link para ${email.trim()}. Abra-o neste aparelho para entrar.`)
      }
    })

  if (user && server) {
    return (
      <Modal title="Sua conta" size="sm" onClose={onClose}>
        <div className="account">
          <p className="account-email">
            <Cloud size={18} aria-hidden="true" /> {user.email}
          </p>
          <p className="small">Seus universos são salvos neste navegador e na sua conta. Ao entrar em outro aparelho, eles aparecem lá.</p>
          <p className="small muted" role="status">
            {cloud.state === 'sincronizando'
              ? 'Sincronizando…'
              : cloud.state === 'erro'
                ? `Não sincronizou: ${cloud.error}`
                : cloud.at
                  ? `Sincronizado às ${timeFmt.format(new Date(cloud.at))}${cloud.report?.conflicts ? `. ${cloud.report.conflicts} universo(s) mudaram nos dois lugares: a versão da nuvem ficou como cópia.` : '.'}`
                  : 'Ainda não sincronizou nesta visita.'}
          </p>
          <div className="inline-fields">
            {library && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={cloud.state === 'sincronizando'}
                onClick={() => void syncLibrary(library, server, user.id).then(() => onSynced?.())}
              >
                <RefreshCw size={14} /> Sincronizar agora
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() =>
                void act(async () => {
                  await signOut(server)
                  onClose()
                })
              }
            >
              <LogOut size={14} /> Sair
            </button>
          </div>
          <p className="muted tiny">Ao sair, os universos continuam neste navegador. Nada é apagado.</p>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Entrar no Papirus" size="sm" onClose={onClose}>
      <div className="account">
        <p className="small">A conta é opcional. Com ela, seus universos ficam guardados na nuvem e aparecem em qualquer aparelho. Sem ela, tudo continua funcionando neste navegador.</p>

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
            <div className="segmented" role="tablist" aria-label="Como entrar">
              {(
                [
                  ['entrar', 'Entrar'],
                  ['criar', 'Criar conta'],
                  ['link', 'Link por e-mail'],
                ] as const
              ).map(([m, label]) => (
                <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}>
                  {label}
                </button>
              ))}
            </div>
            <form
              className="account-form"
              onSubmit={(e) => {
                e.preventDefault()
                void submit()
              }}
            >
              <Field label="E-mail">
                {(id) => <input id={id} className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
              </Field>
              {mode !== 'link' && (
                <Field label="Senha" hint={mode === 'criar' ? 'Pelo menos 6 caracteres.' : undefined}>
                  {(id) => (
                    <input
                      id={id}
                      className="input"
                      type="password"
                      autoComplete={mode === 'criar' ? 'new-password' : 'current-password'}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  )}
                </Field>
              )}
              <button type="submit" className="btn btn-primary" disabled={busy || loading}>
                {mode === 'link' ? <Mail size={16} /> : null}
                {busy ? 'Aguarde…' : mode === 'entrar' ? 'Entrar' : mode === 'criar' ? 'Criar conta' : 'Mandar o link'}
              </button>
            </form>
            {mode === 'entrar' && (
              <button
                type="button"
                className="link-btn small"
                disabled={!email.trim()}
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

/** Botão da conta: "Entrar" ou o e-mail. */
export function AccountButton({ onClick, compact = false }: { onClick: () => void; compact?: boolean }) {
  const { user } = useAccount()
  const cloud = useCloudStatus()
  const label = user ? (user.email ?? 'Conta') : 'Entrar'
  return (
    <button type="button" data-tour="conta" className={`account-btn${user ? ' signed' : ''}`} title={user ? `Conta: ${user.email}` : 'Entrar ou criar conta'} aria-label={user ? `Conta: ${user.email}` : 'Entrar'} onClick={onClick}>
      {!user ? <LogIn size={16} aria-hidden="true" /> : cloud.state === 'erro' ? <CloudOff size={16} aria-hidden="true" /> : <Cloud size={16} aria-hidden="true" />}
      {!compact && <span className="account-btn-label">{label}</span>}
    </button>
  )
}

