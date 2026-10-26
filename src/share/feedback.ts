import type { SupabaseClient } from '@supabase/supabase-js'
import { authClient } from '../account/auth'
import { anonClient, type ServerConfig } from './server'

/**
 * Leitores beta (script supabase/compartilhar.sql): quem lê pelo link, ou foi convidado,
 * comenta trechos; só quem é dono lê, resolve e apaga.
 */
export interface Feedback {
  id: string
  scene_id: string
  quote: string
  body: string
  author_name: string
  resolved: boolean
  created_at: string
}

export class FeedbackError extends Error {}

const explain = (m: string) =>
  /papirus_feedback_from_shelf/.test(m) && /(does not exist|schema cache|not find)/i.test(m)
    ? 'O servidor ainda não recebe comentários pela estante. Rode de novo os scripts supabase/compartilhar.sql e supabase/social.sql.'
    : /papirus_feedback/.test(m) && /(does not exist|schema cache|not find)/i.test(m)
    ? 'O servidor ainda não recebe comentários de leitores. Rode de novo o script supabase/compartilhar.sql.'
    : /sem permissão/i.test(m)
      ? 'Este link não aceita mais comentários (talvez tenha sido desligado).'
      : /demais/i.test(m)
        ? 'Este livro já recebeu comentários demais.'
        : /Failed to fetch|NetworkError|Load failed/i.test(m)
          ? 'Sem conexão. Tente de novo em instantes.'
          : m

export type FeedbackTarget = { token: string } | { ownerId: string; universeId: string } | { shelf: { ownerId: string; bookId: string } }

export async function sendFeedback(sb: SupabaseClient, to: FeedbackTarget, f: { sceneId: string; quote: string; body: string; name: string }) {
  const body = f.body.trim()
  if (!body) throw new FeedbackError('Escreva o comentário antes de enviar.')
  if ('shelf' in to) {
    // Lendo pela estante: o nome vem do perfil de quem comenta.
    const { error } = await sb.rpc('papirus_feedback_from_shelf', { o: to.shelf.ownerId, book: to.shelf.bookId, scene: f.sceneId, q: f.quote.trim().slice(0, 600), b: body.slice(0, 2000) })
    if (error) throw new FeedbackError(explain(error.message))
    return
  }
  const { error } = await sb.rpc('papirus_feedback_add', {
    token: 'token' in to ? to.token : null,
    o: 'ownerId' in to ? to.ownerId : null,
    u: 'universeId' in to ? to.universeId : null,
    scene: f.sceneId,
    q: f.quote.trim().slice(0, 600),
    b: body.slice(0, 2000),
    n: f.name.trim().slice(0, 60),
  })
  if (error) throw new FeedbackError(explain(error.message))
}

export async function listFeedback(sb: SupabaseClient, ownerId: string, universeId: string): Promise<Feedback[]> {
  const { data, error } = await sb
    .from('papirus_feedback')
    .select('id,scene_id,quote,body,author_name,resolved,created_at')
    .eq('owner_id', ownerId)
    .eq('universe_id', universeId)
    .order('created_at', { ascending: false })
  if (error) throw new FeedbackError(explain(error.message))
  return (data ?? []) as Feedback[]
}

export async function resolveFeedback(sb: SupabaseClient, id: string, resolved: boolean) {
  const { error } = await sb.from('papirus_feedback').update({ resolved }).eq('id', id)
  if (error) throw new FeedbackError(explain(error.message))
}

export async function deleteFeedback(sb: SupabaseClient, id: string) {
  const { error } = await sb.from('papirus_feedback').delete().eq('id', id)
  if (error) throw new FeedbackError(explain(error.message))
}

/** Como mandar comentários a partir de onde o universo foi aberto (nada para o próprio dono). */
export function commentSender(
  source: { kind: 'proprio' } | { kind: 'editar' | 'ver'; ownerId: string } | { kind: 'link'; token: string; server: ServerConfig },
  universeId: string,
  server: ServerConfig | null,
): ((f: { sceneId: string; quote: string; body: string; name: string }) => Promise<void>) | undefined {
  if (source.kind === 'link') {
    const { token, server: s } = source
    return async (f) => sendFeedback(await anonClient(s), { token }, f)
  }
  if (source.kind === 'proprio' || !server) return undefined
  const ownerId = source.ownerId
  return async (f) => sendFeedback(await authClient(server), { ownerId, universeId }, f)
}
