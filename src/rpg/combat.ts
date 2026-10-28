import type { GameSystem, Session, Sheet, Universe } from '../model/schema'
import { byId, patch } from '../model/universe'
import type { CombatTarget } from './rolls'
import { adjustResource, defenseLabel, defenseResource, isPool } from './sheets'

type Entry = Session['initiative'][number]

/** A ordem da iniciativa: do maior valor para o menor. */
export const initiativeOrder = (session: Session): Entry[] => [...session.initiative].sort((a, b) => b.value - a.value)

/** PV escrito à mão num combatente sem ficha: "7" (só o atual) ou "3/7" (atual e máximo). */
export function parseHp(text: string): { current: number; max: number | null } | null {
  const m = text.trim().match(/^(-?\d+)\s*(?:\/\s*(\d+))?$/)
  return m ? { current: Number(m[1]), max: m[2] ? Number(m[2]) : null } : null
}

/** Tira (ou devolve) vida de quem não tem ficha. "7" com 9 de dano vira "-2/7": o primeiro valor vira o máximo. */
export function hurtHp(text: string, delta: number): string | null {
  const hp = parseHp(text)
  if (!hp) return null
  const max = hp.max ?? hp.current
  return `${Math.min(max, hp.current + delta)}/${max}`
}

/** A vida de um combatente agora: da ficha (o primeiro recurso que sobe e desce) ou do que foi anotado. */
export function lifeOf(universe: Universe, entry: Entry): { current: number; max: number | null; abbr: string } | null {
  const sheet = entry.sheetId ? byId(universe, 'sheets', entry.sheetId) : undefined
  if (sheet) {
    const system = universe.systems.find((s) => s.id === sheet.systemId)
    const main = system?.resources.find(isPool)
    if (!main) return null
    const r = sheet.resources[main.id] ?? { current: main.default, max: main.default }
    return { current: r.current, max: r.max > 0 ? r.max : null, abbr: main.abbr }
  }
  const hp = parseHp(entry.hp)
  return hp ? { ...hp, abbr: 'PV' } : null
}

/** Fora da luta: a vida chegou a zero. */
export const isDown = (universe: Universe, entry: Entry) => {
  const life = lifeOf(universe, entry)
  // Ficha sem vida definida (máximo 0) não conta como derrotada.
  return Boolean(life && life.current <= 0 && (!entry.sheetId || life.max !== null))
}

function defenseOf(universe: Universe, entry: Entry, sheet: Sheet | undefined): number | null {
  if (!sheet) return entry.defense
  const system = universe.systems.find((s) => s.id === sheet.systemId)
  const r = defenseResource(system)
  return r ? (sheet.resources[r.id]?.current ?? r.default) : entry.defense
}

/** Quem pode ser alvo agora, na ordem da iniciativa (menos quem ataca). */
export function combatTargets(universe: Universe, session: Session, system: GameSystem | undefined, except: { sheetId?: string | null; entryId?: string | null } = {}): CombatTarget[] {
  return initiativeOrder(session)
    .filter((e) => e.id !== except.entryId && !(except.sheetId && e.sheetId === except.sheetId))
    .map((e) => {
      const sheet = e.sheetId ? byId(universe, 'sheets', e.sheetId) : undefined
      return { id: e.id, name: e.name, defense: defenseOf(universe, e, sheet), defenseLabel: defenseLabel(system) }
    })
}

/**
 * Tira o dano da vida do alvo: da ficha ligada ou do PV anotado na iniciativa.
 * Devolve o universo novo e como ficou, ou null se não há vida para descontar.
 */
export function applyDamage(universe: Universe, sessionId: string, targetId: string, amount: number): { universe: Universe; name: string; current: number; max: number | null; abbr: string; down: boolean } | null {
  const session = byId(universe, 'sessions', sessionId)
  const entry = session?.initiative.find((e) => e.id === targetId)
  if (!session || !entry || amount <= 0) return null
  const sheet = entry.sheetId ? byId(universe, 'sheets', entry.sheetId) : undefined
  let next: Universe
  if (sheet) {
    const system = universe.systems.find((s) => s.id === sheet.systemId)
    const main = system?.resources.find(isPool)
    if (!main) return null
    const r = sheet.resources[main.id] ?? { current: main.default, max: main.default }
    next = patch(universe, 'sheets', sheet.id, { resources: adjustResource({ ...sheet, resources: { ...sheet.resources, [main.id]: r } }, main.id, -amount) })
  } else {
    const hp = hurtHp(entry.hp, -amount)
    if (hp === null) return null
    next = patch(universe, 'sessions', session.id, { initiative: session.initiative.map((e) => (e.id === entry.id ? { ...e, hp } : e)) })
  }
  const after = byId(next, 'sessions', sessionId)!.initiative.find((e) => e.id === targetId)!
  const life = lifeOf(next, after)!
  return { universe: next, name: entry.name, ...life, down: isDown(next, after) }
}
