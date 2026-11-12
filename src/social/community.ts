import type { SupabaseClient } from '@supabase/supabase-js'
import { profilesByIds, SocialError, type Profile } from './social'

/*
 * A Comunidade (script supabase/comunidade.sql): seguir, continuar lendo, quem leu até onde,
 * bloquear, denunciar e pedir AU. Quem pode o quê é o servidor que garante; aqui só pedimos.
 */

const MISSING = 'O servidor ainda não tem a Comunidade (seguir, continuar lendo, bloquear). Rode o script supabase/comunidade.sql no SQL Editor do Supabase.'

const explain = (message: string) =>
  /papirus_(follows|blocks|reading|reports|open_worlds|au_requests|block|blocked|reading_stats|follow_counts)/.test(message) && /(does not exist|schema cache|not find)/i.test(message)
    ? MISSING
    : /duplicate key|_pkey/i.test(message)
      ? 'Isso já foi feito.'
      : /row-level security|permission/i.test(message)
        ? 'Não dá: a pessoa não aceita isso agora.'
        : /Failed to fetch|NetworkError|Load failed/i.test(message)
          ? 'Sem conexão com o servidor.'
          : message

function check<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new SocialError(explain(r.error.message))
  return r.data
}

/** O servidor tem a Comunidade? (sem o script, as partes novas só não aparecem) */
export const isMissing = (err: unknown) => err instanceof Error && err.message === MISSING

// ─── Seguir ────────────────────────────────────────────────────────────

export async function follow(sb: SupabaseClient, me: string, other: string) {
  check(await sb.from('papirus_follows').insert({ follower: me, followee: other }))
}

export async function unfollow(sb: SupabaseClient, me: string, other: string) {
  check(await sb.from('papirus_follows').delete().eq('follower', me).eq('followee', other))
}

/** Tira alguém dos meus seguidores. */
export async function removeFollower(sb: SupabaseClient, me: string, other: string) {
  check(await sb.from('papirus_follows').delete().eq('follower', other).eq('followee', me))
}

export interface FollowLists {
  following: Profile[]
  followers: Profile[]
}

export async function myFollows(sb: SupabaseClient, me: string): Promise<FollowLists> {
  const rows = check(await sb.from('papirus_follows').select('follower,followee').or(`follower.eq.${me},followee.eq.${me}`)) as { follower: string; followee: string }[]
  const following = rows.filter((r) => r.follower === me).map((r) => r.followee)
  const followers = rows.filter((r) => r.followee === me).map((r) => r.follower)
  const people = await profilesByIds(sb, [...new Set([...following, ...followers])])
  const pick = (ids: string[]) => ids.map((id) => people.get(id)).filter((p): p is Profile => Boolean(p))
  return { following: pick(following), followers: pick(followers) }
}

export async function followCounts(sb: SupabaseClient, user: string): Promise<{ followers: number; following: number }> {
  const rows = check(await sb.rpc('papirus_follow_counts', { u: user })) as { followers: number; following: number }[] | null
  const r = rows?.[0]
  return { followers: Number(r?.followers ?? 0), following: Number(r?.following ?? 0) }
}

// ─── Bloquear e denunciar ──────────────────────────────────────────────

/** Bloqueia: a pessoa não comenta, não reage, não pede amizade nem segue; amizade e seguir somem. */
export async function block(sb: SupabaseClient, other: string) {
  check(await sb.rpc('papirus_block', { u: other }))
}

export async function unblock(sb: SupabaseClient, me: string, other: string) {
  check(await sb.from('papirus_blocks').delete().eq('blocker', me).eq('blocked', other))
}

export async function myBlocks(sb: SupabaseClient, me: string): Promise<Profile[]> {
  const rows = check(await sb.from('papirus_blocks').select('blocked').eq('blocker', me)) as { blocked: string }[]
  const people = await profilesByIds(sb, rows.map((r) => r.blocked))
  return rows.map((r) => people.get(r.blocked)).filter((p): p is Profile => Boolean(p))
}

export const REPORT_REASONS = ['Ofensivo ou ódio', 'Assédio', 'Spam ou propaganda', 'Conteúdo sexual sem aviso', 'Outro motivo'] as const

export async function report(sb: SupabaseClient, r: { target: string; reason: string; body?: string; commentId?: string; bookOwner?: string; bookId?: string }) {
  check(
    await sb.from('papirus_reports').insert({
      target: r.target,
      reason: r.reason.slice(0, 500),
      body: (r.body ?? '').slice(0, 1000),
      comment_id: r.commentId ?? null,
      book_owner: r.bookOwner ?? null,
      book_id: r.bookId ?? null,
    }),
  )
}

// ─── Continuar lendo e quem leu até onde ───────────────────────────────

export interface ReadingRow {
  owner: string
  book_id: string
  chapter_index: number
  furthest: number
  chapters_seen: number
  updated_at: string
}

/** Onde a pessoa parou neste livro (de qualquer aparelho). Sem o script, null. */
export async function readingOf(sb: SupabaseClient, me: string, owner: string, bookId: string): Promise<ReadingRow | null> {
  const { data, error } = await sb.from('papirus_reading').select('owner,book_id,chapter_index,furthest,chapters_seen,updated_at').eq('user_id', me).eq('owner', owner).eq('book_id', bookId)
  if (error) return null
  return ((data ?? []) as ReadingRow[])[0] ?? null
}

