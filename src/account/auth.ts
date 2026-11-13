import type { SupabaseClient, User } from '@supabase/supabase-js'
import { useSyncExternalStore } from 'react'
import { BUILD_SERVER, isConfigured, type ServerConfig } from '../share/server'
import type { Prefs } from '../state/prefs'

/**
 * Conta opcional. Sem conta, tudo funciona neste navegador como sempre. Com conta,
 * os universos também ficam no servidor (Supabase) e aparecem nos outros aparelhos.
 */
export interface AccountState {
  /** Ainda verificando se há uma sessão salva. */
  loading: boolean
  user: Pick<User, 'id' | 'email'> | null
  server: ServerConfig | null
  /** Veio do link "Esqueci a senha": falta escolher a senha nova. */
  recovering?: boolean
  /** O link do e-mail não funcionou (venceu, já foi usado…): o motivo, em português. */
  linkProblem?: string | null
  /** Aviso curto depois de um link do e-mail ("Você entrou como…", "Senha nova salva"). */
  welcome?: string | null
}

let state: AccountState = { loading: false, user: null, server: null }
const listeners = new Set<() => void>()
const emit = (next: Partial<AccountState>) => {
  state = { ...state, ...next }
  for (const l of listeners) l()
}

export function useAccount(): AccountState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
  )
}

export const accountServer = (prefs: Prefs): ServerConfig | null => (isConfigured(prefs.server) ? prefs.server : BUILD_SERVER)

let current: { key: string; client: Promise<SupabaseClient> } | null = null

/** Cliente com sessão guardada neste navegador (diferente do cliente anônimo do Codex). */
export function authClient(server: ServerConfig): Promise<SupabaseClient> {
  const key = `${server.url}|${server.anonKey}`
  if (current?.key === key) return current.client
  const client = import('@supabase/supabase-js').then(({ createClient }) => {
    const sb = createClient(server.url.trim().replace(/\/+$/, ''), server.anonKey.trim(), {
      // O retorno dos links de e-mail é lido por nós (captureAuthLink), para saber se é troca de senha e mostrar os erros.
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'papirus-conta' },
    })
    sb.auth.onAuthStateChange((_event, session) => {
      emit({ user: session?.user ? { id: session.user.id, email: session.user.email } : null, loading: false })
    })
    return sb
  })
  current = { key, client }
  return client
}

// ─── Volta dos links de e-mail (entrar sem senha, confirmar conta, trocar a senha) ───

export interface AuthLink {
  tokens?: { access_token: string; refresh_token: string }
  /** magiclink, signup, recovery, invite, email_change… */
  type?: string
  problem?: string
}

const LINK_KEYS = ['access_token', 'refresh_token', 'expires_in', 'expires_at', 'token_type', 'type', 'provider_token', 'provider_refresh_token', 'error', 'error_code', 'error_description', 'sb']

const linkProblem = (code: string, description: string) =>
  /otp_expired|expired|invalid/i.test(`${code} ${description}`)
    ? 'Este link venceu ou já foi usado. Cada link vale uma vez só e por pouco tempo: peça outro.'
    : `O link do e-mail não funcionou (${description || code}). Peça outro.`

