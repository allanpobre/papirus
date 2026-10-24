import { Copy, Eye, Link2, LogIn, Pencil, Trash2, Users } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { authClient, useAccount } from '../account/auth'
import { upload } from '../account/cloud'
import { useWorkspace } from '../state/workspace'
import { Modal } from '../ui/Modal'
import { DEFAULT_PUBLIC_URL } from './server'
import {
  invite,
  isEmail,
  listMembers,
  newLinkToken,
  normalizeEmail,
  readLink,
  refreshReaderCopy,
  removeMember,
  ROLE_LABEL,
  setRole,
  startSharing,
  stopSharing,
  updateShare,
  getShare,
  shareChanged,
  type LinkMode,
  type Member,
  type Role,
  type Share,
} from './sharing'

/** Compartilhar o universo aberto: convites por e-mail (ver ou editar) e o link de leitura. */
export function ShareDialog({ onClose, onAccount }: { onClose: () => void; onAccount: () => void }) {
  const { universe, flush, prefs } = useWorkspace()
  const { user, server } = useAccount()
  const [share, setShare] = useState<Share | null | undefined>(undefined)
  const [members, setMembers] = useState<Member[]>([])
  const [email, setEmail] = useState('')
  const [role, setRoleChoice] = useState<Role>('ver')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirmStop, setConfirmStop] = useState(false)
  const [linkMode, setLinkMode] = useState<LinkMode>('livro')

  const act = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
      shareChanged()
    }
  }, [])

  const userId = user?.id
  useEffect(() => {
    if (!userId || !server) return
    let off = false
    void (async () => {
      try {
        const sb = await authClient(server)
        const s = await getShare(sb, userId, universe.id)
        const list = s ? await listMembers(sb, userId, universe.id) : []
        if (off) return
        setShare(s)
        setMembers(list)
      } catch (err) {
        if (!off) setError(err instanceof Error ? err.message : String(err))
      }
    })()
    return () => {
      off = true
    }
  }, [userId, server, universe.id])

  if (!user || !server) {
    return (
      <Modal title="Compartilhar" size="sm" onClose={onClose}>
        <div className="share">
          <p className="small">
            Para compartilhar “{universe.name}”, entre na sua conta. O universo vai para a nuvem e você escolhe quem pode ver e quem pode editar.
          </p>
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
        </div>
      </Modal>
    )
  }

  const sb = () => authClient(server)
  const publicUrl = prefs.publicUrl || DEFAULT_PUBLIC_URL
  const appUrl = new URL('app/', new URL(publicUrl.replace(/\/app\/?$/, '/').replace(/\/?$/, '/'))).toString()
  const link = share?.link_token ? readLink(publicUrl, server, share.link_token, linkMode) : null

  const begin = () =>
    act(async () => {
      await flush()
      const client = await sb()
      await upload(client, user.id, universe)
      setShare(await startSharing(client, user.id, user.email ?? '', universe))
    })

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    if (!share) return
    const who = normalizeEmail(email)
    setNotice(null)
    if (!isEmail(who)) {
      setError('Este e-mail não parece válido.')
      return
    }
    if (who === normalizeEmail(user.email ?? '')) {
      setError('Esse é o seu e-mail: o universo já é seu.')
      return
    }
    void act(async () => {
      const client = await sb()
      await invite(client, share, who, role)
      setMembers(await listMembers(client, user.id, universe.id))
      setEmail('')
      setNotice(`Pronto. Avise ${who}: é só entrar no Papirus com esse e-mail, e “${universe.name}” aparece em “Compartilhados com você”.`)
    })
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Não deu para copiar. Selecione o link e copie à mão.')
    }
  }

  return (
    <Modal title="Compartilhar" size="md" onClose={onClose}>
      <div className="share">
        {share === undefined ? (
          <p className="muted small" aria-busy="true">
            Carregando…
          </p>
        ) : share === null ? (
          <>
            <p className="small">Mostre “{universe.name}” para outras pessoas, com você decidindo o que cada uma pode fazer:</p>
            <ul className="share-intro small">
              <li>
                <Eye size={14} aria-hidden="true" /> <strong>Pode ver</strong>: lê tudo, não muda nada.
              </li>
              <li>
                <Pencil size={14} aria-hidden="true" /> <strong>Pode editar</strong>: escreve junto com você; as mudanças se juntam em segundos.
              </li>
              <li>
                <Link2 size={14} aria-hidden="true" /> <strong>Link de leitura</strong>: quem tiver o link lê sem conta. Desliga quando quiser.
              </li>
            </ul>
            <p className="muted tiny">Quem pode o quê é o servidor que garante, não só a tela. Você troca ou tira o acesso a qualquer hora.</p>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void begin()}>
              <Users size={15} /> Começar a compartilhar
            </button>
          </>
        ) : (
          <>
            <section className="share-section" aria-labelledby="share-pessoas">
              <h3 id="share-pessoas" className="share-title">
                Pessoas
              </h3>
              <form className="share-invite" onSubmit={add}>
                <input
                  className="input"
                  type="email"
                  aria-label="E-mail de quem convidar"
                  placeholder="email@exemplo.com"
                  autoComplete="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <select className="input" aria-label="O que pode fazer" value={role} onChange={(e) => setRoleChoice(e.target.value as Role)}>
                  <option value="ver">{ROLE_LABEL.ver}</option>
                  <option value="editar">{ROLE_LABEL.editar}</option>
                </select>
                <button type="submit" className="btn btn-primary" disabled={busy || !email.trim()}>
                  Convidar
                </button>
              </form>
              {notice && (
                <p className="notice small" role="status">
                  {notice}{' '}
                  <button type="button" className="link-btn" onClick={() => void copy(appUrl)}>
                    Copiar o endereço do Papirus
                  </button>
                </p>
              )}
              {members.length ? (
                <ul className="share-members">
                  {members.map((m) => (
                    <li key={m.email}>
                      <span className="share-avatar" aria-hidden="true">
                        {m.email.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="share-email">{m.email}</span>
                      <select
                        className="input input-sm"
                        aria-label={`O que ${m.email} pode fazer`}
                        value={m.role}
                        disabled={busy}
                        onChange={(e) =>
                          void act(async () => {
                            const next = e.target.value as Role
                            await setRole(await sb(), share, m.email, next)
                            setMembers((all) => all.map((x) => (x.email === m.email ? { ...x, role: next } : x)))
                          })
                        }
                      >
                        <option value="ver">{ROLE_LABEL.ver}</option>
                        <option value="editar">{ROLE_LABEL.editar}</option>
                      </select>
                      <button
                        type="button"
                        className="btn-icon btn-sm"
                        aria-label={`Tirar o acesso de ${m.email}`}
                        title="Tirar o acesso"
                        disabled={busy}
                        onClick={() =>
                          void act(async () => {
                            await removeMember(await sb(), user.id, universe.id, m.email)
                            setMembers((all) => all.filter((x) => x.email !== m.email))
                          })
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted small">Ninguém convidado ainda.</p>
              )}
            </section>

            <section className="share-section" aria-labelledby="share-link">
              <h3 id="share-link" className="share-title">
                Link de leitura
              </h3>
              {link ? (
                <>
                  <p className="small">Quem tiver este link lê “{universe.name}” sem conta, mas não muda nada.</p>
                  <div className="segmented" role="radiogroup" aria-label="O link abre como">
                    <button type="button" role="radio" aria-checked={linkMode === 'livro'} onClick={() => setLinkMode('livro')}>
                      Livro, sem spoiler
                    </button>
                    <button type="button" role="radio" aria-checked={linkMode === 'universo'} onClick={() => setLinkMode('universo')}>
                      Universo inteiro
                    </button>
                  </div>
                  <p className="muted tiny">
                    {linkMode === 'livro'
                      ? 'Abre o modo leitor: cena por cena, com um caderno que só mostra o que já foi lido.'
                      : 'Abre todas as fichas, relações e a linha do tempo de uma vez (cuidado com spoilers).'}
                  </p>
                  <div className="share-link-row">
                    <input className="input input-sm" readOnly aria-label="Link de leitura" value={link} onFocus={(e) => e.target.select()} />
                    <button type="button" className="btn btn-sm" onClick={() => void copy(link)}>
                      <Copy size={14} /> {copied ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                  <div className="inline-fields">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={busy}
                      onClick={() => void act(async () => setShare(await updateShare(await sb(), share, { link_token: newLinkToken() })))}
                    >
                      Trocar o link
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={busy}
                      onClick={() => void act(async () => setShare(await updateShare(await sb(), share, { link_token: null })))}
                    >
                      Desligar o link
                    </button>
                  </div>
                  <p className="muted tiny">Trocar o link faz o antigo parar de funcionar.</p>
                </>
              ) : (
                <>
                  <p className="small muted">Desligado. Ligue para mandar a quem não tem conta (leitores beta, a mesa de RPG…).</p>
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={busy}
                    onClick={() => void act(async () => setShare(await updateShare(await sb(), share, { link_token: newLinkToken() })))}
                  >
                    <Link2 size={14} /> Criar link de leitura
                  </button>
                </>
              )}
            </section>

            <section className="share-section" aria-labelledby="share-segredos">
              <h3 id="share-segredos" className="share-title">
                Segredos
              </h3>
              <label className="check">
                <input
                  type="checkbox"
                  checked={share.show_secrets}
                  disabled={busy}
                  onChange={(e) =>
                    void act(async () => {
                      const client = await sb()
                      const next = await updateShare(client, share, { show_secrets: e.target.checked })
                      await flush()
                      await refreshReaderCopy(client, next, universe)
                      setShare(next)
                    })
                  }
                />{' '}
                Quem só pode ver (e o link) também vê o que é secreto
              </label>
              <p className="muted tiny">
                Desmarcado, fichas, fatos e relações secretas e os trechos [segredo] não saem do seu Papirus para quem só lê. Quem pode editar vê tudo.
              </p>
            </section>

            <div className="share-stop">
              {confirmStop ? (
                <>
                  <span className="small">Tirar o acesso de todo mundo e desligar o link?</span>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    disabled={busy}
                    onClick={() =>
                      void act(async () => {
                        await stopSharing(await sb(), user.id, universe.id)
                        setShare(null)
                        setMembers([])
                        setConfirmStop(false)
                      })
                    }
                  >
                    Parar de compartilhar
                  </button>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirmStop(false)}>
                    Cancelar
                  </button>
                </>
              ) : (
                <button type="button" className="link-btn small" onClick={() => setConfirmStop(true)}>
                  Parar de compartilhar
                </button>
              )}
            </div>
          </>
        )}
        {error && (
          <p className="notice notice-error small" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
