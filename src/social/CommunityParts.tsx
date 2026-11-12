import type { SupabaseClient } from '@supabase/supabase-js'
import { BookOpen, Ban, Sparkles, UserMinus, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ConfirmButton } from '../ui/ConfirmButton'
import {
  auRequests,
  block,
  continueReading,
  followCounts,
  follow,
  isMissing,
  myBlocks,
  myFollows,
  openWorldsOf,
  readingStats,
  removeFollower,
  requestAU,
  unblock,
  unfollow,
  type AURequest,
  type ContinueReading,
  type FollowLists,
  type OpenWorld,
} from './community'
import { shelfOf, type Profile, type ShelfRow } from './social'
import { Avatar } from './SocialDialog'

type Client = () => Promise<SupabaseClient>

/** Uma ação no servidor com "ocupado", erro e recarregar. */
function useAct(onDone: () => void) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const act = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, act }
}

const name = (p: Profile) => p.name || `@${p.handle}`

/** No perfil de alguém: seguir, bloquear e os mundos abertos a AU (com o pedido). */
export function PersonExtras({ person, myId, client, onChanged }: { person: Profile; myId: string | null; client: Client; onChanged: () => void }) {
  const [counts, setCounts] = useState<{ followers: number; following: number } | null>(null)
  const [following, setFollowing] = useState(false)
  const [worlds, setWorlds] = useState<OpenWorld[]>([])
  const [mine, setMine] = useState<AURequest[]>([])
  const [missing, setMissing] = useState(false)
  const [nonce, setNonce] = useState(0)
  const [asking, setAsking] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const { busy, error, act } = useAct(() => {
    setNonce((n) => n + 1)
    onChanged()
  })
  const isMe = person.user_id === myId

  useEffect(() => {
    let off = false
    void (async () => {
      try {
        const sb = await client()
        const [c, f, w, r] = await Promise.all([
          followCounts(sb, person.user_id),
          myId && !isMe ? myFollows(sb, myId) : Promise.resolve<FollowLists>({ following: [], followers: [] }),
          myId ? openWorldsOf(sb, person.user_id) : Promise.resolve([]),
          myId && !isMe ? auRequests(sb, myId) : Promise.resolve({ mine: [], toMe: [] }),
        ])
        if (off) return
        setCounts(c)
        setFollowing(f.following.some((p) => p.user_id === person.user_id))
        setWorlds(w)
        setMine(r.mine.filter((x) => x.owner === person.user_id))
      } catch (err) {
        if (!off) setMissing(isMissing(err))
      }
    })()
    return () => {
      off = true
    }
  }, [client, person.user_id, myId, isMe, nonce])

  if (missing) return null
  return (
    <div className="person-extras">
      {counts && (
        <p className="small muted person-counts">
          <strong>{counts.followers}</strong> {counts.followers === 1 ? 'seguidor' : 'seguidores'} · <strong>{counts.following}</strong> seguindo
        </p>
      )}
      {myId && !isMe && (
        <div className="inline-fields">
          <button
            type="button"
            className={`btn btn-sm${following ? '' : ' btn-primary'}`}
            disabled={busy}
            onClick={() => void act(async () => (following ? unfollow(await client(), myId, person.user_id) : follow(await client(), myId, person.user_id)))}
          >
            {following ? <UserMinus size={15} /> : <UserPlus size={15} />} {following ? 'Deixar de seguir' : 'Seguir'}
          </button>
          <ConfirmButton
            className="btn btn-ghost btn-sm"
            title={`Bloquear ${name(person)}`}
            question={`Bloquear ${name(person)}? A pessoa não vai poder comentar nos seus livros, reagir, pedir amizade, seguir você nem pedir AU. A amizade e o seguir de vocês somem. Dá para desbloquear em Pessoas.`}
            confirmLabel="Bloquear"
            onConfirm={() => void act(async () => block(await client(), person.user_id))}
          >
            <Ban size={15} aria-hidden="true" /> Bloquear
          </ConfirmButton>
        </div>
      )}
      {error && (
        <p className="notice notice-error small" role="alert">
          {error}
        </p>
      )}
      {worlds.length > 0 && (
        <section className="person-worlds" aria-label="Mundos abertos a AU">
          <h4 className="section-label">
            <Sparkles size={14} aria-hidden="true" /> Mundos abertos a AU
          </h4>
          <p className="muted tiny">Universos em que {isMe ? 'você aceita' : 'a pessoa aceita'} pedidos para criar um universo alternativo (sem os segredos). Quem aceita é o autor.</p>
          <ul className="person-world-list">
            {worlds.map((w) => {
              const req = mine.find((r) => r.universe_id === w.universe_id)
              return (
                <li key={w.universe_id}>
                  <strong>{w.name || 'Sem nome'}</strong>
                  {w.blurb && <span className="small muted">{w.blurb}</span>}
                  {!isMe && myId && (
                    <>
                      {req ? (
                        <span className={`au-chip au-req-${req.status}`}>
                          {req.status === 'pendente' ? 'Pedido enviado' : req.status === 'aceito' ? 'Aceito: está em “Compartilhados com você”' : 'Recusado'}
                        </span>
                      ) : asking === w.universe_id ? (
                        <form
                          className="person-ask"
                          onSubmit={(e) => {
                            e.preventDefault()
                            void act(async () => {
                              await requestAU(await client(), w.owner, w.universe_id, message)
                              setAsking(null)
                              setMessage('')
                            })
                          }}
                        >
                          <textarea className="input" rows={2} aria-label="Recado para o autor" placeholder="Opcional: o que você quer escrever nesse mundo?" value={message} onChange={(e) => setMessage(e.target.value)} />
                          <div className="inline-fields">
                            <button type="submit" className="btn btn-sm btn-primary" disabled={busy}>
                              Enviar pedido
                            </button>
                            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setAsking(null)}>
                              Cancelar
                            </button>
                          </div>
                        </form>
                      ) : (
                        <button type="button" className="btn btn-sm" onClick={() => setAsking(w.universe_id)}>
                          <Sparkles size={14} /> Pedir para criar um AU
                        </button>
                      )}
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}

/** Lendo: onde parou em cada livro, com os capítulos novos. */
export function ReadingTab({ myId, client, onRead }: { myId: string; client: Client; onRead: (owner: Profile | null, bookId: string) => void }) {
  const [list, setList] = useState<ContinueReading[] | null>(null)
  const [missing, setMissing] = useState(false)
  useEffect(() => {
    let off = false
    void (async () => {
      try {
        const rows = await continueReading(await client(), myId)
        if (!off) setList(rows)
      } catch (err) {
        if (!off) {
          setMissing(isMissing(err))
          setList([])
        }
      }
    })()
    return () => {
      off = true
    }
  }, [client, myId])
  if (missing) return <p className="muted small">Para guardar onde você parou em cada livro, quem cuida do servidor precisa rodar o script supabase/comunidade.sql.</p>
  if (!list) return <p className="muted small">Carregando…</p>
  if (!list.length)
    return <p className="muted small">Nada ainda. Quando você ler um livro da estante de alguém, ele aparece aqui com o capítulo em que parou e os capítulos novos que saírem. Funciona em qualquer aparelho em que você entrar.</p>
  return (
    <ul className="reading-list" aria-label="Continuar lendo">
      {list.map((r) => (
        <li key={`${r.book.owner}/${r.book.id}`} className="reading-item">
          <span className="reading-cover" aria-hidden="true">
            {r.book.cover ? <img src={r.book.cover} alt="" /> : <BookOpen size={20} />}
          </span>
          <span className="reading-text">
            <strong>{r.book.title || 'Sem título'}</strong>
            <span className="small muted">
              {r.owner ? name(r.owner) : r.book.author} · parou no capítulo {r.chapterIndex + 1} de {r.book.chapters}
            </span>
            {r.newChapters > 0 && <span className="au-chip au-chip-novo">{r.newChapters === 1 ? '1 capítulo novo' : `${r.newChapters} capítulos novos`}</span>}
          </span>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => onRead(r.owner, r.book.id)}>
            Continuar
          </button>
        </li>
      ))}
    </ul>
  )
}

/** Seus livros na estante: até onde as pessoas leram cada um (sem dizer quem). */
export function MyBooksTab({ myId, client }: { myId: string; client: Client }) {
  const [books, setBooks] = useState<ShelfRow[] | null>(null)
  const [stats, setStats] = useState<Map<string, number[]>>(new Map())
  const [missing, setMissing] = useState(false)
  useEffect(() => {
    let off = false
    void (async () => {
      const sb = await client()
      try {
        const shelf = await shelfOf(sb, myId)
        if (off) return
        setBooks(shelf)
        const entries = await Promise.all(shelf.map(async (b) => [b.id, await readingStats(sb, b.id, b.chapters)] as const))
        if (!off) setStats(new Map(entries))
      } catch (err) {
        if (!off) {
          setMissing(isMissing(err))
          setBooks((b) => b ?? [])
        }
      }
    })()
    return () => {
      off = true
    }
  }, [client, myId])
  if (!books) return <p className="muted small">Carregando…</p>
  if (!books.length) return <p className="muted small">Nenhum livro na estante. Em Publicar, “Pôr na estante” mostra o livro para amigos ou para todo mundo.</p>
  return (
    <div className="mybooks">
      {missing && <p className="muted small">Para ver até onde leram, quem cuida do servidor precisa rodar o script supabase/comunidade.sql.</p>}
      {books.map((b) => {
        const reached = stats.get(b.id) ?? []
        const top = Math.max(1, ...reached)
        const started = reached[0] ?? 0
        return (
          <section key={b.id} className="mybook" aria-label={`Leitura de ${b.title}`}>
            <h4>{b.title || 'Sem título'}</h4>
            <p className="small muted">
              {started ? `${started} ${started === 1 ? 'pessoa começou' : 'pessoas começaram'} a ler` : 'Ninguém começou a ler ainda'} · {b.chapters} capítulos
            </p>
            {started > 0 && (
              <ol className="reach-bars" aria-label="Até onde leram">
                {reached.map((n, i) => (
                  <li key={i} title={`Capítulo ${i + 1}: ${n} ${n === 1 ? 'pessoa' : 'pessoas'}`}>
                    <span className="reach-label tiny">{i + 1}</span>
                    <span className="reach-bar" style={{ width: `${(n / top) * 100}%` }} />
                    <span className="reach-n tiny">{n}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )
      })}
      <p className="muted tiny">Só números: o Papirus nunca mostra quem leu até onde.</p>
    </div>
  )
}

/** Pessoas: quem você segue, quem segue você e quem você bloqueou. */
export function PeopleLists({ myId, client, onOpen }: { myId: string; client: Client; onOpen: (p: Profile) => void }) {
  const [lists, setLists] = useState<FollowLists | null>(null)
  const [blocks, setBlocks] = useState<Profile[]>([])
  const [missing, setMissing] = useState(false)
  const [nonce, setNonce] = useState(0)
  const { busy, error, act } = useAct(() => setNonce((n) => n + 1))
  useEffect(() => {
    let off = false
    void (async () => {
      try {
        const sb = await client()
        const [f, b] = await Promise.all([myFollows(sb, myId), myBlocks(sb, myId)])
        if (off) return
        setLists(f)
        setBlocks(b)
      } catch (err) {
        if (!off) setMissing(isMissing(err))
      }
    })()
    return () => {
      off = true
    }
  }, [client, myId, nonce])
  if (missing || !lists) return null
  const row = (p: Profile, action?: React.ReactNode) => (
    <li key={p.user_id} className="social-person">
      <button type="button" className="social-person-open" onClick={() => onOpen(p)}>
        <Avatar p={p} size={32} />
        <span className="small">{name(p)}</span>
      </button>
      {action}
    </li>
  )
  return (
    <div className="people-lists">
      {error && (
        <p className="notice notice-error small" role="alert">
          {error}
        </p>
      )}
      <h4 className="section-label">Seguindo ({lists.following.length})</h4>
      {lists.following.length ? <ul className="social-list">{lists.following.map((p) => row(p))}</ul> : <p className="muted small">Ninguém. No perfil de alguém, “Seguir” traz os capítulos novos dos livros públicos para as Novidades, sem precisar ser amigo.</p>}
      <h4 className="section-label">Seguidores ({lists.followers.length})</h4>
      {lists.followers.length ? (
        <ul className="social-list">
          {lists.followers.map((p) =>
            row(
              p,
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void act(async () => removeFollower(await client(), myId, p.user_id))}>
                Tirar
              </button>,
            ),
          )}
        </ul>
      ) : (
        <p className="muted small">Ninguém segue você ainda.</p>
      )}
      {blocks.length > 0 && (
        <>
          <h4 className="section-label">Bloqueados ({blocks.length})</h4>
          <ul className="social-list">
            {blocks.map((p) =>
              row(
                p,
                <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void act(async () => unblock(await client(), myId, p.user_id))}>
                  Desbloquear
                </button>,
              ),
            )}
          </ul>
        </>
      )}
    </div>
  )
}