/** Lê o retorno de um link de e-mail no endereço (no # ou no ?). Sem retorno, null. */
export function readAuthLink(href: string): AuthLink | null {
  const url = new URL(href)
  const params = new URLSearchParams(url.hash.replace(/^#/, ''))
  for (const [k, v] of url.searchParams) if (!params.has(k) && (k.startsWith('error') || k === 'type')) params.set(k, v)
  const code = params.get('error_code') ?? params.get('error') ?? ''
  const description = (params.get('error_description') ?? '').replace(/\+/g, ' ')
  if (code || description) return { problem: linkProblem(code, description), type: params.get('type') ?? undefined }
  const access_token = params.get('access_token')
  const refresh_token = params.get('refresh_token')
  if (access_token && refresh_token) return { tokens: { access_token, refresh_token }, type: params.get('type') ?? undefined }
  return null
}

/** O endereço sem o retorno do link (as chaves não ficam no histórico nem em quem copiar o link). */
export function withoutAuthLink(href: string): string {
  const url = new URL(href)
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
  if (LINK_KEYS.some((k) => hash.has(k))) url.hash = ''
  for (const k of LINK_KEYS) url.searchParams.delete(k)
  return url.pathname + url.search + url.hash
}

let pendingLink: AuthLink | null = null

/** Guarda o retorno do link (se houver) e limpa o endereço. */
function takeLink(): boolean {
  const link = readAuthLink(location.href)
  if (!link) return false
  try {
    history.replaceState(history.state, '', withoutAuthLink(location.href))
  } catch {
    // Numa moldura que não deixa mexer no endereço: só não limpa.
  }
  if (link.problem) emit({ linkProblem: link.problem })
  else pendingLink = link
  return true
}

/**
 * Na abertura do app: guarda o retorno do link e limpa o endereço. Quem entra é o startAccount.
 * Com o app já aberto (no Android, o link pode cair no app instalado só trocando o #), entra na hora.
 */
export function captureAuthLink() {
  if (typeof location === 'undefined') return
  takeLink()
  addEventListener('hashchange', () => {
    if (takeLink() && pendingLink && state.server) void authClient(state.server).then(applyLink)
  })
}

/** Entra com as chaves do link. Devolve true se entrou. */
async function applyLink(sb: SupabaseClient): Promise<boolean> {
  const link = pendingLink
  pendingLink = null
  if (!link?.tokens) return false
  const { data, error } = await sb.auth.setSession(link.tokens)
  const u = data.session?.user
  if (error || !u) {
    emit({ linkProblem: error ? linkProblem(error.message, error.message) : linkProblem('', ''), loading: false })
    return false
  }
  const recovering = link.type === 'recovery'
  emit({ user: { id: u.id, email: u.email }, loading: false, recovering, welcome: recovering ? null : `Você entrou${u.email ? ` como ${u.email}` : ''}.` })
  return true
}

/** Fecha o aviso do link (o erro ou o "você entrou"). */
export const dismissLinkNotice = () => emit({ linkProblem: null, welcome: null })

/** Liga a conta ao servidor configurado. Chame quando o servidor mudar. */
export async function startAccount(server: ServerConfig | null) {
  if (!server) {
    emit({ server: null, user: null, loading: false })
    return
  }
  if (state.server?.url === server.url && state.server.anonKey === server.anonKey) return
  emit({ server, loading: true })
  try {
    const sb = await authClient(server)
    if (await applyLink(sb)) return
    const { data } = await sb.auth.getSession()
    const u = data.session?.user
    emit({ user: u ? { id: u.id, email: u.email } : null, loading: false })
  } catch {
    emit({ user: null, loading: false })
  }
}

export class AuthError extends Error {}

const explain = (message: string): string => {
  if (/Invalid login credentials/i.test(message)) return 'E-mail ou senha não conferem.'
  if (/Email not confirmed/i.test(message)) return 'Confirme o e-mail primeiro: abra o link que chegou na sua caixa de entrada.'
  if (/already registered|already been registered/i.test(message)) return 'Já existe uma conta com este e-mail. Use "Entrar".'
  if (/Password should be at least/i.test(message)) return 'A senha precisa ter pelo menos 6 caracteres.'
  if (/Signups not allowed for otp/i.test(message)) return 'Não há conta com este e-mail. Para começar, use "Criar conta".'
  const wait = /only request this after (\d+) seconds?/i.exec(message)
  if (wait) return `Espere ${wait[1]} segundos para pedir outro e-mail.`
  if (/email rate limit/i.test(message)) return 'O servidor já mandou todos os e-mails que podia nesta hora (o plano grátis do Supabase manda poucos). Tente mais tarde, ou entre com a senha.'
  if (/New password should be different/i.test(message)) return 'A senha nova precisa ser diferente da antiga.'
  if (/rate limit|too many/i.test(message)) return 'Muitas tentativas seguidas. Espere um minuto e tente de novo.'
  if (/Unable to validate email|invalid email/i.test(message)) return 'Este e-mail não parece válido.'
  if (/Failed to fetch|NetworkError|Load failed/i.test(message)) return 'Sem conexão com o servidor. Confira a internet e o endereço do servidor.'
  return message
}

async function run<R extends { data: unknown; error: { message: string } | null }>(server: ServerConfig, fn: (sb: SupabaseClient) => Promise<R>): Promise<R['data']> {
  const sb = await authClient(server)
  const { data, error } = await fn(sb)
  if (error) throw new AuthError(explain(error.message))
  return data
}

/** Endereço para onde os links de e-mail voltam: esta mesma página, sem parâmetros. */
const back = () => location.origin + location.pathname

export const signIn = (server: ServerConfig, email: string, password: string) => run(server, (sb) => sb.auth.signInWithPassword({ email, password }))

/** Cria a conta. Devolve `true` se o servidor pede confirmação por e-mail antes de entrar. */
export async function signUp(server: ServerConfig, email: string, password: string, profile?: { handle: string; name: string; bio: string }): Promise<boolean> {
  // O perfil vai junto na conta e vira perfil de verdade no primeiro acesso (sem foto: é pequeno de propósito).
  const data = await run(server, (sb) => sb.auth.signUp({ email, password, options: { emailRedirectTo: back(), data: profile } }))
  return !data.session
}

// Só entra quem já tem conta: um e-mail com erro de digitação não vira conta nova sem perfil.
export const sendMagicLink = (server: ServerConfig, email: string) => run(server, (sb) => sb.auth.signInWithOtp({ email, options: { emailRedirectTo: back(), shouldCreateUser: false } }))

export const sendPasswordReset = (server: ServerConfig, email: string) => run(server, (sb) => sb.auth.resetPasswordForEmail(email, { redirectTo: back() }))

/** A senha nova, depois do link "Esqueci a senha" (ou trocando com a conta aberta). */
export async function updatePassword(server: ServerConfig, password: string) {
  if (password.length < 6) throw new AuthError('A senha precisa ter pelo menos 6 caracteres.')
  await run(server, (sb) => sb.auth.updateUser({ password }))
  emit({ recovering: false, welcome: 'Senha nova salva. Da próxima vez, entre com ela.' })
}

/** "Agora não" na senha nova: segue com a conta aberta. */
export const skipRecovery = () => emit({ recovering: false })

export async function signOut(server: ServerConfig) {
  const sb = await authClient(server)
  await sb.auth.signOut()
  emit({ user: null })
}
