import type { SupabaseClient } from '@supabase/supabase-js'
import type { CodexSnapshot } from './snapshot'

/** Servidor do Codex ao vivo: um projeto Supabase com o script `supabase/codex.sql`. */
export interface ServerConfig {
  url: string
  anonKey: string
}

/** Endereço público padrão do Papirus (GitHub Pages do repositório). */
export const DEFAULT_PUBLIC_URL: string = import.meta.env.VITE_PAPIRUS_PUBLIC_URL || 'https://allanpobre.github.io/papirus/'

/** Servidor configurado na publicação do Papirus, se houver. O mestre pode trocar em Ajustes. */
export const BUILD_SERVER: ServerConfig | null =
  import.meta.env.VITE_PAPIRUS_SUPABASE_URL && import.meta.env.VITE_PAPIRUS_SUPABASE_KEY
    ? { url: import.meta.env.VITE_PAPIRUS_SUPABASE_URL, anonKey: import.meta.env.VITE_PAPIRUS_SUPABASE_KEY }
    : null

export const isConfigured = (c: ServerConfig | null | undefined): c is ServerConfig => Boolean(c?.url.trim() && c.anonKey.trim())

const clients = new Map<string, Promise<SupabaseClient>>()

function client(cfg: ServerConfig): Promise<SupabaseClient> {
  const k = `${cfg.url}|${cfg.anonKey}`
  let c = clients.get(k)
  if (!c) {
    c = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(cfg.url.trim().replace(/\/+$/, ''), cfg.anonKey.trim(), { auth: { persistSession: false, autoRefreshToken: false } }),
    )
    clients.set(k, c)
  }
  return c
}

export class ServerError extends Error {}

const explain = (message: string): string => {
  if (/codex_(put|get|delete)/.test(message) && /(not find|does not exist|schema cache)/i.test(message)) return 'O servidor ainda não tem as funções do Papirus. Rode o script supabase/codex.sql no SQL Editor do Supabase.'
  if (/chave errada/.test(message)) return 'Este Codex foi criado com outra chave. Pare de compartilhar e comece de novo.'
  if (/Invalid API key|JWT/i.test(message)) return 'A chave pública (anon key) não confere com este projeto.'
  if (/Failed to fetch|NetworkError|Load failed/i.test(message)) return 'Sem conexão com o servidor. Confira o endereço e a internet.'
  return message
}

async function rpc<T>(cfg: ServerConfig, fn: string, args: Record<string, unknown>): Promise<T> {
  const sb = await client(cfg)
  const { data, error } = await sb.rpc(fn, args)
  if (error) throw new ServerError(explain(error.message))
  return data as T
}

export async function publishCodex(cfg: ServerConfig, id: string, key: string, snapshot: CodexSnapshot): Promise<string> {
  const stamp = await rpc<string>(cfg, 'codex_put', { codex_id: id, codex_key: key, codex_data: snapshot })
  // Avisa quem está com o Codex aberto. Se o aviso falhar, os jogadores ainda recebem pela checagem periódica.
  void ping(cfg, id).catch(() => undefined)
  return stamp
}

export async function fetchCodex(cfg: ServerConfig, id: string): Promise<{ data: CodexSnapshot; updatedAt: string } | null> {
  const rows = await rpc<{ data: CodexSnapshot; updated_at: string }[]>(cfg, 'codex_get', { codex_id: id })
  const row = rows?.[0]
  return row ? { data: row.data, updatedAt: row.updated_at } : null
}

export async function deleteCodex(cfg: ServerConfig, id: string, key: string): Promise<void> {
  await rpc(cfg, 'codex_delete', { codex_id: id, codex_key: key })
  void ping(cfg, id).catch(() => undefined)
}

/** Testa o servidor: lê um Codex que não existe. Dá erro se o script não foi rodado. */
export async function testServer(cfg: ServerConfig): Promise<void> {
  await fetchCodex(cfg, '00000000-0000-0000-0000-000000000000')
}

async function ping(cfg: ServerConfig, id: string) {
  const sb = await client(cfg)
  const channel = sb.channel(`papirus-codex-${id}`)
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 4000)
    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED') return
      void channel.send({ type: 'broadcast', event: 'atualizado', payload: {} }).finally(() => {
        clearTimeout(timer)
        resolve()
      })
    })
  })
  void sb.removeChannel(channel)
}

/** Escuta avisos de atualização. Devolve a função que para de escutar. */
export function listenCodex(cfg: ServerConfig, id: string, onUpdate: () => void, onStatus?: (live: boolean) => void): () => void {
  let stop = () => {}
  let stopped = false
  void client(cfg).then((sb) => {
    if (stopped) return
    const channel = sb
      .channel(`papirus-codex-${id}`)
      .on('broadcast', { event: 'atualizado' }, () => onUpdate())
      .subscribe((status) => onStatus?.(status === 'SUBSCRIBED'))
    stop = () => void sb.removeChannel(channel)
  })
  return () => {
    stopped = true
    stop()
  }
}

/** Chave secreta nova (só fica com o mestre). */
export function newShareKey(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

const toB64Url = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromB64Url = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))))

/** Link dos jogadores. Só leva o servidor quando ele não é o da publicação. */
export function playerLink(publicUrl: string, cfg: ServerConfig, id: string): string {
  // O app fica em /app/ do endereço público; a apresentação fica na raiz.
  const base = new URL(publicUrl || DEFAULT_PUBLIC_URL)
  const url = new URL(base.pathname.replace(/\/app\/?$/, '/').replace(/\/?$/, '/') + 'app/', base)
  url.searchParams.set('mesa', id)
  const same = BUILD_SERVER && BUILD_SERVER.url === cfg.url && BUILD_SERVER.anonKey === cfg.anonKey
  if (!same) url.searchParams.set('srv', toB64Url(JSON.stringify([cfg.url.trim(), cfg.anonKey.trim()])))
  return url.toString()
}

/** Lê o link dos jogadores, se a página foi aberta por um. */
export function readPlayerLink(search: string): { id: string; server: ServerConfig | null } | null {
  const params = new URLSearchParams(search)
  const id = params.get('mesa')
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null
  const srv = params.get('srv')
  if (srv) {
    try {
      const [url, anonKey] = JSON.parse(fromB64Url(srv)) as [string, string]
      if (typeof url === 'string' && typeof anonKey === 'string') return { id, server: { url, anonKey } }
    } catch {
      return { id, server: null }
    }
  }
  return { id, server: BUILD_SERVER }
}
