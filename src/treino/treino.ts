import { useSyncExternalStore } from 'react'
import { todayKey } from '../logic/stats'
import { wordCount } from '../persistence/repository'

/**
 * Treinos de escrita: como um treino de academia, com tempo (sprint) e um mínimo a bater,
 * em palavras ou em caracteres. Cada tentativa fica guardada (neste aparelho e, com conta,
 * na nuvem) para ver o progresso e refazer o mesmo desafio no futuro.
 */
export type TreinoUnit = 'palavras' | 'caracteres'

export interface Treino {
  id: string
  /** Dia em que foi feito (AAAA-MM-DD, no fuso de quem escreveu). */
  day: string
  prompt: string
  /** Era a proposta do dia (conta como o desafio do dia). */
  daily: boolean
  /** Tempo do sprint, em minutos (0 = sem tempo). */
  minutes: number
  /** O mínimo combinado, na unidade escolhida. */
  target: number
  unit: TreinoUnit
  words: number
  chars: number
  /** Quanto tempo escreveu, em segundos. */
  seconds: number
  /** Bateu o mínimo. */
  done: boolean
  text: string
  /** Quando terminou (ISO). */
  at: string
}

export interface TreinoSetup {
  minutes: number
  target: number
  unit: TreinoUnit
}

/** Os treinos prontos, do mais leve ao mais puxado. */
export const PRESETS: { id: string; name: string; hint: string; setup: Record<TreinoUnit, TreinoSetup> }[] = [
  {
    id: 'aquecimento',
    name: 'Aquecimento',
    hint: 'Para começar o dia',
    setup: { palavras: { minutes: 5, target: 100, unit: 'palavras' }, caracteres: { minutes: 5, target: 600, unit: 'caracteres' } },
  },
  {
    id: 'sprint',
    name: 'Sprint',
    hint: 'O treino de sempre',
    setup: { palavras: { minutes: 15, target: 300, unit: 'palavras' }, caracteres: { minutes: 15, target: 1800, unit: 'caracteres' } },
  },
  {
    id: 'maratona',
    name: 'Maratona',
    hint: 'Para quando der tempo',
    setup: { palavras: { minutes: 30, target: 750, unit: 'palavras' }, caracteres: { minutes: 30, target: 4500, unit: 'caracteres' } },
  },
]

export const MINUTE_CHOICES = [5, 10, 15, 20, 30, 45, 0]

/** Caracteres contando os espaços (como pedem concursos e editais), sem as quebras de linha das pontas. */
export const charCount = (text: string) => [...text.trim()].length

export function measure(text: string, unit: TreinoUnit): number {
  return unit === 'palavras' ? wordCount(text) : charCount(text)
}

export const unitLabel = (unit: TreinoUnit, n: number) => (unit === 'palavras' ? (n === 1 ? 'palavra' : 'palavras') : n === 1 ? 'caractere' : 'caracteres')

/** O que o treino mede, na unidade dele. */
export const scoreOf = (t: Pick<Treino, 'unit' | 'words' | 'chars'>) => (t.unit === 'palavras' ? t.words : t.chars)

/** Palavras por minuto (com o tempo que realmente escreveu; menos de meio minuto não diz nada). */
export const pace = (t: Pick<Treino, 'words' | 'seconds'>) => (t.seconds >= 30 ? Math.round((t.words / t.seconds) * 60) : 0)

// ─── Guardados neste aparelho ───────────────────────────────────────────

const KEY = 'papirus:treinos'
/** Texto de um treino tem limite, para o caderno não estourar o armazenamento do navegador. */
export const MAX_TEXT = 60_000

interface Store {
  items: Treino[]
  /** Apagados aqui que ainda precisam sumir da nuvem. */
  deleted: string[]
  /** Treinos já guardados na nuvem, por conta. */
  synced: Record<string, string[]>
}

const EMPTY: Store = { items: [], deleted: [], synced: {} }
let cache: Store | null = null
const listeners = new Set<() => void>()

function load(): Store {
  if (cache) return cache
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Store> | null
    cache = { items: Array.isArray(raw?.items) ? raw.items : [], deleted: Array.isArray(raw?.deleted) ? raw.deleted : [], synced: raw?.synced && typeof raw.synced === 'object' ? raw.synced : {} }
  } catch {
    cache = { ...EMPTY }
  }
  return cache
}

