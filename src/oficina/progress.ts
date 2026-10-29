import { useSyncExternalStore } from 'react'

/**
 * O caminho de cada pessoa na Oficina, neste aparelho: guias já abertos, exercícios feitos,
 * a trilha escolhida e os passos andados. Não vai para o universo nem para a conta: é um
 * caderninho de estudo (o texto de cada passo fica nos treinos, que sobem com a conta).
 */
export interface OficinaProgress {
  read: string[]
  done: string[]
  /** Passos feitos, como "trilha:passo". */
  steps: string[]
  /** A trilha do passo de hoje (null: ainda não escolheu). */
  trail: string | null
  /** Já respondeu "o que você quer treinar?". */
  asked: boolean
  /** O que cada treino feito numa trilha foi, e as respostas às perguntas do fim. */
  notes: Record<string, StepNote>
}

export interface StepNote {
  trail: string
  step: string
  answers: string[]
  /** Imitação: quanto do original voltou (0 a 1). */
  score?: number
}

const KEY = 'papirus:oficina'
const EMPTY: OficinaProgress = { read: [], done: [], steps: [], trail: null, asked: false, notes: {} }
let cache: OficinaProgress | null = null
const listeners = new Set<() => void>()

function load(): OficinaProgress {
  if (cache) return cache
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<OficinaProgress> | null
    const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
    cache = {
      read: list(raw?.read),
      done: list(raw?.done),
      steps: list(raw?.steps),
      trail: typeof raw?.trail === 'string' ? raw.trail : null,
      asked: raw?.asked === true,
      notes: raw?.notes && typeof raw.notes === 'object' ? raw.notes : {},
    }
  } catch {
    cache = EMPTY
  }
  return cache
}

function save(next: OficinaProgress) {
  cache = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Sem armazenamento: o progresso vale só até fechar.
  }
  for (const l of listeners) l()
}

/** Chave de um exercício: guia + título. */
export const exerciseKey = (guide: string, title: string) => `${guide}:${title}`

export function markRead(guide: string) {
  const p = load()
  if (!p.read.includes(guide)) save({ ...p, read: [...p.read, guide] })
}

export function toggleDone(key: string) {
  const p = load()
  save({ ...p, done: p.done.includes(key) ? p.done.filter((k) => k !== key) : [...p.done, key] })
}

/** Escolhe a trilha do passo de hoje (e conta como respondida a pergunta da primeira vez). */
export function chooseTrail(trail: string) {
  save({ ...load(), trail, asked: true })
}

export function skipQuestion() {
  save({ ...load(), asked: true })
}

/** Um passo feito: conta na trilha e guarda o que o treino foi. */
export function completeStep(trail: string, step: string, treinoId: string | null, answers: string[] = [], score?: number) {
  const p = load()
  const key = `${trail}:${step}`
  save({
    ...p,
    trail: p.trail ?? trail,
    asked: true,
    steps: p.steps.includes(key) ? p.steps : [...p.steps, key],
    notes: treinoId ? { ...p.notes, [treinoId]: { trail, step, answers, ...(score === undefined ? {} : { score }) } } : p.notes,
  })
}

export const oficinaProgress = () => load()

export function useOficinaProgress(): OficinaProgress {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    load,
    () => EMPTY,
  )
}
