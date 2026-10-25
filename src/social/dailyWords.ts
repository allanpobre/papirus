import { todayKey } from '../logic/stats'

/**
 * Palavras escritas hoje, somando todos os universos deste aparelho. Cada universo
 * anota o seu total do dia quando muda; os desafios usam a soma.
 */
const KEY = 'papirus:palavras-do-dia'

interface Stored {
  day: string
  byUniverse: Record<string, number>
}

// Totais dos dias anteriores (até 120 dias), para contar dias seguidos escrevendo.
const HISTORY = 'papirus:palavras-por-dia'

export function wordsHistory(): Record<string, number> {
  try {
    return (JSON.parse(localStorage.getItem(HISTORY) ?? '{}') as Record<string, number>) ?? {}
  } catch {
    return {}
  }
}

function read(): Stored {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Stored | null
    if (s && s.day === todayKey()) return s
  } catch {
    // Ilegível: começa o dia do zero.
  }
  return { day: todayKey(), byUniverse: {} }
}

export function recordToday(universeId: string, words: number) {
  const s = read()
  if (s.byUniverse[universeId] === words) return
  s.byUniverse[universeId] = Math.max(0, words)
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
    const h = wordsHistory()
    h[s.day] = Object.values(s.byUniverse).reduce((a, b) => a + b, 0)
    const days = Object.keys(h).sort()
    for (const d of days.slice(0, Math.max(0, days.length - 120))) delete h[d]
    localStorage.setItem(HISTORY, JSON.stringify(h))
  } catch {
    // Sem armazenamento: o desafio só não recebe as palavras deste aparelho.
  }
}

export function todayTotal(): number {
  return Object.values(read().byUniverse).reduce((a, b) => a + b, 0)
}

/** Dias seguidos (até hoje) com pelo menos `goal` palavras. */
export function streakDays(goal: number, today = todayKey()): number {
  const h = wordsHistory()
  let n = 0
  const d = new Date(`${today}T12:00:00Z`)
  for (;;) {
    const key = d.toISOString().slice(0, 10)
    if ((h[key] ?? 0) < goal) break
    n++
    d.setUTCDate(d.getUTCDate() - 1)
  }
  return n
}
