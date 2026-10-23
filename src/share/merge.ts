import type { Universe } from '../model/schema'
import { newId } from '../model/universe'

/** Comparação que não depende da ordem das chaves. */
export function stableJson(value: unknown): string {
  return JSON.stringify(value, (_k, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : v,
  )
}
const same = (a: unknown, b: unknown) => a === b || stableJson(a) === stableJson(b)

type Item = Record<string, unknown>

export interface MergeResult {
  universe: Universe
  /** Nomes das cópias criadas quando os dois lados mexeram no mesmo registro. */
  copies: string[]
  /** Cenas cujo texto mudou em relação ao "meu" lado (o editor precisa recarregar). */
  changedScenes: string[]
  /** O resultado é igual ao "meu" lado (nada chegou de fora). */
  unchanged: boolean
}

function label(item: Item): string {
  return String(item.title ?? item.name ?? item.text ?? '').slice(0, 60) || 'Sem título'
}

function copyOf(item: Item, who: string): Item {
  const c: Item = { ...item, id: newId() }
  const suffix = ` (versão de ${who})`
  if (typeof c.title === 'string') c.title += suffix
  else if (typeof c.name === 'string') c.name += suffix
  return c
}

/**
 * Junta duas versões de um universo que partiram da mesma base, registro por registro
 * (ficha, cena, fato…). Quem mexeu num registro ganha; se os dois mexeram no mesmo,
 * fica a minha versão e a outra vira uma cópia ao lado. Nada se perde:
 * um registro apagado de um lado só some se o outro lado não mexeu nele.
 */
export function mergeUniverse(base: Universe, mine: Universe, theirs: Universe, who: string): MergeResult {
  const copies: string[] = []
  const out: Record<string, unknown> = {}
  const keys = new Set([...Object.keys(mine), ...Object.keys(theirs)])

  for (const key of keys) {
    const m = (mine as unknown as Record<string, unknown>)[key]
    const t = (theirs as unknown as Record<string, unknown>)[key]
    const b = (base as unknown as Record<string, unknown>)[key]
    if (Array.isArray(m) && Array.isArray(t)) {
      const idKey = key === 'continuity' ? 'key' : 'id'
      if (!(m as Item[]).every((x) => x && typeof x === 'object' && idKey in x)) {
        out[key] = same(m, b) ? t : m
        continue
      }
      out[key] = mergeList(Array.isArray(b) ? (b as Item[]) : [], m as Item[], t as Item[], idKey, key !== 'continuity', who, copies)
    } else if (key === 'dailyStart' && m && t && typeof m === 'object' && typeof t === 'object') {
      out[key] = { ...(t as object), ...(m as object) }
    } else {
      out[key] = same(m, b) ? t : m
    }
  }

  const universe = out as unknown as Universe
  const mineScenes = new Map(mine.scenes.map((s) => [s.id, s]))
  const changedScenes = universe.scenes.filter((s) => !same(mineScenes.get(s.id)?.doc, s.doc)).map((s) => s.id)
  const content = (u: Universe) => stableJson({ ...u, updatedAt: '' })
  const merged = content(universe)
  const unchanged = merged === content(mine)
  // Igual ao outro lado: fica a versão dele, com a mesma data (assim ninguém regrava à toa).
  const result = merged === content(theirs) ? theirs : unchanged ? mine : { ...universe, updatedAt: new Date().toISOString() }
  return { universe: result, copies, changedScenes, unchanged }
}

function mergeList(base: Item[], mine: Item[], theirs: Item[], idKey: string, canCopy: boolean, who: string, copies: string[]): Item[] {
  const b = new Map(base.map((x) => [x[idKey], x]))
  const t = new Map(theirs.map((x) => [x[idKey], x]))
  const mineIds = new Set(mine.map((x) => x[idKey]))
  const result: Item[] = []

  for (const m of mine) {
    const id = m[idKey]
    const before = b.get(id)
    const other = t.get(id)
    if (!other) {
      // Apagado do outro lado: só some se eu não mexi.
      if (!before || !same(m, before)) result.push(m)
      continue
    }
    if (same(m, other) || (before && same(other, before))) result.push(m)
    else if (before && same(m, before)) result.push(other)
    else {
      result.push(m)
      if (canCopy) {
        result.push(copyOf(other, who))
        copies.push(label(other))
      }
    }
  }
  for (const other of theirs) {
    const id = other[idKey]
    if (mineIds.has(id)) continue
    const before = b.get(id)
    // Apagado aqui: volta só se o outro lado mexeu depois.
    if (!before || !same(other, before)) result.push(other)
  }
  return result
}
