import type { SupabaseClient } from '@supabase/supabase-js'
import { migrate } from '../model/migrations'
import { CURRENT_SCHEMA_VERSION, type Universe } from '../model/schema'
import { countWords } from '../persistence/repository'
import { anonClient, BUILD_SERVER, DEFAULT_PUBLIC_URL, newShareKey, type ServerConfig } from './server'
import { readerCopy } from './readerCopy'

/**
 * Compartilhar um universo com outras pessoas (script supabase/compartilhar.sql).
 * Quem pode o quê é o servidor que garante (RLS); aqui só pedimos.
 */
export type Role = 'ver' | 'editar'

export const ROLE_LABEL: Record<Role, string> = { ver: 'Pode ver', editar: 'Pode editar' }

export interface Share {
  universe_id: string
  owner_id: string
  owner_email: string
  name: string
  show_secrets: boolean
  link_token: string | null
}

export interface Member {
  email: string
  role: Role
  created_at: string
}

/** Universo de outra pessoa, compartilhado com quem está na conta. */
export interface SharedWithMe {
  owner_id: string
  universe_id: string
  role: Role
  owner_email: string
  name: string
}

export class ShareError extends Error {}

// Avisa a sincronização ao vivo quando o dono liga, muda ou desliga o compartilhamento.
const shareListeners = new Set<() => void>()
export function onShareChanged(fn: () => void): () => void {
  shareListeners.add(fn)
  return () => shareListeners.delete(fn)
}
export const shareChanged = () => {
  for (const fn of shareListeners) fn()
}

const explain = (message: string) =>
  /papirus_(shares|members|share_data|link_get)/.test(message) && /(does not exist|schema cache|not find)/i.test(message)
    ? 'O servidor ainda não sabe compartilhar. Rode o script supabase/compartilhar.sql no SQL Editor do Supabase.'
    : /duplicate key/i.test(message)
      ? 'Essa pessoa já foi convidada.'
      : /Failed to fetch|NetworkError|Load failed/i.test(message)
        ? 'Sem conexão com o servidor.'
        : /row-level security|permission|sem permissão/i.test(message)
          ? 'Você não tem permissão para isso (talvez o acesso tenha sido tirado).'
          : message

function check<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new ShareError(explain(r.error.message))
  return r.data
}

const SHARE_COLS = 'universe_id,owner_id,owner_email,name,show_secrets,link_token'

export const normalizeEmail = (email: string) => email.trim().toLowerCase()
export const isEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
/** Nome curto para avisos: a parte antes do @. */
export const shortName = (email: string) => email.split('@')[0] || email

export async function getShare(sb: SupabaseClient, ownerId: string, universeId: string): Promise<Share | null> {
  return check(await sb.from('papirus_shares').select(SHARE_COLS).eq('owner_id', ownerId).eq('universe_id', universeId).maybeSingle()) as Share | null
}

/** Liga o compartilhamento (o universo precisa já estar na nuvem da conta). */
export async function startSharing(sb: SupabaseClient, ownerId: string, ownerEmail: string, universe: Universe): Promise<Share> {
  check(
    await sb
      .from('papirus_shares')
      .upsert({ owner_id: ownerId, universe_id: universe.id, owner_email: ownerEmail, name: universe.name }, { onConflict: 'owner_id,universe_id', ignoreDuplicates: true }),
  )
  const share = await getShare(sb, ownerId, universe.id)
  if (!share) throw new ShareError('Não foi possível ligar o compartilhamento.')
  await refreshReaderCopy(sb, share, universe)
  return share
}

export async function stopSharing(sb: SupabaseClient, ownerId: string, universeId: string) {
  check(await sb.from('papirus_shares').delete().eq('owner_id', ownerId).eq('universe_id', universeId))
}

export async function updateShare(sb: SupabaseClient, share: Share, changes: Partial<Pick<Share, 'show_secrets' | 'link_token'>>): Promise<Share> {
  check(await sb.from('papirus_shares').update(changes).eq('owner_id', share.owner_id).eq('universe_id', share.universe_id))
  return { ...share, ...changes }
}

