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
    .map((phase) => ({ phase, at: index.get(phase.sceneId) ?? -1 }))
    .filter((p) => p.at >= 0)
    .sort((a, b) => a.at - b.at)
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
  const x = entityAt(e, a, order)
  const y = entityAt(e, b, order)
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
