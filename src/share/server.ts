import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
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

/** Cliente sem conta (Codex dos jogadores, link de leitura). */
export function anonClient(cfg: ServerConfig): Promise<SupabaseClient> {
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
  const sb = await anonClient(cfg)
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

/**
 * O canal ao vivo de uma mesa (um por Codex): o aviso de que o mestre publicou, as rolagens
 * feitas no celular dos jogadores e o que o mestre conferiu. Não guarda nada: quem está com
 * o Codex aberto recebe na hora, e só. Um canal por aparelho, dividido entre quem usa.
 */
interface Table {
  key: string
  ready: Promise<{ sb: SupabaseClient; channel: RealtimeChannel } | null>
  subscribed: Promise<boolean>
  handlers: Set<(event: string, payload: unknown) => void>
  statuses: Set<(live: boolean) => void>
  live: boolean
  refs: number
  closing?: ReturnType<typeof setTimeout>
}

const tables = new Map<string, Table>()
/** Canais saindo: um canal novo no mesmo tópico espera o antigo sair de vez (o cliente devolveria o velho). */
const leaving = new Map<string, Promise<unknown>>()
const TABLE_EVENTS = ['atualizado', 'rolagem', 'conferida', 'presenca', 'saiu', 'quem', 'aviso'] as const

function openTable(cfg: ServerConfig, id: string): Table {
  const key = `${cfg.url}|${cfg.anonKey}|${id}`
  const found = tables.get(key)
  if (found) {
    clearTimeout(found.closing)
    found.refs++
    return found
  }
  let settle: (ok: boolean) => void = () => {}
  const t: Table = {
    key,
    subscribed: new Promise<boolean>((r) => (settle = r)),
    ready: Promise.resolve(null),
    handlers: new Set(),
    statuses: new Set(),
    live: false,
    refs: 1,
  }
  t.ready = (leaving.get(key) ?? Promise.resolve()).then(() => anonClient(cfg)).then(
    (sb) => {
      const channel = sb.channel(`papirus-codex-${id}`)
      for (const event of TABLE_EVENTS) channel.on('broadcast', { event }, (msg) => t.handlers.forEach((h) => h(event, msg.payload)))
      channel.subscribe((status) => {
        t.live = status === 'SUBSCRIBED'
        if (t.live) settle(true)
        else if (status !== 'CLOSED') settle(false)
        t.statuses.forEach((s) => s(t.live))
      })
      return { sb, channel }
    },
    () => {
      settle(false)
      return null
    },
  )
  tables.set(key, t)
  return t
}

function releaseTable(t: Table) {
  if (--t.refs > 0) return
  // Sai um pouco depois: quem sai e volta logo (uma tela que remonta, um aviso rápido) usa o mesmo canal.
  t.closing = setTimeout(() => {
    if (t.refs > 0) return
    tables.delete(t.key)
    const gone = t.ready.then((r) => r && r.sb.removeChannel(r.channel)).catch(() => undefined)
    leaving.set(t.key, gone)
    void gone.then(() => leaving.get(t.key) === gone && leaving.delete(t.key))
  }, 1500)
}

async function sendOn(t: Table, event: (typeof TABLE_EVENTS)[number], payload: object) {
  // Espera entrar no canal (até 4 s); sem isso, o envio vai pela API e pode não chegar.
  await Promise.race([t.subscribed, new Promise((r) => setTimeout(r, 4000))])
  const r = await t.ready
  if (r) await r.channel.send({ type: 'broadcast', event, payload })
}

/** Rolagem feita no celular de um jogador: vai para o mestre e para os outros celulares. */
export interface TableRoll {
  id: string
  who: string
  /** "Espada longa", "Percepção", "d20". */
  name: string
  kind: 'atributo' | 'pericia' | 'ataque' | 'dano' | 'livre'
  expression: string
  /** O que saiu em cada dado, na ordem da expressão: o mestre refaz a conta com eles. */
  faces: number[]
  physical: boolean
  /** Sistemas "abaixo de": o valor a não passar. */
  target?: number
  critFrom?: number
  /** Em quem (um combatente da iniciativa, pelo nome que o Codex mostra). */
  aim?: { id: string; name: string }
  /** A resposta a um teste que o mestre pediu. */
  request?: string
  total: number
  verdict: string | null
  tone: 'neutro' | 'sucesso' | 'falha' | 'critico' | 'desastre'
  at: string
}

/** O mestre conferiu uma rolagem contra a Defesa do alvo (que os jogadores não veem). */
export interface TableCheck {
  id: string
  verdict: string
  tone: TableRoll['tone']
}

const TONES = ['neutro', 'sucesso', 'falha', 'critico', 'desastre']
const KINDS = ['atributo', 'pericia', 'ataque', 'dano', 'livre']
const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : null)
const int = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && Math.abs(v) < 100_000 ? v : undefined)

