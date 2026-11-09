import type { Universe } from '../model/schema'
import { countWords } from '../persistence/repository'
import type { View } from '../state/workspace'
import { deadlinePlan } from './deadline'
import { currentStreak, todayKey, wordsByDay } from './stats'

/*
 * As contas do Início: o dia (palavras, meta, a semana), o bilhete para amanhã e o mundo numa
 * linha. Nada aqui cobra: a sequência mostra a semana e, depois de um dia sem escrever, diz que
 * hoje conta ("nunca falhe duas vezes", James Clear).
 */

export type NextNote = NonNullable<Universe['settings']['nextNote']>

/** Guarda (ou apaga, com texto vazio) o bilhete para amanhã, ligado à cena em que foi escrito. */
export function setNextNote(u: Universe, text: string, sceneId: string | null, now = new Date()): Universe {
  const clean = text.replace(/\s+/g, ' ').trim().slice(0, 280)
  return { ...u, settings: { ...u.settings, nextNote: clean ? { text: clean, sceneId, at: now.toISOString() } : null } }
}

/** O bilhete, se houver; se a cena dele foi apagada, ele fica solto (sem cena). */
export function nextNoteOf(u: Universe): NextNote | null {
  const n = u.settings.nextNote
  if (!n?.text.trim()) return null
  return n.sceneId && !u.scenes.some((s) => s.id === n.sceneId) ? { ...n, sceneId: null } : n
}

const plural = (n: number, one: string, many: string) => `${n.toLocaleString('pt-BR')} ${n === 1 ? one : many}`

/**
 * A meta de hoje: a do dia, se houver; senão, a que sai do prazo do livro (como no Dabble),
 * calculada do começo do dia, para não mudar a cada tecla.
 */
export function todayTarget(u: Universe, now = new Date()): { target: number; until: string | null } {
  const goal = u.settings.dailyWordGoal
  if (goal > 0) return { target: goal, until: null }
  const plan = deadlinePlan(u, now)
  if (plan && !plan.done && !plan.late && plan.perDay > 0) return { target: plan.perDay, until: plan.date }
  return { target: 0, until: null }
}

const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })

/** Os últimos sete dias, terminando hoje: escreveu ou não. */
export function weekDots(u: Universe, now = new Date()) {
  const today = todayKey(now)
  return wordsByDay(u, 7, now).map((d) => ({
    ...d,
    today: d.day === today,
    label: weekday.format(new Date(`${d.day}T12:00`)).replace('.', ''),
  }))
}

/**
 * A frase da sequência: dias seguidos; depois de um dia sem escrever (para quem escreveu nas
 * últimas semanas), "Ontem não deu? Hoje conta."; sem dia de escrita registrado, nada.
 */
export function streakLine(u: Universe, now = new Date()): { streak: number; text: string } | null {
  const days = wordsByDay(u, 120, now)
  const streak = currentStreak(days)
  if (streak > 0) return { streak, text: plural(streak, 'dia seguido', 'dias seguidos') }
  return days.some((d) => d.words > 0) ? { streak: 0, text: 'Ontem não deu? Hoje conta.' } : null
}

/** O mundo numa linha: só o que já tem alguma coisa, cada número levando ao lugar. */
export function worldCounts(u: Universe, hidden: View[] = [], withMesa = false): { view: View; text: string }[] {
  const openSeeds = u.seeds.filter((s) => s.status !== 'resolvida' && s.status !== 'abandonada').length
  const scenes = u.scenes.filter((s) => s.text.trim()).length
  const words = countWords(u)
  const items: [View, number, string][] = [
    ['fichas', u.entities.length, plural(u.entities.length, 'ficha', 'fichas')],
    ['atlas', u.maps.length, plural(u.maps.length, 'mapa', 'mapas')],
    ['timeline', u.events.length, plural(u.events.length, 'evento', 'eventos')],
    ['relacoes', u.relations.length, plural(u.relations.length, 'ligação', 'ligações')],
    ['tramas', openSeeds, plural(openSeeds, 'pista em aberto', 'pistas em aberto')],
    ['rpg', withMesa ? u.sessions.length : 0, plural(u.sessions.length, 'sessão', 'sessões')],
    ['livro', words, `${plural(scenes, 'cena', 'cenas')}, ${plural(words, 'palavra', 'palavras')}`],
  ]
  return items.filter(([v, n]) => n > 0 && !hidden.includes(v)).map(([view, , text]) => ({ view, text }))
}
