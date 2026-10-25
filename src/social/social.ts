import type { SupabaseClient } from '@supabase/supabase-js'
import type { BookRecord, Universe } from '../model/schema'
import { bookContent, bookTitle } from '../export/bookDesign'
import { shelf } from '../export/shelf'
import { DEFAULT_PUBLIC_URL } from '../share/server'

/**
 * Perfil, amigos e estante (script supabase/social.sql).
 * Quem vê o quê é o servidor que garante (RLS); aqui só pedimos.
 */
export interface Profile {
  user_id: string
  handle: string
  name: string
  bio: string
  avatar: string | null
}

export interface Friendship {
  requester: string
  addressee: string
  status: 'pendente' | 'aceita'
  created_at: string
}

export type ShelfVisibility = BookRecord['shelfVisibility']

export interface ShelfRow {
  owner: string
  id: string
  title: string
  author: string
  blurb: string
  cover: string | null
  chapters: number
  words: number
  universe_name: string
  visibility: Exclude<ShelfVisibility, 'privado'>
  read_link: string | null
  updated_at: string
}

export const VISIBILITY_LABEL: Record<ShelfVisibility, string> = {
  privado: 'Só eu',
  amigos: 'Amigos',
  publico: 'Todo mundo',
}

export class SocialError extends Error {}

const explain = (message: string) =>
  /papirus_(profiles|friendships|shelf|are_friends)/.test(message) && /(does not exist|schema cache|not find)/i.test(message)
    ? 'O servidor ainda não tem perfis e amigos. Rode o script supabase/social.sql no SQL Editor do Supabase.'
    : /papirus_profiles_handle_key|duplicate key.*handle/i.test(message)
      ? 'Esse @ já é de outra pessoa. Escolha outro.'
      : /papirus_friendships_pkey|duplicate key/i.test(message)
        ? 'Já existe um pedido de amizade entre vocês.'
        : /handle_check/i.test(message)
          ? 'O @ precisa ter de 3 a 24 letras minúsculas, números, "." ou "_".'
          : /Failed to fetch|NetworkError|Load failed/i.test(message)
            ? 'Sem conexão com o servidor.'
            : /row-level security|permission/i.test(message)
              ? 'Você não tem permissão para isso.'
              : message

function check<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new SocialError(explain(r.error.message))
  return r.data
}

const PROFILE_COLS = 'user_id,handle,name,bio,avatar'
const SHELF_COLS = 'owner,id,title,author,blurb,cover,chapters,words,universe_name,visibility,read_link,updated_at'

/** Normaliza o que a pessoa digitou no @ (tira o "@", espaços, acentos e maiúsculas). */
export function cleanHandle(raw: string): string {
  return raw
    .trim()
    .replace(/^@+/, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_.]/g, '')
    .slice(0, 24)
}

export const isHandle = (h: string) => /^[a-z0-9_.]{3,24}$/.test(h)

/** Sugestão de @ a partir do e-mail. */
export const suggestHandle = (email: string) => {
  const h = cleanHandle(email.split('@')[0] ?? '')
  return h.length >= 3 ? h : `${h}${'leitor'.slice(0, 3 - h.length)}`
}

export async function myProfile(sb: SupabaseClient, myId: string): Promise<Profile | null> {
  const rows = check(await sb.from('papirus_profiles').select(PROFILE_COLS).eq('user_id', myId)) as Profile[]
  return rows?.[0] ?? null
}

export async function saveProfile(sb: SupabaseClient, myId: string, p: Pick<Profile, 'handle' | 'name' | 'bio' | 'avatar'>): Promise<Profile> {
  const handle = cleanHandle(p.handle)
  if (!isHandle(handle)) throw new SocialError('O @ precisa ter de 3 a 24 letras minúsculas, números, "." ou "_".')
  const rows = check(
    await sb
      .from('papirus_profiles')
      .upsert({ user_id: myId, handle, name: p.name.trim().slice(0, 80), bio: p.bio.trim().slice(0, 600), avatar: p.avatar }, { onConflict: 'user_id' })
      .select(PROFILE_COLS),
  ) as Profile[]
  setMyProfileCache(myId, rows[0])
  return rows[0]
}

