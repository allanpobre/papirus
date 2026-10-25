import type { SupabaseClient } from '@supabase/supabase-js'
import { todayKey } from '../logic/stats'
import { streakDays, todayTotal } from './dailyWords'

/** O que os amigos andam fazendo (script supabase/social.sql). Cada um registra o próprio. */
export interface Activity {
  id: string
  actor: string
  kind: 'capitulos' | 'meta' | 'sequencia'
  book_id: string | null
  title: string
  n: number
  created_at: string
}

export async function friendsActivity(sb: SupabaseClient, ids: string[], since: string): Promise<Activity[]> {
  if (!ids.length) return []
  const { data, error } = await sb.from('papirus_activity').select('id,actor,kind,book_id,title,n,created_at').in('actor', ids).gte('created_at', since).order('created_at', { ascending: false }).limit(200)
  // Servidor sem a parte nova do script: sem atividade, o resto funciona.
  return error ? [] : ((data ?? []) as Activity[])
}

const MILESTONES = [3, 7, 14, 30, 60, 100]
const postedKey = (userId: string) => `papirus:progresso-contado:${userId}`

function posted(userId: string): { meta?: string; streak?: number; streakDay?: string } {
  try {
    return JSON.parse(localStorage.getItem(postedKey(userId)) ?? '{}')
  } catch {
    return {}
  }
}

/** Já bateu a meta hoje e ainda não contou aos amigos? (sem rede: só olha este aparelho) */
export function progressToShare(userId: string, goal: number): boolean {
  return goal > 0 && todayTotal() >= goal && posted(userId).meta !== todayKey()
}

/** Conta aos amigos: meta do dia batida e, em marcos (3, 7, 14, 30… dias), a sequência. */
export async function shareProgress(sb: SupabaseClient, userId: string, goal: number) {
  if (!progressToShare(userId, goal)) return
  const today = todayKey()
  const p = posted(userId)
  const streak = streakDays(goal, today)
  const rows: Omit<Activity, 'id' | 'actor' | 'created_at'>[] = [{ kind: 'meta', book_id: null, title: '', n: todayTotal() }]
  if (MILESTONES.includes(streak) && p.streakDay !== today) rows.push({ kind: 'sequencia', book_id: null, title: '', n: streak })
  const { error } = await sb.from('papirus_activity').insert(rows)
  if (error) return
  try {
    localStorage.setItem(postedKey(userId), JSON.stringify({ meta: today, streak, streakDay: rows.length > 1 ? today : p.streakDay }))
  } catch {
    // Sem armazenamento: pode contar de novo amanhã.
  }
}