/** Quem eu bloqueei (só os ids, para esconder o que a pessoa escreveu). Sem o script, ninguém. */
export async function blockedIds(sb: SupabaseClient, me: string): Promise<Set<string>> {
  const { data, error } = await sb.from('papirus_blocks').select('blocked').eq('blocker', me)
  return new Set(error ? [] : ((data ?? []) as { blocked: string }[]).map((r) => r.blocked))
}

/** Guarda onde a pessoa está no livro (e o mais longe que chegou). */
export async function saveReading(sb: SupabaseClient, me: string, owner: string, bookId: string, chapterIndex: number, chapters: number) {
  const prev = check(await sb.from('papirus_reading').select('furthest').eq('user_id', me).eq('owner', owner).eq('book_id', bookId)) as { furthest: number }[]
  const furthest = Math.max(chapterIndex, prev[0]?.furthest ?? 0)
  check(
    await sb
      .from('papirus_reading')
      .upsert(
        { user_id: me, owner, book_id: bookId, chapter_index: chapterIndex, furthest, chapters_seen: chapters, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,owner,book_id' },
      ),
  )
}

export interface ContinueReading {
  owner: Profile | null
  book: { owner: string; id: string; title: string; author: string; cover: string | null; chapters: number }
  chapterIndex: number
  /** Capítulos que saíram desde a última leitura. */
  newChapters: number
  updatedAt: string
}

/** Os livros que a pessoa está lendo, do mais recente para o mais antigo, com os capítulos novos. */
export async function continueReading(sb: SupabaseClient, me: string): Promise<ContinueReading[]> {
  const rows = check(await sb.from('papirus_reading').select('owner,book_id,chapter_index,furthest,chapters_seen,updated_at').eq('user_id', me)) as ReadingRow[]
  if (!rows.length) return []
  const books = check(
    await sb
      .from('papirus_shelf')
      .select('owner,id,title,author,cover,chapters')
      .in('id', [...new Set(rows.map((r) => r.book_id))]),
  ) as ContinueReading['book'][]
  const people = await profilesByIds(sb, [...new Set(rows.map((r) => r.owner))])
  return rows
    .flatMap((r) => {
      const book = books.find((b) => b.owner === r.owner && b.id === r.book_id)
      if (!book) return []
      return [{ owner: people.get(r.owner) ?? null, book, chapterIndex: r.chapter_index, newChapters: Math.max(0, book.chapters - r.chapters_seen), updatedAt: r.updated_at }]
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

/** Para o autor: quantas pessoas chegaram até cada capítulo (1º, 2º…), sem dizer quem. */
export async function readingStats(sb: SupabaseClient, bookId: string, chapters: number): Promise<number[]> {
  const rows = check(await sb.rpc('papirus_reading_stats', { b: bookId })) as { furthest: number; readers: number }[] | null
  const reached = Array.from({ length: Math.max(chapters, 0) }, () => 0)
  for (const r of rows ?? []) for (let i = 0; i <= Math.min(Number(r.furthest), reached.length - 1); i++) reached[i] += Number(r.readers)
  return reached
}

// ─── Mundos abertos a AU e os pedidos ──────────────────────────────────

export interface OpenWorld {
  owner: string
  universe_id: string
  name: string
  blurb: string
}

export async function openWorldsOf(sb: SupabaseClient, owner: string): Promise<OpenWorld[]> {
  return check(await sb.from('papirus_open_worlds').select('owner,universe_id,name,blurb').eq('owner', owner)) as OpenWorld[]
}

export async function setWorldOpen(sb: SupabaseClient, me: string, universe: { id: string; name: string; description: string }, open: boolean) {
  if (open)
    check(
      await sb
        .from('papirus_open_worlds')
        .upsert({ owner: me, universe_id: universe.id, name: universe.name.slice(0, 200), blurb: universe.description.slice(0, 1000), updated_at: new Date().toISOString() }, { onConflict: 'owner,universe_id' }),
    )
  else check(await sb.from('papirus_open_worlds').delete().eq('owner', me).eq('universe_id', universe.id))
}

export type AURequestStatus = 'pendente' | 'aceito' | 'recusado'

export interface AURequest {
  owner: string
  universe_id: string
  requester: string
  requester_email: string
  message: string
  status: AURequestStatus
  created_at: string
}

export async function requestAU(sb: SupabaseClient, owner: string, universeId: string, message: string) {
  check(await sb.from('papirus_au_requests').insert({ owner, universe_id: universeId, message: message.slice(0, 500) }))
}

/** Os pedidos que fiz e os que recebi. */
export async function auRequests(sb: SupabaseClient, me: string): Promise<{ mine: AURequest[]; toMe: AURequest[] }> {
  const rows = check(await sb.from('papirus_au_requests').select('owner,universe_id,requester,requester_email,message,status,created_at').or(`owner.eq.${me},requester.eq.${me}`)) as AURequest[]
  return { mine: rows.filter((r) => r.requester === me), toMe: rows.filter((r) => r.owner === me) }
}

export async function answerAU(sb: SupabaseClient, r: Pick<AURequest, 'owner' | 'universe_id' | 'requester'>, status: AURequestStatus) {
  check(await sb.from('papirus_au_requests').update({ status }).eq('owner', r.owner).eq('universe_id', r.universe_id).eq('requester', r.requester))
}
