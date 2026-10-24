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
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'papirus-conta' },
    })
    sb.auth.onAuthStateChange((_event, session) => {
      emit({ user: session?.user ? { id: session.user.id, email: session.user.email } : null, loading: false })
    })
    return sb
  })
  current = { key, client }
  return client
}

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

export const sendMagicLink = (server: ServerConfig, email: string) => run(server, (sb) => sb.auth.signInWithOtp({ email, options: { emailRedirectTo: back() } }))

export const sendPasswordReset = (server: ServerConfig, email: string) => run(server, (sb) => sb.auth.resetPasswordForEmail(email, { redirectTo: back() }))

export async function signOut(server: ServerConfig) {
  const sb = await authClient(server)
  await sb.auth.signOut()
  emit({ user: null })
}