export async function profileByHandle(sb: SupabaseClient, raw: string): Promise<Profile | null> {
  const handle = cleanHandle(raw)
  if (!isHandle(handle)) return null
  const rows = check(await sb.from('papirus_profiles').select(PROFILE_COLS).eq('handle', handle)) as Profile[]
  return rows?.[0] ?? null
}

export async function profilesByIds(sb: SupabaseClient, ids: string[]): Promise<Map<string, Profile>> {
  if (!ids.length) return new Map()
  const rows = check(await sb.from('papirus_profiles').select(PROFILE_COLS).in('user_id', ids)) as Profile[]
  return new Map((rows ?? []).map((p) => [p.user_id, p]))
}

/** Meus amigos e pedidos, já com o perfil da outra pessoa. */
export interface FriendEntry {
  other: Profile
  status: Friendship['status']
  /** Fui eu que pedi? */
  outgoing: boolean
}

export async function myFriends(sb: SupabaseClient, myId: string): Promise<FriendEntry[]> {
  const rows = check(await sb.from('papirus_friendships').select('requester,addressee,status,created_at').or(`requester.eq.${myId},addressee.eq.${myId}`)) as Friendship[]
  const others = (rows ?? []).map((f) => (f.requester === myId ? f.addressee : f.requester))
  const profiles = await profilesByIds(sb, others)
  return (rows ?? []).flatMap((f) => {
    const id = f.requester === myId ? f.addressee : f.requester
    const other = profiles.get(id)
    return other ? [{ other, status: f.status, outgoing: f.requester === myId }] : []
  })
}

export async function requestFriend(sb: SupabaseClient, myId: string, otherId: string) {
  if (otherId === myId) throw new SocialError('Esse é o seu próprio perfil.')
  check(await sb.from('papirus_friendships').insert({ requester: myId, addressee: otherId, status: 'pendente' }))
}

export async function acceptFriend(sb: SupabaseClient, myId: string, otherId: string) {
  check(await sb.from('papirus_friendships').update({ status: 'aceita' }).eq('requester', otherId).eq('addressee', myId))
}

/** Recusar, cancelar o pedido ou desfazer a amizade. */
export async function removeFriend(sb: SupabaseClient, myId: string, otherId: string) {
  check(await sb.from('papirus_friendships').delete().eq('requester', myId).eq('addressee', otherId))
  check(await sb.from('papirus_friendships').delete().eq('requester', otherId).eq('addressee', myId))
}

/** A estante de alguém: só volta o que o servidor deixa ver. */
export async function shelfOf(sb: SupabaseClient, ownerId: string): Promise<ShelfRow[]> {
  const rows = check(await sb.from('papirus_shelf').select(SHELF_COLS).eq('owner', ownerId).order('updated_at', { ascending: false })) as ShelfRow[]
  return rows ?? []
}

// ─── Minha estante: o que vai para o servidor ────────────────────────

/** Id na estante: o mesmo livro em universos diferentes não se confunde. */
export const shelfId = (universeId: string, bookId: string) => `${universeId}:${bookId}`

/** Capa grande demais para a vitrine fica de fora (o livro vai sem capa). */
const MAX_COVER = 1_500_000

export function shelfRowOf(universe: Universe, book: BookRecord, readLinkUrl: string | null): Omit<ShelfRow, 'owner' | 'updated_at'> | null {
  if (book.shelfVisibility === 'privado') return null
  const { parts, words } = bookContent(universe, book)
  return {
    id: shelfId(universe.id, book.id),
    title: bookTitle(universe, book).slice(0, 200),
    author: book.author.trim().slice(0, 120),
    blurb: book.blurb.trim().slice(0, 2000),
    cover: book.cover && book.cover.length <= MAX_COVER ? book.cover : null,
    chapters: parts.reduce((n, p) => n + p.chapters.length, 0),
    words,
    universe_name: universe.name,
    visibility: book.shelfVisibility,
    read_link: readLinkUrl,
  }
}

