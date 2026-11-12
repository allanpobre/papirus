import type { SupabaseClient } from '@supabase/supabase-js'
import { useBackLayer } from '../ui/useBackLayer'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Universe } from '../model/schema'
import type { ReactionsApi } from '../reader/ChapterReactions'
import { ReaderView } from '../reader/ReaderView'
import { chapterReactions, reactToChapter, tally, type ChapterReaction } from './chapterReactions'
import { loadShelfText } from './shelfText'
import { sendFeedback } from '../share/feedback'
import { Flag, MessageCircle, Send, Trash2 } from 'lucide-react'
import { ConfirmButton } from '../ui/ConfirmButton'
import { addComment, deleteComment, profilesByIds, type Profile, type ShelfComment, type ShelfRow } from './social'
import { blockedIds, readingOf, report, REPORT_REASONS, saveReading } from './community'

/** Ler um livro da estante ali mesmo: o modo leitor por cima, com reações por capítulo. */
export function ShelfReader({
  book,
  me,
  client,
  onClose,
  onAccount,
}: {
  book: ShelfRow
  me: string | null
  client: () => Promise<SupabaseClient>
  onClose: () => void
  onAccount?: () => void
}) {
  useBackLayer(onClose)
  const [universe, setUniverse] = useState<Universe | null>(null)
  const [list, setList] = useState<ChapterReaction[]>([])
  const [error, setError] = useState<string | null>(null)
  // Onde parou (em qualquer aparelho): o leitor começa ali se este aparelho ainda não leu.
  const [startAt, setStartAt] = useState(0)

  useEffect(() => {
    let off = false
    void (async () => {
      try {
        const sb = await client()
        const [u, r, saved] = await Promise.all([
          loadShelfText(sb, book.owner, book.id),
          chapterReactions(sb, book.owner, book.id),
          me && me !== book.owner ? readingOf(sb, me, book.owner, book.id) : Promise.resolve(null),
        ])
        if (off) return
        if (saved) setStartAt(saved.chapter_index)
        setUniverse(u)
        setList(r)
      } catch (err) {
        if (!off) setError(err instanceof Error ? err.message : String(err))
      }
    })()
    return () => {
      off = true
    }
  }, [client, book.owner, book.id, me])

  const api = useMemo<ReactionsApi>(() => {
    const counts = tally(list)
    return {
      counts: (sceneId) => counts.get(sceneId) ?? {},
      mine: (sceneId) => list.find((r) => r.scene_id === sceneId && r.user_id === me)?.emoji ?? null,
      react: (sceneId, emoji) => {
        if (!me) return onAccount?.()
        const before = list
        // Muda na hora; se o servidor recusar, volta como estava.
        const rest = list.filter((r) => !(r.scene_id === sceneId && r.user_id === me))
        setList(emoji ? [...rest, { owner: book.owner, book_id: book.id, scene_id: sceneId, user_id: me, emoji, created_at: new Date().toISOString() }] : rest)
        void client()
          .then((sb) => reactToChapter(sb, me, book.owner, book.id, sceneId, emoji))
          .catch((err) => {
            setList(before)
            setError(err instanceof Error ? err.message : String(err))
          })
      },
    }
  }, [list, me, book.owner, book.id, client, onAccount])

  // Guarda onde a pessoa está (para "Continuar lendo" e para o autor ver até onde leram). Sem o script, só não guarda.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onProgress = (current: number) => {
    if (!me || me === book.owner) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void client()
        .then((sb) => saveReading(sb, me, book.owner, book.id, current, book.chapters))
        .catch(() => undefined)
    }, 1200)
  }
  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
  }, [])

  return createPortal(
    <div className="leitor-overlay" role="dialog" aria-modal="true" aria-label={`Lendo ${book.title}`}>
      {universe ? (
        <ReaderView
          universe={universe}
          storageKey={`leitor:estante:${book.owner}:${book.id}`}
          startAt={startAt}
          onProgress={onProgress}
          onClose={onClose}
          closeLabel="Voltar à estante"
          reactions={api}
          // Comentário só para quem escreveu (trecho selecionado ou o capítulo): vai para a margem do autor.
          onComment={me && me !== book.owner ? async (f) => sendFeedback(await client(), { shelf: { ownerId: book.owner, bookId: book.id } }, f) : undefined}
          commenterName={me ? 'conta' : undefined}
          footer={
            <>
              <BookComments book={book} me={me} client={client} onAccount={onAccount} />
              {error && (
                <p className="notice notice-error small" role="alert">
                  {error}
                </p>
              )}
              {!me && <p className="leitor-made muted tiny">Entre na sua conta para reagir aos capítulos.</p>}
            </>
          }
        />
      ) : (
        <div className="leitor-loading">
          {error ? (
            <>
              <p className="notice notice-error" role="alert">
                {error}
              </p>
              <button type="button" className="btn" onClick={onClose}>
                Voltar
              </button>
            </>
          ) : (
            <p className="muted">Abrindo “{book.title}”…</p>
          )}
        </div>
      )}
    </div>,
    document.body,
  )
}

