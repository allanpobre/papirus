import type { SupabaseClient } from '@supabase/supabase-js'
import { todayKey } from '../logic/stats'
import type { Treino } from './treino'

/**
 * O placar dos treinos (função papirus_placar_treinos, de supabase/treinos.sql): só números,
 * nunca o texto. Pontos = minutos de treino com o mínimo batido, até 60 por dia.
 */
export type PlacarEscopo = 'amigos' | 'todos'
export type PlacarPeriodo = 'semana' | 'mes'
/** Quem vê os pontos de alguém. */
export type PlacarVisibilidade = 'ninguem' | 'amigos' | 'todos'

export interface PlacarRow {
  posicao: number
  user_id: string
  handle: string
  name: string
  pontos: number
  dias: number
  treinos: number
  palavras: number
}

/** O primeiro dia do período: segunda-feira desta semana, ou o dia 1 deste mês. */
export function periodStart(p: PlacarPeriodo, today = new Date()): string {
  const d = new Date(today.getFullYear(), today.getMonth(), p === 'mes' ? 1 : today.getDate())
  if (p === 'semana') d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return todayKey(d)
}

/** Mesma regra do servidor, para mostrar os pontos de quem ainda não tem conta (ou antes de subir). */
export function localPoints(list: Treino[], since: string, today = todayKey()): number {
  const days = new Map<string, number>()
  for (const t of list) {
    if (t.day < since || t.day > today || !t.done || t.seconds < 60 || t.words * 60 > t.seconds * 150) continue
    if (t.minutes > 0 && t.seconds > t.minutes * 60 + 5) continue
    const pts = t.minutes > 0 ? t.minutes : Math.floor(t.seconds / 60)
    days.set(t.day, Math.min(60, (days.get(t.day) ?? 0) + pts))
  }
  return [...days.values()].reduce((a, b) => a + b, 0)
}

export class PlacarError extends Error {}

const explain = (message: string) =>
  /papirus_placar_treinos|function .* does not exist|schema cache|column .*placar/i.test(message)
    ? 'O servidor ainda não tem o placar. Rode o script supabase/treinos.sql no SQL Editor do Supabase.'
    : /Failed to fetch|NetworkError|Load failed/i.test(message)
      ? 'Sem conexão com o servidor.'
      : message

export async function loadPlacar(sb: SupabaseClient, escopo: PlacarEscopo, desde: string): Promise<PlacarRow[]> {
  const { data, error } = await sb.rpc('papirus_placar_treinos', { escopo, desde })
  if (error) throw new PlacarError(explain(error.message))
  return (data ?? []) as PlacarRow[]
}

/** Quem vê os meus pontos (`null` = ainda sem perfil, então ninguém vê). */
export async function myPlacarSetting(sb: SupabaseClient, userId: string): Promise<PlacarVisibilidade | null> {
  const { data, error } = await sb.from('papirus_profiles').select('placar').eq('user_id', userId).maybeSingle()
  if (error) throw new PlacarError(explain(error.message))
  return data ? ((data as { placar?: PlacarVisibilidade }).placar ?? 'amigos') : null
}

export async function setPlacarSetting(sb: SupabaseClient, userId: string, placar: PlacarVisibilidade) {
  const { error } = await sb.from('papirus_profiles').update({ placar }).eq('user_id', userId)
  if (error) throw new PlacarError(explain(error.message))
}
