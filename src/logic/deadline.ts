import type { Universe } from '../model/schema'
import { countWords } from '../persistence/repository'
import { todayKey } from './stats'

export interface DeadlinePlan {
  target: number
  date: string
  total: number
  left: number
  /** Dias até o prazo, contando hoje. */
  daysLeft: number
  /** Palavras por dia para chegar lá (conta do começo de hoje, para não mudar a cada tecla). */
  perDay: number
  done: boolean
  late: boolean
}

const dayMs = 86_400_000
const dayNumber = (key: string) => Math.round(Date.parse(`${key}T12:00:00Z`) / dayMs)

/** A conta da meta com prazo: quanto falta e quantas palavras por dia. */
export function deadlinePlan(universe: Universe, now = new Date()): DeadlinePlan | null {
  const d = universe.settings.deadline
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return null
  const today = todayKey(now)
  const total = countWords(universe)
  const startOfToday = universe.dailyStart[today] ?? total
  const daysLeft = dayNumber(d.date) - dayNumber(today) + 1
  const left = Math.max(0, d.words - total)
  const done = left === 0
  const late = !done && daysLeft < 1
  const perDay = done || late ? 0 : Math.ceil(Math.max(0, d.words - startOfToday) / daysLeft)
  return { target: d.words, date: d.date, total, left, daysLeft: Math.max(0, daysLeft), perDay, done, late }
}