// O que já foi enviado nesta aba (evita mandar de novo a cada tecla).
const sent = new Map<string, string>()

/**
 * Deixa a estante do servidor igual aos livros deste universo: põe os visíveis,
 * tira os privados e os que saíram da estante. Devolve quantos livros estão à mostra.
 */
export async function syncShelf(sb: SupabaseClient, myId: string, universe: Universe, readLinkUrl: string | null): Promise<number> {
  const books = shelf(universe)
  const rows = books.flatMap((b) => {
    const r = shelfRowOf(universe, b, readLinkUrl)
    return r ? [r] : []
  })
  const keep = new Set(rows.map((r) => r.id))
  const changed = rows.filter((r) => sent.get(`${myId}|${r.id}`) !== JSON.stringify(r))
  if (changed.length) {
    check(await sb.from('papirus_shelf').upsert(changed.map((r) => ({ ...r, owner: myId, updated_at: new Date().toISOString() })), { onConflict: 'owner,id' }))
    for (const r of changed) sent.set(`${myId}|${r.id}`, JSON.stringify(r))
  }
  // Tira o que não está mais à mostra (livro privado, apagado…).
  const prefix = `${universe.id}:`
  const listed = (check(await sb.from('papirus_shelf').select('id').eq('owner', myId)) as { id: string }[]).map((r) => r.id).filter((id) => id.startsWith(prefix))
  const gone = listed.filter((id) => !keep.has(id))
  if (gone.length) {
    check(await sb.from('papirus_shelf').delete().eq('owner', myId).in('id', gone))
    for (const id of gone) sent.delete(`${myId}|${id}`)
  }
  return rows.length
}

/** Esquece o que foi enviado (para testes e ao trocar de conta). */
export const resetShelfCache = () => sent.clear()

/** Reduz uma foto para o perfil (quadrada, 256px, JPEG). */
export async function shrinkAvatar(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new SocialError('Não deu para abrir essa imagem.'))
      i.src = url
    })
    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new SocialError('Não deu para abrir essa imagem.')
    const side = Math.min(img.width, img.height)
    ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size)
    return canvas.toDataURL('image/jpeg', 0.85)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Link para o perfil de alguém (funciona sem conta para quem tem estante pública). */
export function profileLink(publicUrl: string, handle: string): string {
  const base = new URL(publicUrl || DEFAULT_PUBLIC_URL)
  const url = new URL(base.pathname.replace(/\/app\/?$/, '/').replace(/\/?$/, '/') + 'app/', base)
  url.searchParams.set('perfil', handle)
  return url.toString()
}

// ─── Meu perfil, guardado para o botão da conta ──────────────────────

type MineState = { userId: string; profile: Profile | null } | null
let mine: MineState = null
const mineListeners = new Set<() => void>()
let loading: string | null = null

export function setMyProfileCache(userId: string, profile: Profile | null) {
  mine = { userId, profile }
  for (const l of mineListeners) l()
}

export function subscribeMyProfile(cb: () => void) {
  mineListeners.add(cb)
  return () => {
    mineListeners.delete(cb)
  }
}

export const getMyProfileCache = (): MineState => mine

/** Busca meu perfil uma vez por conta (servidor sem social.sql: fica sem perfil, sem erro). */
export async function loadMyProfile(sb: SupabaseClient, userId: string) {
  if (mine?.userId === userId || loading === userId) return
  loading = userId
  try {
    setMyProfileCache(userId, await myProfile(sb, userId))
  } catch {
    setMyProfileCache(userId, null)
  } finally {
    loading = null
  }
}

/** O que a pessoa preencheu ao criar a conta (fica na conta até virar perfil). */
export interface ProfileDraft {
  handle: string
  name: string
  bio: string
}

