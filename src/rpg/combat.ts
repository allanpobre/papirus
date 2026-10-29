import type { GameSystem, Session, Sheet, Universe } from '../model/schema'
import { byId, newId, patch } from '../model/universe'
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

// ─── Condições com duração ────────────────────────────────────────────

/** As condições de quem está na iniciativa: as da ficha, ou as anotadas no combatente sem ficha. */
export function conditionsOf(universe: Universe, entry: Entry): string[] {
  const sheet = entry.sheetId ? byId(universe, 'sheets', entry.sheetId) : undefined
  return sheet ? sheet.conditions : entry.conditions
}

/** Quantas rodadas ainda faltam para a condição acabar (null: dura até alguém tirar). */
export function roundsLeft(session: Session, entryId: string, name: string): number | null {
  const e = session.effects.find((x) => x.entryId === entryId && x.name === name)
  return e ? Math.max(1, e.until - session.round) : null
}

function setConditions(universe: Universe, session: Session, entry: Entry, list: string[]): Universe {
  const sheet = entry.sheetId ? byId(universe, 'sheets', entry.sheetId) : undefined
  if (sheet) return patch(universe, 'sheets', sheet.id, { conditions: list })
  const s = byId(universe, 'sessions', session.id)!
  return patch(universe, 'sessions', s.id, { initiative: s.initiative.map((x) => (x.id === entry.id ? { ...x, conditions: list } : x)) })
}

/** Põe uma condição em alguém da iniciativa; com `rounds`, ela acaba sozinha depois desse número de rodadas. */
export function addCondition(universe: Universe, sessionId: string, entryId: string, name: string, rounds: number | null): Universe {
  const session = byId(universe, 'sessions', sessionId)
  const entry = session?.initiative.find((e) => e.id === entryId)
  if (!session || !entry || !name.trim()) return universe
  const current = conditionsOf(universe, entry)
  let next = current.includes(name) ? universe : setConditions(universe, session, entry, [...current, name])
  const s = byId(next, 'sessions', sessionId)!
  const effects = s.effects.filter((x) => !(x.entryId === entryId && x.name === name))
  next = patch(next, 'sessions', s.id, { effects: rounds && rounds > 0 ? [...effects, { id: newId(), entryId, name, until: s.round + rounds }] : effects })
  return next
}

export function removeCondition(universe: Universe, sessionId: string, entryId: string, name: string): Universe {
  const session = byId(universe, 'sessions', sessionId)
  const entry = session?.initiative.find((e) => e.id === entryId)
  if (!session || !entry) return universe
  const next = setConditions(universe, session, entry, conditionsOf(universe, entry).filter((x) => x !== name))
  const s = byId(next, 'sessions', sessionId)!
  return patch(next, 'sessions', s.id, { effects: s.effects.filter((x) => !(x.entryId === entryId && x.name === name)) })
}

/** A rodada virou: as condições que venceram acabam. Devolve as linhas para o registro ("Atordoado acabou em Goblin 1"). */
export function expireEffects(universe: Universe, sessionId: string): { universe: Universe; ended: string[] } {
  const session = byId(universe, 'sessions', sessionId)
  if (!session) return { universe, ended: [] }
  const due = session.effects.filter((e) => e.until <= session.round)
  let next = universe
  const ended: string[] = []
  for (const e of due) {
    const entry = byId(next, 'sessions', sessionId)!.initiative.find((x) => x.id === e.entryId)
    next = entry ? removeCondition(next, sessionId, e.entryId, e.name) : patch(next, 'sessions', sessionId, { effects: byId(next, 'sessions', sessionId)!.effects.filter((x) => x.id !== e.id) })
    if (entry) ended.push(`${e.name} acabou em ${entry.name}.`)
  }
  return { universe: next, ended }
}

// ─── Desfazer o dano ───────────────────────────────────────────────────

/** Como estava a vida de alguém antes do dano: para o "Desfazer". */
export type LifeBefore = { sheetId: string; resources: Sheet['resources'] } | { entryId: string; hp: string }

export function lifeBefore(universe: Universe, sessionId: string, targetId: string): LifeBefore | null {
  const entry = byId(universe, 'sessions', sessionId)?.initiative.find((e) => e.id === targetId)
  if (!entry) return null
  const sheet = entry.sheetId ? byId(universe, 'sheets', entry.sheetId) : undefined
  return sheet ? { sheetId: sheet.id, resources: sheet.resources } : { entryId: entry.id, hp: entry.hp }
}

/** Volta a vida para como estava antes do dano. */
export function restoreLife(universe: Universe, sessionId: string, before: LifeBefore): Universe {
  if ('sheetId' in before) return byId(universe, 'sheets', before.sheetId) ? patch(universe, 'sheets', before.sheetId, { resources: before.resources }) : universe
  const s = byId(universe, 'sessions', sessionId)
  return s ? patch(universe, 'sessions', s.id, { initiative: s.initiative.map((e) => (e.id === before.entryId ? { ...e, hp: before.hp } : e)) }) : universe
}
