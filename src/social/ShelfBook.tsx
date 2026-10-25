import type { SupabaseClient } from '@supabase/supabase-js'
import { Bookmark, BookmarkCheck, BookOpen, Globe, MessageCircle, Send, Trash2, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ConfirmButton } from '../ui/ConfirmButton'
import { addComment, deleteComment, profilesByIds, setWantToRead, shelfActivity, shelfOf, type Profile, type Reaction, type ShelfComment, type ShelfRow } from './social'

const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' })

/**
 * Um livro na estante de alguém: a vitrine (capa, sinopse, números), "Quero ler" e comentários.
 * Quem pode ver o livro pode participar; o servidor confere.
 */
export function ShelfBook({
  book,
  me,
  reactions,
  comments,
  people,
  client,
  onChanged,
  onAccount,
  open: startOpen = false,
}: {
  book: ShelfRow
  /** Quem está vendo (null = sem conta). */
  me: string | null
  reactions: Reaction[]
  comments: ShelfComment[]
  people: Map<string, Profile>
  client: () => Promise<SupabaseClient>
  onChanged: () => void
  onAccount?: () => void
  /** Começa com os comentários abertos (vindo de um aviso). */
  open?: boolean
}) {
  const [open, setOpen] = useState(startOpen)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const wants = reactions.some((r) => r.user_id === me)
  const isOwner = me === book.owner
  const readable = !!book.read_link && /^https?:\/\//i.test(book.read_link)

  const act = async (fn: (sb: SupabaseClient) => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn(await client())
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="social-book" id={`livro-${book.id}`}>
      {book.cover ? (
        <img className="social-book-cover" src={book.cover} alt={`Capa de ${book.title}`} />
      ) : (
        <span className="social-book-cover book-hero-placeholder" aria-hidden="true">
          <span className="book-hero-placeholder-title">{book.title}</span>
        </span>
      )}
      <div className="social-book-info">
        <strong className="social-book-title">{book.title}</strong>
        {book.author && <span className="small">{book.author}</span>}
        <span className="muted tiny">
          {book.chapters} {book.chapters === 1 ? 'capítulo' : 'capítulos'} · {book.words.toLocaleString('pt-BR')} palavras
          {book.universe_name && ` · ${book.universe_name}`} ·{' '}
          {book.visibility === 'publico' ? <Globe size={11} aria-label="público" /> : <Users size={11} aria-label="só amigos" />}
        </span>
        {book.blurb && <p className="small social-book-blurb">{book.blurb}</p>}
        <div className="social-book-actions">
          {readable && (
            <a className="btn btn-sm btn-primary" href={book.read_link!}>
              <BookOpen size={15} /> Ler
            </a>
          )}
          {isOwner ? (
            reactions.length > 0 && (
              <span className="muted small social-want-count">
                <BookmarkCheck size={14} aria-hidden="true" /> {reactions.length} {reactions.length === 1 ? 'pessoa quer' : 'pessoas querem'} ler
              </span>
            )
          ) : (
            <button
              type="button"
              className={`btn btn-sm${wants ? ' social-want-on' : ' btn-ghost'}`}
              aria-pressed={wants}
              title="Guarda o livro e avisa você quando sair capítulo novo"
              disabled={busy}
              onClick={() => (me ? void act((sb) => setWantToRead(sb, me, book.owner, book.id, !wants)) : onAccount?.())}
            >
              {wants ? <BookmarkCheck size={15} /> : <Bookmark size={15} />} Quero ler
              {reactions.length > 0 && <span className="social-count">{reactions.length}</span>}
            </button>
          )}
          <button type="button" className="btn btn-sm btn-ghost" aria-expanded={open} onClick={() => setOpen(!open)}>
            <MessageCircle size={15} /> {comments.length ? `${comments.length} ${comments.length === 1 ? 'comentário' : 'comentários'}` : 'Comentar'}
          </button>
        </div>

        {open && (
          <section className="social-comments" aria-label={`Comentários sobre ${book.title}`}>
            {comments.length === 0 && <p className="muted small">Ninguém comentou ainda.</p>}
            <ul className="social-comment-list">
              {comments.map((c) => {
                const who = people.get(c.author)
                return (
                  <li key={c.id} className="social-comment">
                    <span className="social-comment-head">
                      <strong className="small">{who ? who.name || `@${who.handle}` : 'Alguém'}</strong>
                      <span className="muted tiny">
                        {who && `@${who.handle} · `}
                        {dateFmt.format(new Date(c.created_at))}
                      </span>
                      {(c.author === me || isOwner) && (
                        <ConfirmButton className="btn-icon btn-xs" title="Apagar comentário" question="Apagar este comentário?" confirmLabel="Apagar" onConfirm={() => act((sb) => deleteComment(sb, c.id))}>
                          <Trash2 size={13} aria-label="Apagar comentário" />
                        </ConfirmButton>
                      )}
                    </span>
                    <p className="small">{c.body}</p>
                  </li>
                )
              })}
            </ul>
            {me ? (
              <form
                className="social-comment-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  void act(async (sb) => {
                    await addComment(sb, me, book.owner, book.id, draft)
                    setDraft('')
                  })
                }}
              >
                <label className="sr-only" htmlFor={`comentar-${book.id}`}>
                  Seu comentário
                </label>
                <textarea id={`comentar-${book.id}`} className="input" rows={2} maxLength={1000} placeholder="O que achou? Sem spoiler, por favor." value={draft} onChange={(e) => setDraft(e.target.value)} />
                <button type="submit" className="btn btn-sm btn-primary" disabled={busy || !draft.trim()}>
                  <Send size={14} /> Enviar
                </button>
              </form>
            ) : (
              onAccount && (
                <button type="button" className="btn btn-sm" onClick={onAccount}>
                  Entrar para comentar
                </button>
              )
            )}
          </section>
        )}
        {error && (
          <p className="notice notice-error small" role="alert">
            {error}
          </p>
        )}
      </div>
    </li>
  )
}