export function draftFromMetadata(meta: unknown): ProfileDraft | null {
  const m = (meta ?? {}) as Record<string, unknown>
  const handle = typeof m.handle === 'string' ? cleanHandle(m.handle) : ''
  if (!isHandle(handle)) return null
  return { handle, name: typeof m.name === 'string' ? m.name : '', bio: typeof m.bio === 'string' ? m.bio : '' }
}

// ─── "Quero ler" e comentários ───────────────────────────────────────

export interface Reaction {
  owner: string
  book_id: string
  user_id: string
  created_at: string
}

export interface ShelfComment {
  id: string
  owner: string
  book_id: string
  author: string
  body: string
  created_at: string
}

/** Tudo de uma estante: quem quer ler e os comentários de cada livro (só dos livros que a pessoa pode ver). */
export async function shelfActivity(sb: SupabaseClient, ownerId: string): Promise<{ reactions: Reaction[]; comments: ShelfComment[] }> {
  const [r, c] = await Promise.all([
    sb.from('papirus_shelf_reactions').select('owner,book_id,user_id,created_at').eq('owner', ownerId),
    sb.from('papirus_shelf_comments').select('id,owner,book_id,author,body,created_at').eq('owner', ownerId).order('created_at', { ascending: true }),
  ])
  // Servidor sem a parte nova do script: sem "quero ler" e sem comentários, o resto funciona.
  return { reactions: r.error ? [] : ((r.data ?? []) as Reaction[]), comments: c.error ? [] : ((c.data ?? []) as ShelfComment[]) }
}

export async function setWantToRead(sb: SupabaseClient, myId: string, ownerId: string, bookId: string, on: boolean) {
  if (on) check(await sb.from('papirus_shelf_reactions').insert({ owner: ownerId, book_id: bookId, user_id: myId }))
  else check(await sb.from('papirus_shelf_reactions').delete().eq('owner', ownerId).eq('book_id', bookId).eq('user_id', myId))
}

export async function addComment(sb: SupabaseClient, myId: string, ownerId: string, bookId: string, body: string) {
  const text = body.trim().slice(0, 1000)
  if (!text) throw new SocialError('Escreva alguma coisa antes de enviar.')
  check(await sb.from('papirus_shelf_comments').insert({ owner: ownerId, book_id: bookId, author: myId, body: text }))
}

export async function deleteComment(sb: SupabaseClient, id: string) {
  check(await sb.from('papirus_shelf_comments').delete().eq('id', id))
}

// ─── Avisos: o que aconteceu desde a última vez ───────────────────────

export type NoticeKind = 'pedido' | 'comentario' | 'quero-ler' | 'livro-amigo'

export interface Notice {
  kind: NoticeKind
  at: string
  who: Profile
  /** Livro envolvido (comentário, quero ler, livro novo de amigo). */
  book?: { owner: string; id: string; title: string }
  text?: string
}

const seenKey = (userId: string) => `papirus:avisos-vistos:${userId}`

export function noticesSeenAt(userId: string): string {
  try {
    return localStorage.getItem(seenKey(userId)) ?? new Date(0).toISOString()
  } catch {
    return new Date(0).toISOString()
  }
}

export function markNoticesSeen(userId: string) {
  try {
    localStorage.setItem(seenKey(userId), new Date().toISOString())
  } catch {
    // Sem armazenamento: os avisos aparecem de novo na próxima vez.
  }
  setNoticeCount(0)
}

