import { useEffect, useMemo, useState } from 'react'
import { authClient, useAccount } from '../account/auth'
import { storiesOf } from '../export/bookDesign'
import { isLocalOnly } from '../model/sample'
import type { BookRecord, Scene, Universe } from '../model/schema'
import { scenesOf } from '../model/universe'
import type { Feedback } from '../share/feedback'
import { chapterReactions, type ChapterReaction } from '../social/chapterReactions'
import { shelfId } from '../social/social'
import { useWorkspace } from '../state/workspace'
import { useBetaFeedback } from './write/BetaReaders'

/*
 * O que os leitores disseram, por capítulo (como o BetaBooks, que junta os comentários de
 * todos num lugar): os comentários de quem lê pelo link e as reações de quem lê na estante.
 */

export interface BookReaders {
  /** Sem conta (ou no exemplo), não há leitores para mostrar. */
  available: boolean
  scenes: Scene[]
  feedback: Feedback[]
  reactions: ChapterReaction[]
}

/** As cenas do livro, na ordem, com texto. */
const bookScenes = (universe: Universe, book: BookRecord) => {
  const stories = storiesOf(universe, book)
  return (stories.length ? stories.flatMap((s) => scenesOf(universe, s.id)) : scenesOf(universe, null)).filter((s) => s.text.trim())
}

export function useBookReaders(book: BookRecord): BookReaders {
  const { universe, source } = useWorkspace()
  const { user, server } = useAccount()
  const all = useBetaFeedback('')
  const [reactions, setReactions] = useState<ChapterReaction[]>([])
  const published = book.shelfVisibility !== 'privado' && book.shelfReadable
  useEffect(() => {
    if (!user || !server || !published) return
    let off = false
    void authClient(server)
      .then((sb) => chapterReactions(sb, user.id, shelfId(universe.id, book.id)))
      .then((r) => !off && setReactions(r))
      .catch(() => undefined)
    return () => {
      off = true
    }
  }, [user, server, published, universe.id, book.id])
  const scenes = useMemo(() => bookScenes(universe, book), [universe, book])
  const ids = useMemo(() => new Set(scenes.map((s) => s.id)), [scenes])
  return {
    available: Boolean(user && server) && source.kind === 'proprio' && !isLocalOnly(universe),
    scenes,
    feedback: all.filter((f) => ids.has(f.scene_id)),
    reactions: published ? reactions.filter((r) => ids.has(r.scene_id)) : [],
  }
}

/** O resumo para o passo "Leitores" da página do Livro. */
export function readersSummary(r: BookReaders): { open: number; detail: string } {
  if (!r.available) return { open: 0, detail: 'Com uma conta, mande o link de leitura: os comentários e as reações aparecem aqui.' }
  const open = r.feedback.filter((f) => !f.resolved)
  const chapters = new Set(open.map((f) => f.scene_id)).size
  const parts = [
    open.length && `${open.length} ${open.length === 1 ? 'comentário aberto' : 'comentários abertos'} em ${chapters} ${chapters === 1 ? 'capítulo' : 'capítulos'}`,
    r.reactions.length && `${r.reactions.length} ${r.reactions.length === 1 ? 'reação' : 'reações'}`,
  ].filter(Boolean)
  return { open: open.length, detail: parts.join(' · ') || 'Ninguém comentou ainda. Mande o link de leitura.' }
}
