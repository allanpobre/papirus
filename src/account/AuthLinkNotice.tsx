import { Check, Eye, EyeOff, KeyRound, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Field } from '../ui/bits'
import { Modal } from '../ui/Modal'
import { dismissLinkNotice, skipRecovery, updatePassword, useAccount } from './auth'

/**
 * O que acontece ao abrir um link do e-mail: escolher a senha nova ("Esqueci a senha"),
 * o aviso de que entrou, ou o motivo de o link não ter funcionado.
 */
export function AuthLinkNotice() {
  const { user, server, recovering, linkProblem, welcome } = useAccount()
  // O "você entrou" some sozinho.
  useEffect(() => {
    if (!welcome) return
    const t = window.setTimeout(dismissLinkNotice, 9000)
    return () => clearTimeout(t)
  }, [welcome])
  if (recovering && user && server) return <NewPassword email={user.email ?? ''} />
  if (linkProblem)
    return (
      <Modal title="O link não funcionou" size="sm" onClose={dismissLinkNotice}>
        <div className="account">
          <p className="small">{linkProblem}</p>
          <p className="small muted">Para pedir outro: Entrar › “Esqueci a senha” ou “Entrar sem senha”. Se o e-mail não chegar, olhe o spam.</p>
          <div className="account-actions">
            <button type="button" className="btn btn-primary" onClick={dismissLinkNotice}>
              Entendi
            </button>
          </div>
        </div>
      </Modal>
    )
  if (welcome)
    return (
      <div className="global-error auth-welcome" role="status">
        <span className="small">
          <Check size={14} aria-hidden="true" /> {welcome}
        </span>
        <button type="button" className="btn-icon btn-sm" aria-label="Fechar o aviso" onClick={dismissLinkNotice}>
          <X size={14} />
        </button>
      </div>
    )
  return null
}

function NewPassword({ email }: { email: string }) {
  const { server } = useAccount()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mismatch = confirm.length > 0 && confirm !== password

  const save = async () => {
    if (!server) return
    if (password !== confirm) return setError('As duas senhas não são iguais.')
    setBusy(true)
    setError(null)
    try {
      await updatePassword(server, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Escolha a senha nova" size="sm" onClose={skipRecovery}>
      <form
        className="account account-form"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <p className="small">
          Você abriu o link de “Esqueci a senha”{email ? ` de ${email}` : ''}. Escolha a senha nova; a antiga deixa de valer.
        </p>
        <Field label="Senha nova" hint="Pelo menos 6 caracteres.">
          {(id) => (
            <span className="account-password">
              <input id={id} className="input" type={show ? 'text' : 'password'} autoComplete="new-password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="btn-icon account-eye" aria-label={show ? 'Esconder o que digitei' : 'Ver o que digitei'} aria-pressed={show} onClick={() => setShow((v) => !v)}>
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </span>
          )}
        </Field>
        <Field label="Repita a senha nova" hint={mismatch ? 'As duas senhas não são iguais.' : undefined}>
          {(id) => <input id={id} className="input" type={show ? 'text' : 'password'} autoComplete="new-password" required aria-invalid={mismatch} value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
        </Field>
        {error && (
          <p className="notice notice-error small" role="alert">
            {error}
          </p>
        )}
        <div className="account-actions">
          <button type="button" className="btn btn-ghost" onClick={skipRecovery}>
            Agora não
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || mismatch}>
            <KeyRound size={16} /> {busy ? 'Aguarde…' : 'Salvar a senha nova'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
