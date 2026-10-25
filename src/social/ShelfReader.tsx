import type { SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Universe } from '../model/schema'
import type { ReactionsApi } from '../reader/ChapterReactions'
import { ReaderView } from '../reader/ReaderView'
import { chapterReactions, reactToChapter, tally, type ChapterReaction } from './chapterReactions'
import { loadShelfText } from './shelfText'
import type { ShelfRow } from './social'

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
  const [universe, setUniverse] = useState<Universe | null>(null)
  const [list, setList] = useState<ChapterReaction[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let off = false
    void (async () => {
      try {
        const sb = await client()
        const [u, r] = await Promise.all([loadShelfText(sb, book.owner, book.id), chapterReactions(sb, book.owner, book.id)])
        if (off) return
        setUniverse(u)
        setList(r)
      } catch (err) {
        if (!off) setError(err instanceof Error ? err.message : String(err))
      }
    })()
    return () => {
      off = true
    }
  }, [client, book.owner, book.id])

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

  return createPortal(
    <div className="leitor-overlay" role="dialog" aria-modal="true" aria-label={`Lendo ${book.title}`}>
      {universe ? (
        <ReaderView
          universe={universe}
          storageKey={`leitor:estante:${book.owner}:${book.id}`}
          onClose={onClose}
          closeLabel="Voltar à estante"
          reactions={api}
          footer={
            <>
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
