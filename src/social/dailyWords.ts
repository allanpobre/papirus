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
  } catch {
    // Sem armazenamento: o desafio só não recebe as palavras deste aparelho.
  }
}

export function todayTotal(): number {
  return Object.values(read().byUniverse).reduce((a, b) => a + b, 0)
}