/** Confere o que chegou pelo canal: vem de qualquer um com o link, então só passa o que tem a forma certa. */
export function readTableRoll(p: unknown): TableRoll | null {
  if (!p || typeof p !== 'object') return null
  const r = p as Record<string, unknown>
  const id = text(r.id, 64)
  const who = text(r.who, 60)
  const name = text(r.name, 80)
  const expression = text(r.expression, 60)
  const faces = Array.isArray(r.faces) && r.faces.length <= 60 && r.faces.every((f) => int(f) !== undefined) ? (r.faces as number[]) : null
  const total = int(r.total)
  if (!id || !who || !name || !expression || !/^[\dd+\-khl%]+$/i.test(expression) || !faces || total === undefined) return null
  const aim = r.aim && typeof r.aim === 'object' ? (r.aim as Record<string, unknown>) : null
  const aimId = aim && text(aim.id, 64)
  const aimName = aim && text(aim.name, 80)
  return {
    id,
    who,
    name,
    kind: KINDS.includes(r.kind as string) ? (r.kind as TableRoll['kind']) : 'livre',
    expression,
    faces,
    physical: r.physical === true,
    ...(int(r.target) !== undefined ? { target: int(r.target) } : {}),
    ...(int(r.critFrom) !== undefined ? { critFrom: int(r.critFrom) } : {}),
    ...(aimId && aimName ? { aim: { id: aimId, name: aimName } } : {}),
    ...(text(r.request, 64) ? { request: text(r.request, 64)! } : {}),
    total,
    verdict: text(r.verdict, 60),
    tone: TONES.includes(r.tone as string) ? (r.tone as TableRoll['tone']) : 'neutro',
    at: text(r.at, 40) ?? new Date().toISOString(),
  }
}

function readTableCheck(p: unknown): TableCheck | null {
  if (!p || typeof p !== 'object') return null
  const r = p as Record<string, unknown>
  const id = text(r.id, 64)
  const verdict = text(r.verdict, 60)
  if (!id || !verdict) return null
  return { id, verdict, tone: TONES.includes(r.tone as string) ? (r.tone as TableRoll['tone']) : 'neutro' }
}

/** Quem está com a mesa aberta agora: o mestre ou um jogador (com o personagem, se já escolheu). */
export interface TablePresence {
  /** Um por aparelho aberto (some quando ele fecha ou para de avisar). */
  id: string
  role: 'mestre' | 'jogador'
  who: string | null
}

function readPresence(p: unknown): TablePresence | null {
  if (!p || typeof p !== 'object') return null
  const r = p as Record<string, unknown>
  const id = text(r.id, 64)
  if (!id || (r.role !== 'mestre' && r.role !== 'jogador')) return null
  return { id, role: r.role, who: text(r.who, 60) }
}

/** Um aviso do mestre para a mesa ("Um inimigo aparece!"), na hora. */
export interface TableNotice {
  id: string
  at: string
  text: string
  tone: 'aviso' | 'perigo' | 'misterio'
}

export function readNotice(p: unknown): TableNotice | null {
  if (!p || typeof p !== 'object') return null
  const r = p as Record<string, unknown>
  const id = text(r.id, 64)
  const body = text(r.text, 160)
  const at = text(r.at, 40)
  if (!id || !body || !at) return null
  return { id, at, text: body, tone: r.tone === 'perigo' || r.tone === 'misterio' ? r.tone : 'aviso' }
}

/** Entra no canal da mesa. Devolve como enviar e como sair. */
export function joinTable(
  cfg: ServerConfig,
  id: string,
  on: {
    update?: () => void
    roll?: (r: TableRoll) => void
    check?: (c: TableCheck) => void
    status?: (live: boolean) => void
    /** Alguém está (ou continua) na mesa. */
    presence?: (p: TablePresence) => void
    /** Alguém fechou a mesa. */
    left?: (id: string) => void
    /** Alguém chegou e quer saber quem já está: cada um responde com a própria presença. */
    ask?: () => void
    /** O mestre anunciou algo para a mesa. */
    notice?: (n: TableNotice) => void
  } = {},
) {
  const t = openTable(cfg, id)
  const handler = (event: string, payload: unknown) => {
    if (event === 'presenca') {
      const p = readPresence(payload)
      if (p) on.presence?.(p)
    } else if (event === 'saiu') {
      const gone = payload && typeof payload === 'object' ? text((payload as Record<string, unknown>).id, 64) : null
      if (gone) on.left?.(gone)
    } else if (event === 'quem') on.ask?.()
    else if (event === 'aviso') {
      const n = readNotice(payload)
      if (n) on.notice?.(n)
    }
    else if (event === 'atualizado') on.update?.()
    else if (event === 'rolagem') {
      const r = readTableRoll(payload)
      if (r) on.roll?.(r)
    } else if (event === 'conferida') {
      const c = readTableCheck(payload)
      if (c) on.check?.(c)
    }
  }
  t.handlers.add(handler)
  if (on.status) {
    t.statuses.add(on.status)
    on.status(t.live)
  }
  let left = false
  return {
    sendRoll: (r: TableRoll) => sendOn(t, 'rolagem', r),
    sendCheck: (c: TableCheck) => sendOn(t, 'conferida', c),
    ping: () => sendOn(t, 'atualizado', {}),
    sendPresence: (p: TablePresence) => sendOn(t, 'presenca', p),
    sendLeft: (presenceId: string) => sendOn(t, 'saiu', { id: presenceId }),
    ask: () => sendOn(t, 'quem', {}),
    sendNotice: (n: TableNotice) => sendOn(t, 'aviso', n),
    leave: () => {
      if (left) return
      left = true
      t.handlers.delete(handler)
      if (on.status) t.statuses.delete(on.status)
      releaseTable(t)
    },
  }
}

async function ping(cfg: ServerConfig, id: string) {
  const t = joinTable(cfg, id)
  try {
    await t.ping()
  } finally {
    t.leave()
  }
}

/** Escuta avisos de atualização. Devolve a função que para de escutar. */
export function listenCodex(cfg: ServerConfig, id: string, onUpdate: () => void, onStatus?: (live: boolean) => void): () => void {
  return joinTable(cfg, id, { update: onUpdate, status: onStatus }).leave
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
