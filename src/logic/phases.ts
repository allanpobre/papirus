import type { Entity, Scene } from '../model/schema'
import { fold } from './text'

/*
 * As fases de uma ficha: como ela muda ao longo da história (Crusader Kings, Disco Elysium). Cada fase vale a
 * partir de uma cena e guarda só o que muda; o resto vem da fase de antes. A ficha de base é o começo.
 */

export type Phase = NonNullable<Entity['phases']>[number]

/** As fases na ordem da história, com a posição da cena; as de cena apagada ficam de fora. */
export function phasesOf(e: Pick<Entity, 'phases'>, order: Scene[]): { phase: Phase; at: number }[] {
  const index = new Map(order.map((s, i) => [s.id, i]))
  return (e.phases ?? [])
    .map((phase) => ({ phase, at: phase.sceneId ? (index.get(phase.sceneId) ?? -1) : -1 }))
    .filter((p) => p.at >= 0)
    .sort((a, b) => a.at - b.at)
}

/**
 * As fases planejadas: sem cena (ainda não escrita) ou cuja cena foi apagada. Só o autor vê; não valem em
 * nenhum ponto da história (nem no leitor, na wiki ou no Codex) até serem presas a uma cena.
 */
export function plannedOf(e: Pick<Entity, 'phases'>, order: Scene[]): Phase[] {
  const ids = new Set(order.map((s) => s.id))
  return (e.phases ?? []).filter((p) => !p.sceneId || !ids.has(p.sceneId))
}

/** A fase que vale num ponto (a última que já começou), ou null (a ficha de base). */
export function phaseAt(e: Pick<Entity, 'phases'>, index: number, order: Scene[]): { phase: Phase; at: number } | null {
  let current: { phase: Phase; at: number } | null = null
  for (const p of phasesOf(e, order)) if (p.at <= index) current = p
  return current
}

/** Aplica uma fase sobre a ficha: só o que a fase muda. */
function apply(e: Entity, p: Phase): Entity {
  const changed = new Map(p.fields.filter((f) => f.key.trim()).map((f) => [fold(f.key.trim()), f]))
  const fields = e.fields.map((f) => {
    const c = changed.get(fold(f.key.trim()))
    if (!c) return f
    changed.delete(fold(f.key.trim()))
    return { ...f, value: c.value, type: f.type === 'ficha' ? ('texto' as const) : f.type, ref: f.type === 'ficha' ? null : f.ref }
  })
  for (const c of changed.values()) fields.push({ key: c.key, value: c.value, type: 'texto' as const, ref: null } as Entity['fields'][number])
  return {
    ...e,
    name: p.nameNow.trim() || e.name,
    aliases: p.nameNow.trim() && p.nameNow.trim() !== e.name ? [...new Set([...e.aliases, e.name])] : e.aliases,
    summary: p.summary.trim() || e.summary,
    image: p.image ?? e.image,
    fields,
  }
}

/** A ficha como está num ponto da história: a base mais todas as fases que já começaram. */
export function entityAt(e: Entity, index: number, order: Scene[]): Entity {
  if (!e.phases?.length) return e
  let out = e
  for (const p of phasesOf(e, order)) if (p.at <= index) out = apply(out, p.phase)
  return out
}

/** Uma diferença entre dois momentos da ficha, para "comparar fases". */
export interface PhaseChange {
  key: string
  before: string
  after: string
}

/** O que mudou da ficha em `a` para a ficha em `b` (nome, resumo, retrato e campos). */
export function compareAt(e: Entity, a: number, b: number, order: Scene[]): PhaseChange[] {
  return diffOf(entityAt(e, a, order), entityAt(e, b, order))
}

/** Como a ficha ficaria com uma fase planejada: a ficha no fim da história mais o que a fase muda. */
export function previewPlanned(e: Entity, p: Phase, order: Scene[]): { now: Entity; then: Entity; changes: PhaseChange[] } {
  const now = entityAt(e, order.length - 1, order)
  const then = apply(now, p)
  return { now, then, changes: diffOf(now, then) }
}

function diffOf(x: Entity, y: Entity): PhaseChange[] {
  const out: PhaseChange[] = []
  if (x.name !== y.name) out.push({ key: 'Nome', before: x.name, after: y.name })
  if (x.summary !== y.summary) out.push({ key: 'Resumo', before: x.summary, after: y.summary })
  if ((x.image ?? null) !== (y.image ?? null)) out.push({ key: 'Retrato', before: x.image ? 'um' : '—', after: y.image ? 'outro' : '—' })
  const keys = [...new Set([...x.fields, ...y.fields].map((f) => f.key.trim()).filter(Boolean))]
  for (const k of keys) {
    const before = x.fields.find((f) => fold(f.key.trim()) === fold(k))?.value ?? ''
    const after = y.fields.find((f) => fold(f.key.trim()) === fold(k))?.value ?? ''
    if (before !== after) out.push({ key: k, before, after })
  }
  return out
}

/** Uma versão da ficha para ver na página: o começo ('base'), uma fase presa a uma cena ou uma planejada. */
export interface VersionView {
  entity: Entity
  /** A fase vista (null = o começo). */
  phase: Phase | null
  /** A posição da cena da fase (-1 no começo e nas planejadas). */
  at: number
  planned: boolean
}

/** A ficha como ela é numa versão escolhida pelo autor (sem depender da régua da história). */
export function versionView(e: Entity, id: string, order: Scene[]): VersionView | null {
  if (id === 'base') return { entity: e, phase: null, at: -1, planned: false }
  const placed = phasesOf(e, order).find((p) => p.phase.id === id)
  if (placed) return { entity: entityAt(e, placed.at, order), phase: placed.phase, at: placed.at, planned: false }
  const planned = plannedOf(e, order).find((p) => p.id === id)
  if (planned) return { entity: previewPlanned(e, planned, order).then, phase: planned, at: -1, planned: true }
  return null
}

/** A ficha logo antes de uma fase (o que a fase muda é comparado com isto). Sem fase: a ficha no fim da história. */
export function before(e: Entity, p: Phase | null, order: Scene[]): Entity {
  const placed = p ? phasesOf(e, order).find((x) => x.phase.id === p.id) : undefined
  if (placed) return entityAt({ ...e, phases: (e.phases ?? []).filter((x) => x.id !== p!.id) }, placed.at, order)
  return entityAt({ ...e, phases: (e.phases ?? []).filter((x) => x.id !== p?.id) }, order.length - 1, order)
}