/** A estante de alguém, com "quero ler" e comentários. Carrega sozinha; `refreshKey` muda quando a amizade muda. */
export function OwnerShelf({
  ownerId,
  handle,
  me,
  client,
  refreshKey,
  focusBook,
  onAccount,
  empty,
}: {
  ownerId: string
  handle: string
  me: string | null
  client: () => Promise<SupabaseClient>
  refreshKey?: unknown
  /** Livro para abrir com os comentários (vindo de um aviso). */
  focusBook?: string
  onAccount?: () => void
  empty: string
}) {
  const [data, setData] = useState<{ books: ShelfRow[]; reactions: Reaction[]; comments: ShelfComment[]; people: Map<string, Profile> } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)
  useEffect(() => {
    let off = false
    void (async () => {
      try {
        const sb = await client()
        const [books, act] = await Promise.all([shelfOf(sb, ownerId), shelfActivity(sb, ownerId)])
        const people = await profilesByIds(sb, [...new Set(act.comments.map((c) => c.author))])
        if (!off) setData({ books, ...act, people })
      } catch (err) {
        if (!off) setError(err instanceof Error ? err.message : String(err))
      }
    })()
    return () => {
      off = true
    }
  }, [ownerId, client, refreshKey, nonce])

  useEffect(() => {
    if (focusBook && data) document.getElementById(`livro-${focusBook}`)?.scrollIntoView({ block: 'center' })
  }, [focusBook, data])

  if (error)
    return (
      <p className="notice notice-error small" role="alert">
        {error}
      </p>
    )
  if (!data) return <p className="muted small">Carregando…</p>
  if (!data.books.length) return <p className="muted small">{empty}</p>
  return (
    <ul className="social-shelf" aria-label={`Estante de @${handle}`}>
      {data.books.map((b) => (
        <ShelfBook
          key={b.id}
          book={b}
          me={me}
          reactions={data.reactions.filter((r) => r.book_id === b.id)}
          comments={data.comments.filter((c) => c.book_id === b.id)}
          people={data.people}
          client={client}
          onChanged={() => setNonce((n) => n + 1)}
          onAccount={onAccount}
          open={focusBook === b.id}
        />
      ))}
    </ul>
  )
}