export const newLinkToken = () => newShareKey()

export async function listMembers(sb: SupabaseClient, ownerId: string, universeId: string): Promise<Member[]> {
  const rows = check(await sb.from('papirus_members').select('email,role,created_at').eq('owner_id', ownerId).eq('universe_id', universeId)) as Member[]
  return [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at))
}

export async function invite(sb: SupabaseClient, share: Share, email: string, role: Role) {
  check(await sb.from('papirus_members').insert({ owner_id: share.owner_id, universe_id: share.universe_id, email: normalizeEmail(email), role }))
}

export async function setRole(sb: SupabaseClient, share: Share, email: string, role: Role) {
  check(await sb.from('papirus_members').update({ role }).eq('owner_id', share.owner_id).eq('universe_id', share.universe_id).eq('email', email))
}

export async function removeMember(sb: SupabaseClient, ownerId: string, universeId: string, email: string) {
  check(await sb.from('papirus_members').delete().eq('owner_id', ownerId).eq('universe_id', universeId).eq('email', email))
}

/** Universos de outras pessoas compartilhados com esta conta. */
export async function sharedWithMe(sb: SupabaseClient, myId: string, myEmail: string): Promise<SharedWithMe[]> {
  const invites = check(await sb.from('papirus_members').select('owner_id,universe_id,role').eq('email', normalizeEmail(myEmail))) as Pick<SharedWithMe, 'owner_id' | 'universe_id' | 'role'>[]
  const theirs = invites.filter((i) => i.owner_id !== myId)
  if (!theirs.length) return []
  const shares = check(await sb.from('papirus_shares').select('owner_id,universe_id,owner_email,name').in('universe_id', theirs.map((i) => i.universe_id))) as Pick<SharedWithMe, 'owner_id' | 'universe_id' | 'owner_email' | 'name'>[]
  return theirs.flatMap((i) => {
    const s = shares.find((x) => x.owner_id === i.owner_id && x.universe_id === i.universe_id)
    return s ? [{ ...i, owner_email: s.owner_email, name: s.name }] : []
  })
}

/** Ids dos universos desta conta que estão compartilhados. */
export async function mySharedIds(sb: SupabaseClient, myId: string): Promise<Set<string>> {
  const rows = check(await sb.from('papirus_shares').select('universe_id').eq('owner_id', myId)) as { universe_id: string }[]
  return new Set(rows.map((r) => r.universe_id))
}

/** Sair de um universo compartilhado (o convite some; só o dono pode convidar de novo). */
export async function leaveShared(sb: SupabaseClient, item: Pick<SharedWithMe, 'owner_id' | 'universe_id'>, myEmail: string) {
  check(await sb.from('papirus_members').delete().eq('owner_id', item.owner_id).eq('universe_id', item.universe_id).eq('email', normalizeEmail(myEmail)))
}

/** Abre um universo de outra pessoa: inteiro para quem edita, a cópia de leitura para quem só vê. */
export async function openShared(sb: SupabaseClient, item: Pick<SharedWithMe, 'owner_id' | 'universe_id' | 'role'>): Promise<{ universe: Universe; stamp: string }> {
  if (item.role === 'editar') {
    const row = check(await sb.from('papirus_universes').select('data,updated_at').eq('user_id', item.owner_id).eq('id', item.universe_id).maybeSingle()) as { data: unknown; updated_at: string } | null
    if (!row?.data) throw new ShareError('Este universo não está mais disponível.')
    return { universe: migrate(row.data).universe, stamp: row.updated_at }
  }
  const row = check(await sb.from('papirus_shares').select('data,updated_at').eq('owner_id', item.owner_id).eq('universe_id', item.universe_id).maybeSingle()) as { data: unknown; updated_at: string } | null
  if (!row?.data) throw new ShareError('Este universo não está mais disponível.')
  return { universe: migrate(row.data).universe, stamp: row.updated_at }
}