const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' })

/** Os comentários do livro (públicos para quem vê o livro), dentro da leitura. */
function BookComments({ book, me, client, onAccount }: { book: ShelfRow; me: string | null; client: () => Promise<SupabaseClient>; onAccount?: () => void }) {
  const [open, setOpen] = useState(false)
  const [list, setList] = useState<ShelfComment[]>([])
  const [people, setPeople] = useState<Map<string, Profile>>(new Map())
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [reporting, setReporting] = useState<string | null>(null)
  const [reason, setReason] = useState<string>(REPORT_REASONS[0])
  const [reported, setReported] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let off = false
    void (async () => {
      const sb = await client()
      const { data, error: e } = await sb.from('papirus_shelf_comments').select('id,owner,book_id,author,body,created_at').eq('owner', book.owner).eq('book_id', book.id).order('created_at', { ascending: true })
      if (off || e) return
      const hidden = me ? await blockedIds(sb, me) : new Set<string>()
      const rows = ((data ?? []) as ShelfComment[]).filter((c) => !hidden.has(c.author))
      setList(rows)
      setPeople(await profilesByIds(sb, [...new Set(rows.map((c) => c.author))]))
    })().catch(() => undefined)
    return () => {
      off = true
    }
  }, [client, book.owner, book.id, nonce, me])

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

  return (
    <section className="leitor-book-comments" aria-label={`Comentários sobre ${book.title}`}>
      <button type="button" className="btn btn-ghost btn-sm" aria-expanded={open} onClick={() => setOpen(!open)}>
        <MessageCircle size={15} /> {list.length ? `${list.length} ${list.length === 1 ? 'comentário' : 'comentários'} sobre o livro` : 'Comentar o livro'}
      </button>
      {open && (
        <>
          {list.length === 0 && <p className="muted small">Ninguém comentou ainda. Quem vê o livro lê os comentários.</p>}
          <ul className="social-comment-list">
            {list.map((c) => {
              const who = people.get(c.author)
              return (
                <li key={c.id} className="social-comment">
                  <span className="social-comment-head">
                    <strong className="small">{who ? who.name || `@${who.handle}` : 'Alguém'}</strong>
                    <span className="muted tiny">{dateFmt.format(new Date(c.created_at))}</span>
                    {(c.author === me || book.owner === me) && (
                      <ConfirmButton className="btn-icon btn-xs" title="Apagar comentário" question="Apagar este comentário?" confirmLabel="Apagar" onConfirm={() => act((sb) => deleteComment(sb, c.id))}>
                        <Trash2 size={13} aria-label="Apagar comentário" />
                      </ConfirmButton>
                    )}
                    {me && c.author !== me && (
                      <button type="button" className="btn-icon btn-xs" title="Denunciar comentário" aria-label="Denunciar comentário" onClick={() => setReporting(reporting === c.id ? null : c.id)}>
                        <Flag size={13} />
                      </button>
                    )}
                  </span>
                  <p className="small">{c.body}</p>
                  {reporting === c.id && (
                    <form
                      className="report-form"
                      onSubmit={(e) => {
                        e.preventDefault()
                        void act(async (sb) => {
                          await report(sb, { target: c.author, reason, body: c.body, commentId: c.id, bookOwner: book.owner, bookId: book.id })
                          setReporting(null)
                          setReported(true)
                        })
                      }}
                    >
                      <select className="input input-sm" aria-label="Motivo da denúncia" value={reason} onChange={(e) => setReason(e.target.value)}>
                        {REPORT_REASONS.map((r) => (
                          <option key={r}>{r}</option>
                        ))}
                      </select>
                      <button type="submit" className="btn btn-sm" disabled={busy}>
                        Denunciar
                      </button>
                    </form>
                  )}
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
              <label className="sr-only" htmlFor={`comentar-livro-${book.id}`}>
                Comentário sobre o livro
              </label>
              <textarea
                id={`comentar-livro-${book.id}`}
                className="input"
                rows={2}
                maxLength={1000}
                placeholder="O que está achando? Todo mundo que vê o livro lê. Sem spoiler, por favor."
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
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
          {reported && (
            <p className="notice small" role="status">
              Denúncia enviada. Quem cuida do servidor vê e decide. Para não ver mais essa pessoa, bloqueie no perfil dela.
            </p>
          )}
          {error && (
            <p className="notice notice-error small" role="alert">
              {error}
            </p>
          )}
        </>
      )}
    </section>
  )
}
