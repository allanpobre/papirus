import type { SupabaseClient } from '@supabase/supabase-js'
import { ArrowRight, Check, Copy, UserPlus, Users, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { authClient, useAccount } from '../account/auth'
import { anonClient } from '../share/server'
import { Brand } from '../shell/Brand'
import { OwnerShelf } from './ShelfBook'
import { Avatar } from './SocialDialog'
import { acceptFriend, cleanHandle, myFriends, profileByHandle, profileLink, removeFriend, requestFriend, type FriendEntry, type Profile } from './social'

/**
 * Página pública de um perfil (link `?perfil=fulano`): quem é a pessoa e a estante dela.
 * Sem conta, mostra só o que é de todo mundo; com conta, também o que é para amigos.
 */
export function ProfilePage({ handle, publicUrl, onAccount, onLeave, accountButton }: { handle: string; publicUrl: string; onAccount: () => void; onLeave: () => void; accountButton: React.ReactNode }) {
  const { user, server } = useAccount()
  const [person, setPerson] = useState<Profile | null | undefined>(undefined)
  const [relation, setRelation] = useState<FriendEntry | undefined>()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
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
        const p = await profileByHandle(sb, handle)
        const rel = p && userId ? (await myFriends(sb, userId)).find((f) => f.other.user_id === p.user_id) : undefined
        if (off) return
        setPerson(p)
        setRelation(rel)
      } catch (err) {
        if (!off) setError(err instanceof Error ? err.message : String(err))
      }
    })()
    return () => {
      off = true
    }
  }, [server, client, handle, userId, nonce])

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

  const isMe = !!person && person.user_id === userId

  return (
    <div className="profile-page">
      <header className="library-top">
        <button type="button" className="profile-page-home" onClick={onLeave} title="Abrir o Papirus">
          <Brand />
        </button>
        <div className="library-top-actions">{accountButton}</div>
      </header>

      <main className="profile-page-main">
        {error && (
          <p className="notice notice-error small" role="alert">
            {error}
          </p>
        )}
        {!server ? (
          <p className="small">Este link precisa de um servidor configurado.</p>
        ) : person === undefined ? (
          <p className="muted small">Carregando…</p>
        ) : person === null ? (
          <section className="profile-page-missing">
            <h1>@{cleanHandle(handle)}</h1>
            <p className="small">Não achamos esse perfil, ou a estante dele não está aberta para você.{!user && ' Se vocês forem amigos, entre na sua conta.'}</p>
            <div className="social-row">
              {!user && (
                <button type="button" className="btn btn-primary" onClick={onAccount}>
                  Entrar
                </button>
              )}
              <button type="button" className="btn btn-ghost" onClick={onLeave}>
                Abrir o Papirus <ArrowRight size={16} />
              </button>
            </div>
          </section>
        ) : (
          <>
            <section className="profile-hero" aria-label="Perfil">
              <Avatar p={person} size={112} />
              <div className="profile-hero-text">
                <h1>{person.name || `@${person.handle}`}</h1>
                <p className="muted">@{person.handle}</p>
                {person.bio && <p className="profile-bio">{person.bio}</p>}
                <div className="social-row">
                  {isMe ? (
                    <span className="share-tag">Você</span>
                  ) : !user ? (
                    <button type="button" className="btn btn-primary btn-sm" onClick={onAccount}>
                      <UserPlus size={15} /> Entrar para adicionar
                    </button>
                  ) : !relation ? (
                    <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void act((sb) => requestFriend(sb, userId!, person.user_id))}>
                      <UserPlus size={15} /> Adicionar amigo
                    </button>
                  ) : relation.status === 'pendente' && relation.outgoing ? (
                    <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void act((sb) => removeFriend(sb, userId!, person.user_id))}>
                      <X size={15} /> Cancelar pedido
                    </button>
                  ) : relation.status === 'pendente' ? (
                    <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void act((sb) => acceptFriend(sb, userId!, person.user_id))}>
                      <Check size={15} /> Aceitar pedido
                    </button>
                  ) : (
                    <span className="share-tag share-tag-edit">
                      <Users size={13} aria-hidden="true" /> Amigos
                    </span>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() =>
                      void navigator.clipboard?.writeText(profileLink(publicUrl, person.handle)).then(() => {
                        setCopied(true)
                        setTimeout(() => setCopied(false), 2000)
                      })
                    }
                  >
                    {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copiado' : 'Copiar link'}
                  </button>
                </div>
              </div>
            </section>

            <section aria-labelledby="estante-titulo" className="profile-shelf">
              <h2 id="estante-titulo">Estante</h2>
              <OwnerShelf
                ownerId={person.user_id}
                handle={person.handle}
                me={userId ?? null}
                client={client}
                refreshKey={relation?.status}
                onAccount={onAccount}
                empty={isMe ? 'Nenhum livro à mostra. Na página Livro de um universo, escolha “Amigos” ou “Todo mundo”.' : 'Nenhum livro aberto para você por enquanto.'}
              />
            </section>

            <footer className="profile-page-foot">
              <p className="muted small">Papirus: escreva histórias, monte o seu mundo e mestre RPG, tudo no navegador.</p>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  // Sem conta: a apresentação explica o que é o Papirus.
                  if (!user && /\/app\/?$/.test(location.pathname)) location.assign(new URL('../', location.href).toString())
                  else onLeave()
                }}
              >
                {user ? 'Voltar aos meus universos' : 'Conhecer o Papirus'} <ArrowRight size={15} />
              </button>
            </footer>
          </>
        )}
      </main>
    </div>
  )
}