/** Pedidos de amizade, comentários e "quero ler" nos meus livros, e livros novos de amigos (últimos 30 dias). */
export async function loadNotices(sb: SupabaseClient, myId: string): Promise<Notice[]> {
  const since = new Date(Date.now() - 30 * 86400_000).toISOString()
  const friends = await myFriends(sb, myId)
  const friendIds = friends.filter((f) => f.status === 'aceita').map((f) => f.other.user_id)
  const [mine, comments, reactions, friendBooks] = await Promise.all([
    sb.from('papirus_shelf').select('id,title').eq('owner', myId),
    sb.from('papirus_shelf_comments').select('id,owner,book_id,author,body,created_at').eq('owner', myId).gte('created_at', since),
    sb.from('papirus_shelf_reactions').select('owner,book_id,user_id,created_at').eq('owner', myId).gte('created_at', since),
    friendIds.length ? sb.from('papirus_shelf').select('owner,id,title,created_at').in('owner', friendIds).gte('created_at', since) : Promise.resolve({ data: [], error: null }),
  ])
  const titles = new Map(((mine.data ?? []) as { id: string; title: string }[]).map((b) => [b.id, b.title]))
  const cs = ((comments.error ? [] : comments.data) ?? []) as ShelfComment[]
  const rs = ((reactions.error ? [] : reactions.data) ?? []) as Reaction[]
  const fb = ((friendBooks.error ? [] : friendBooks.data) ?? []) as { owner: string; id: string; title: string; created_at: string }[]
  const people = await profilesByIds(sb, [...new Set([...cs.map((c) => c.author), ...rs.map((r) => r.user_id), ...fb.map((b) => b.owner)])].filter((id) => id !== myId))
  const out: Notice[] = []
  for (const f of friends) if (f.status === 'pendente' && !f.outgoing) out.push({ kind: 'pedido', at: new Date().toISOString(), who: f.other })
  for (const c of cs) {
    const who = people.get(c.author)
    if (who) out.push({ kind: 'comentario', at: c.created_at, who, book: { owner: myId, id: c.book_id, title: titles.get(c.book_id) ?? 'seu livro' }, text: c.body })
  }
  for (const r of rs) {
    const who = people.get(r.user_id)
    if (who) out.push({ kind: 'quero-ler', at: r.created_at, who, book: { owner: myId, id: r.book_id, title: titles.get(r.book_id) ?? 'seu livro' } })
  }
  for (const b of fb) {
    const who = people.get(b.owner)
    if (who) out.push({ kind: 'livro-amigo', at: b.created_at, who, book: { owner: b.owner, id: b.id, title: b.title } })
  }
  return out.sort((a, b) => b.at.localeCompare(a.at))
}

/** Quantos avisos novos (pedidos pendentes sempre contam). */
export const unseenCount = (notices: Notice[], seenAt: string) => notices.filter((n) => n.kind === 'pedido' || n.at > seenAt).length

let noticeCount = 0
const noticeListeners = new Set<() => void>()
export function setNoticeCount(n: number) {
  if (n === noticeCount) return
  noticeCount = n
  for (const l of noticeListeners) l()
}
export const getNoticeCount = () => noticeCount
export function subscribeNoticeCount(cb: () => void) {
  noticeListeners.add(cb)
  return () => {
    noticeListeners.delete(cb)
  }
}

// ─── Desafios de escrita ─────────────────────────────────────────────

export interface Challenge {
  id: string
  owner: string
  title: string
  daily_goal: number
  starts_on: string
  ends_on: string
}

export interface ChallengeDay {
  challenge_id: string
  user_id: string
  day: string
  words: number
}

export interface ChallengeBoard {
  challenge: Challenge
  /** Faço parte? */
  joined: boolean
  members: { profile: Profile; today: number; total: number; daysHit: number; streak: number }[]
}

const CHALLENGE_COLS = 'id,owner,title,daily_goal,starts_on,ends_on'

/** Dias entre duas datas (AAAA-MM-DD), contando os dois. */
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400_000) + 1
export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400_000).toISOString().slice(0, 10)

/** Sequência de dias seguidos batendo a meta, terminando hoje (ou ontem, se hoje ainda não bateu). */
export function streakOf(days: Map<string, number>, goal: number, today: string): number {
  let day = (days.get(today) ?? 0) >= goal ? today : addDays(today, -1)
  let n = 0
  while ((days.get(day) ?? 0) >= goal) {
    n++
    day = addDays(day, -1)
  }
  return n
}