/** Só a data da última mudança (para saber se precisa baixar). */
export async function sharedStamp(sb: SupabaseClient, item: Pick<SharedWithMe, 'owner_id' | 'universe_id' | 'role'>): Promise<string | null> {
  const table = item.role === 'editar' ? 'papirus_universes' : 'papirus_shares'
  const r = check(
    await sb
      .from(table)
      .select('updated_at')
      .eq(item.role === 'editar' ? 'user_id' : 'owner_id', item.owner_id)
      .eq(item.role === 'editar' ? 'id' : 'universe_id', item.universe_id)
      .maybeSingle(),
  ) as { updated_at: string } | null
  return r?.updated_at ?? null
}

/**
 * Grava o universo de outra pessoa, só se ninguém gravou desde `stamp`.
 * Devolve `false` se alguém gravou antes (é preciso juntar as mudanças primeiro).
 */
export async function saveShared(sb: SupabaseClient, ownerId: string, universe: Universe, stamp: string): Promise<boolean> {
  const rows = check(
    await sb
      .from('papirus_universes')
      .update({
        name: universe.name,
        words: countWords(universe),
        data: { schemaVersion: CURRENT_SCHEMA_VERSION, revision: 0, universe },
        updated_at: universe.updatedAt,
      })
      .eq('user_id', ownerId)
      .eq('id', universe.id)
      .eq('updated_at', stamp)
      .select('id'),
  ) as unknown[]
  return rows.length > 0
}

/** Atualiza a cópia de leitura (quem só vê e o link recebem esta). */
export async function refreshReaderCopy(sb: SupabaseClient, share: Pick<Share, 'owner_id' | 'universe_id' | 'show_secrets'>, universe: Universe) {
  check(
    await sb.rpc('papirus_share_data', {
      o: share.owner_id,
      u: share.universe_id,
      d: { schemaVersion: CURRENT_SCHEMA_VERSION, revision: 0, universe: readerCopy(universe, share.show_secrets) },
      n: universe.name,
    }),
  )
}

/** Lê pelo link, sem conta. */
export async function fetchByLink(server: ServerConfig, token: string): Promise<{ universe: Universe; stamp: string; ownerEmail: string } | null> {
  const sb = await anonClient(server)
  const rows = check(await sb.rpc('papirus_link_get', { token })) as { data: unknown; updated_at: string; owner_email: string }[]
  const row = rows?.[0]
  if (!row?.data) return null
  return { universe: migrate(row.data).universe, stamp: row.updated_at, ownerEmail: row.owner_email }
}

const toB64Url = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromB64Url = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))))

/** Como o link abre: o livro com o caderno sem spoiler, ou o universo inteiro (só leitura). */
export type LinkMode = 'livro' | 'universo'

/** Link de leitura. Só leva o servidor quando ele não é o da publicação. */
export function readLink(publicUrl: string, cfg: ServerConfig, token: string, mode: LinkMode = 'livro'): string {
  const base = new URL(publicUrl || DEFAULT_PUBLIC_URL)
  const url = new URL(base.pathname.replace(/\/app\/?$/, '/').replace(/\/?$/, '/') + 'app/', base)
  url.searchParams.set('ler', token)
  if (mode === 'livro') url.searchParams.set('modo', 'livro')
  const same = BUILD_SERVER && BUILD_SERVER.url === cfg.url && BUILD_SERVER.anonKey === cfg.anonKey
  if (!same) url.searchParams.set('srv', toB64Url(JSON.stringify([cfg.url.trim(), cfg.anonKey.trim()])))
  return url.toString()
}

export function parseReadLink(search: string): { token: string; server: ServerConfig | null; mode: LinkMode } | null {
  const params = new URLSearchParams(search)
  const token = params.get('ler')
  if (!token || !/^[0-9a-f]{32,}$/i.test(token)) return null
  const mode: LinkMode = params.get('modo') === 'livro' ? 'livro' : 'universo'
  const srv = params.get('srv')
  if (srv) {
    try {
      const [url, anonKey] = JSON.parse(fromB64Url(srv)) as [string, string]
      if (typeof url === 'string' && typeof anonKey === 'string') return { token, server: { url, anonKey }, mode }
    } catch {
      return { token, server: null, mode }
    }
  }
  return { token, server: BUILD_SERVER, mode }
}