function save(next: Store) {
  cache = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Sem espaço ou sem armazenamento: vale até fechar (e a nuvem ainda guarda, com conta).
  }
  for (const l of listeners) l()
}

const byNewest = (a: Treino, b: Treino) => b.at.localeCompare(a.at)

export const treinos = () => load().items

export function addTreino(t: Treino) {
  const s = load()
  save({ ...s, items: [{ ...t, text: t.text.slice(0, MAX_TEXT) }, ...s.items.filter((x) => x.id !== t.id)].sort(byNewest) })
}

export function removeTreino(id: string) {
  const s = load()
  const wasSynced = Object.values(s.synced).some((ids) => ids.includes(id))
  save({
    items: s.items.filter((x) => x.id !== id),
    deleted: wasSynced ? [...new Set([...s.deleted, id])] : s.deleted,
    synced: Object.fromEntries(Object.entries(s.synced).map(([u, ids]) => [u, ids.filter((x) => x !== id)])),
  })
}

/** Junta o que veio da nuvem com o daqui (cada treino é imutável: basta unir pelo id). */
export function mergeFromCloud(userId: string, remote: Treino[], uploaded: string[] = []) {
  const s = load()
  const gone = new Set(s.deleted)
  const known = new Map(s.items.map((t) => [t.id, t]))
  for (const t of remote) if (!gone.has(t.id) && !known.has(t.id)) known.set(t.id, t)
  const inCloud = new Set([...(s.synced[userId] ?? []), ...remote.map((t) => t.id), ...uploaded])
  save({ ...s, items: [...known.values()].sort(byNewest), synced: { ...s.synced, [userId]: [...inCloud].filter((id) => known.has(id)) } })
}

export function pendingFor(userId: string): { upload: Treino[]; remove: string[] } {
  const s = load()
  const inCloud = new Set(s.synced[userId] ?? [])
  return { upload: s.items.filter((t) => !inCloud.has(t.id)), remove: s.deleted }
}

export function clearDeleted(ids: string[]) {
  const s = load()
  save({ ...s, deleted: s.deleted.filter((id) => !ids.includes(id)) })
}

export function useTreinos(): Treino[] {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => load().items,
    () => EMPTY.items,
  )
}

// ─── O que os treinos contam ─────────────────────────────────────────────

const dayNumber = (key: string) => Math.round(Date.parse(`${key}T12:00:00Z`) / 86_400_000)

/** Dias seguidos com pelo menos um treino concluído, até hoje (ou até ontem, se hoje ainda não teve). */
export function treinoStreak(list: Treino[], today = todayKey()): number {
  const days = new Set(list.filter((t) => t.done).map((t) => dayNumber(t.day)))
  let d = dayNumber(today)
  if (!days.has(d)) d -= 1
  let n = 0
  while (days.has(d)) {
    n++
    d--
  }
  return n
}

/** As outras tentativas do mesmo desafio (mesma proposta e mesma unidade), da mais nova para a mais velha. */
export const attemptsOf = (list: Treino[], t: Pick<Treino, 'prompt' | 'unit'>) => list.filter((x) => x.prompt === t.prompt && x.unit === t.unit).sort(byNewest)

/** O recorde de um desafio: a tentativa com mais texto no mesmo tempo (ou em qualquer tempo, sem tempo). */
export function recordOf(list: Treino[], t: Pick<Treino, 'prompt' | 'unit' | 'minutes'>): Treino | undefined {
  return attemptsOf(list, t)
    .filter((x) => x.minutes === t.minutes)
    .reduce<Treino | undefined>((best, x) => (!best || scoreOf(x) > scoreOf(best) ? x : best), undefined)
}

export function summary(list: Treino[], today = todayKey()) {
  const done = list.filter((t) => t.done)
  return {
    total: list.length,
    done: done.length,
    streak: treinoStreak(list, today),
    words: list.reduce((n, t) => n + t.words, 0),
    bestPace: list.reduce((n, t) => Math.max(n, t.minutes > 0 ? pace(t) : 0), 0),
    today: list.filter((t) => t.day === today),
  }
}