/** Desafios que posso ver (meus, de amigos, ou em que estou), com o placar dos que participo. */
export async function challengeBoards(sb: SupabaseClient, myId: string, today: string): Promise<ChallengeBoard[]> {
  const challenges = check(await sb.from('papirus_challenges').select(CHALLENGE_COLS).gte('ends_on', addDays(today, -14)).order('starts_on', { ascending: false })) as Challenge[]
  if (!challenges?.length) return []
  const ids = challenges.map((c) => c.id)
  const [members, days] = await Promise.all([
    sb.from('papirus_challenge_members').select('challenge_id,user_id').in('challenge_id', ids),
    sb.from('papirus_challenge_days').select('challenge_id,user_id,day,words').in('challenge_id', ids),
  ])
  const mem = check(members) as { challenge_id: string; user_id: string }[]
  const ds = check(days) as ChallengeDay[]
  const people = await profilesByIds(sb, [...new Set(mem.map((m) => m.user_id))])
  return challenges.map((c) => {
    const here = mem.filter((m) => m.challenge_id === c.id)
    const rows = here.flatMap((m) => {
      const profile = people.get(m.user_id)
      if (!profile) return []
      const mine = new Map(ds.filter((d) => d.challenge_id === c.id && d.user_id === m.user_id).map((d) => [d.day, d.words]))
      const total = [...mine.values()].reduce((a, b) => a + b, 0)
      return [{ profile, today: mine.get(today) ?? 0, total, daysHit: [...mine.values()].filter((w) => w >= c.daily_goal).length, streak: streakOf(mine, c.daily_goal, today) }]
    })
    rows.sort((a, b) => b.total - a.total || b.today - a.today)
    return { challenge: c, joined: here.some((m) => m.user_id === myId), members: rows }
  })
}

export async function createChallenge(sb: SupabaseClient, myId: string, c: { title: string; daily_goal: number; days: number }, today: string): Promise<string> {
  const title = c.title.trim()
  if (!title) throw new SocialError('Dê um nome ao desafio.')
  const rows = check(
    await sb
      .from('papirus_challenges')
      .insert({ owner: myId, title: title.slice(0, 80), daily_goal: Math.round(c.daily_goal), starts_on: today, ends_on: addDays(today, c.days - 1) })
      .select(CHALLENGE_COLS),
  ) as Challenge[]
  await joinChallenge(sb, myId, rows[0].id)
  return rows[0].id
}

export async function joinChallenge(sb: SupabaseClient, myId: string, challengeId: string) {
  check(await sb.from('papirus_challenge_members').insert({ challenge_id: challengeId, user_id: myId }))
}

export async function leaveChallenge(sb: SupabaseClient, myId: string, challengeId: string) {
  check(await sb.from('papirus_challenge_members').delete().eq('challenge_id', challengeId).eq('user_id', myId))
}

export async function deleteChallenge(sb: SupabaseClient, challengeId: string) {
  check(await sb.from('papirus_challenges').delete().eq('id', challengeId))
}

/** Manda as palavras de hoje para os desafios em andamento de que participo. Devolve em quantos. */
export async function pushChallengeWords(sb: SupabaseClient, myId: string, today: string, words: number): Promise<number> {
  const mine = await sb.from('papirus_challenge_members').select('challenge_id').eq('user_id', myId)
  if (mine.error || !mine.data?.length) return 0
  const ids = (mine.data as { challenge_id: string }[]).map((m) => m.challenge_id)
  const active = (check(await sb.from('papirus_challenges').select(CHALLENGE_COLS).in('id', ids)) as Challenge[]).filter((c) => c.starts_on <= today && c.ends_on >= today)
  if (!active.length) return 0
  check(
    await sb
      .from('papirus_challenge_days')
      .upsert(
        active.map((c) => ({ challenge_id: c.id, user_id: myId, day: today, words })),
        { onConflict: 'challenge_id,user_id,day' },
      ),
  )
  return active.length
}
