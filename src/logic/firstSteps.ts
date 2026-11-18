import type { Universe } from '../model/schema'
import type { View } from '../state/workspace'

/*
 * Primeira vez mais curta: no primeiro universo de alguém, algumas partes só aparecem quando passam a fazer
 * sentido (as Ligações quando há duas fichas, a Linha do tempo quando há uma data…). O que já apareceu fica
 * (guardado nas preferências); "Mostrar todas" desliga. Quem já usava o Papirus nunca vê nada sumir.
 */

export interface FirstSteps {
  active: boolean
  /** As partes que já apareceram (não somem de novo). */
  revealed: View[]
}

/** As partes que esperam o uso, e quando cada uma aparece. */
export const WAITING: { view: View; ready: (u: Universe) => boolean; why: string }[] = [
  { view: 'relacoes', ready: (u) => u.entities.length >= 2, why: 'quando houver duas fichas' },
  {
    view: 'timeline',
    ready: (u) => u.events.length > 0 || u.entities.some((e) => e.startYear !== null || e.endYear !== null) || u.scenes.some((s) => s.date),
    why: 'quando houver uma data',
  },
  { view: 'atlas', ready: (u) => u.entities.some((e) => e.kind === 'lugar' || e.kind === 'reino') || u.maps.length > 0, why: 'quando houver um lugar' },
  { view: 'conhecimento', ready: (u) => u.facts.length > 0, why: 'quando houver um fato' },
]
const WAITING_VIEWS = WAITING.map((w) => w.view)

/** Lê o valor guardado (de qualquer versão) sem quebrar: partes desconhecidas ficam de fora. */
export function cleanFirstSteps(raw: unknown): FirstSteps | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as { active?: unknown; revealed?: unknown }
  return { active: r.active === true, revealed: Array.isArray(r.revealed) ? (r.revealed.filter((v) => WAITING_VIEWS.includes(v as View)) as View[]) : [] }
}

/** As partes escondidas agora (as que esperam e ainda não estão prontas nem apareceram). */
export function waitingViews(u: Universe, fs: FirstSteps | undefined): View[] {
  if (!fs?.active) return []
  return WAITING.filter((w) => !fs.revealed.includes(w.view) && !w.ready(u)).map((w) => w.view)
}

/** As que acabaram de ficar prontas (para guardar como já aparecidas). */
export function newlyReady(u: Universe, fs: FirstSteps | undefined): View[] {
  if (!fs?.active) return []
  return WAITING.filter((w) => !fs.revealed.includes(w.view) && w.ready(u)).map((w) => w.view)
}
