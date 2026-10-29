import type { GameSystem, Session, Universe } from '../model/schema'
import { byId, newId, patch } from '../model/universe'
import { roll } from '../logic/dice'
import { initiativeOrder } from './combat'
import { rollInitiative } from './rolls'
import { attendanceOf, partyOf } from './sessionLife'

type Entry = Session['initiative'][number]

/** Em que pé está o combate: nenhum, os jogadores rolando a iniciativa, ou os turnos andando. */
export type FightPhase = 'fora' | 'iniciativa' | 'turnos'

// Combates de antes das fases não têm `fight`: com gente na iniciativa, já estão em turnos.
export const fightPhase = (s: Session | undefined): FightPhase => (!s ? 'fora' : s.fight === 'iniciativa' ? 'iniciativa' : s.initiative.length ? 'turnos' : 'fora')

/** Quem ainda não tem iniciativa (o jogador está rolando no celular). */
export const waitingFor = (s: Session): Entry[] => s.initiative.filter((e) => !e.rolled)

const clock = (now: Date) => now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

const entry = (name: string, value: number, extra: Partial<Entry> = {}): Entry => ({
  id: newId(),
  name,
  value,
  hp: '',
  note: '',
  sheetId: null,
  defense: null,
  attacks: [],
  monsterId: null,
  conditions: [],
  rolled: true,
  ...extra,
})

/** A iniciativa que o Papirus rola (pelo sistema da mesa, ou 1d20). */
export function autoInitiative(u: Universe, system: GameSystem | undefined, sheetId: string | null, random?: () => number): number {
  const sheet = sheetId ? byId(u, 'sheets', sheetId) : undefined
  return system ? rollInitiative(system, sheet ?? null, random) : roll('1d20', random).total
}

/**
 * Começa um combate: os personagens de quem veio entram esperando a iniciativa, e o pedido
 * vai para os celulares. Quem o mestre conduz já entra rolado. Os inimigos o mestre põe depois.
 */
export function startFight(u: Universe, sessionId: string, system: GameSystem | undefined, now = new Date(), random?: () => number): Universe {
  const s = byId(u, 'sessions', sessionId)
  if (!s) return u
  const inside = new Set(s.initiative.map((e) => e.sheetId))
  const party = partyOf(u, s.groupId).filter((p) => attendanceOf(s, p.id) !== 'fora' && !inside.has(p.id))
  const added = party.map((p) =>
    attendanceOf(s, p.id) === 'mestre'
      ? entry(p.name, autoInitiative(u, system, p.id, random), { sheetId: p.id, note: 'mestre conduz' })
      : entry(p.name, 0, { sheetId: p.id, rolled: false }),
  )
  const asked = added.filter((e) => !e.rolled).map((e) => e.sheetId!)
  const requests = asked.length
    ? [...s.requests.map((r) => (r.kind === 'iniciativa' ? { ...r, open: false } : r)), { id: newId(), at: now.toISOString(), kind: 'iniciativa' as const, name: 'Iniciativa', expression: '', dc: null, sheetIds: asked, results: [], open: true }].slice(-20)
    : s.requests
  return patch(u, 'sessions', s.id, {
    fight: 'iniciativa',
    initiative: [...s.initiative, ...added],
    turn: 0,
    round: 1,
    requests,
    log: [...s.log, { id: newId(), at: clock(now), text: 'Combate! Rolem a iniciativa.', kind: 'nota' }],
  })
}

function place(u: Universe, sessionId: string, entryId: string, value: number): Universe {
  const s = byId(u, 'sessions', sessionId)
  if (!s || !Number.isFinite(value)) return u
  return patch(u, 'sessions', s.id, { initiative: s.initiative.map((e) => (e.id === entryId ? { ...e, value: Math.trunc(value), rolled: true } : e)) })
}

/**
 * O mestre rola ou digita a iniciativa de alguém. Se era de um jogador que estava rolando,
 * o pedido conta como respondido (e some do celular dele).
 */
export function setInitiative(u: Universe, sessionId: string, entryId: string, value: number, now = new Date()): Universe {
  const next = place(u, sessionId, entryId, value)
  const s = byId(next, 'sessions', sessionId)
  const sheetId = s?.initiative.find((e) => e.id === entryId)?.sheetId
  if (!s || next === u || !sheetId) return next
  const result = { sheetId, total: Math.trunc(value), verdict: null, pass: null, by: 'mestre' as const, at: now.toISOString() }
  return patch(next, 'sessions', s.id, {
    requests: s.requests.map((r) => (r.kind === 'iniciativa' && r.open && r.sheetIds.includes(sheetId) ? { ...r, results: [...r.results.filter((x) => x.sheetId !== sheetId), result] } : r)),
  })
}

/** A iniciativa que chegou do celular de um jogador: vai para o personagem dele no combate. */
export function initiativeFromPlayer(u: Universe, sessionId: string, sheetId: string, total: number): Universe {
  const s = byId(u, 'sessions', sessionId)
  const e = s?.initiative.find((x) => x.sheetId === sheetId)
  return s && e ? place(u, s.id, e.id, total) : u
}

/** Todos rolaram: a ordem fica definida, começa a rodada 1 e o registro guarda a ordem. */
export function defineTurns(u: Universe, sessionId: string, now = new Date()): Universe {
  const s = byId(u, 'sessions', sessionId)
  if (!s || !s.initiative.length || waitingFor(s).length) return u
  const order = initiativeOrder(s)
    .map((e) => `${e.name} ${e.value}`)
    .join(' · ')
  return patch(u, 'sessions', s.id, {
    fight: 'turnos',
    turn: 0,
    round: 1,
    requests: s.requests.map((r) => (r.kind === 'iniciativa' ? { ...r, open: false } : r)),
    log: [...s.log, { id: newId(), at: clock(now), text: `Ordem da iniciativa: ${order}`, kind: 'nota' }],
  })
}

/** Acaba (ou cancela) o combate: a iniciativa esvazia e as condições com duração somem. */
export function endFight(u: Universe, sessionId: string): Universe {
  const s = byId(u, 'sessions', sessionId)
  if (!s) return u
  return patch(u, 'sessions', s.id, {
    fight: '',
    initiative: [],
    turn: 0,
    round: 1,
    effects: [],
    requests: s.requests.map((r) => (r.kind === 'iniciativa' ? { ...r, open: false } : r)),
  })
}

/** Alguém entra no combate já andando (ou na hora de rolar): o Papirus rola por ele. */
export function joinFight(u: Universe, sessionId: string, name: string, system: GameSystem | undefined, extra: Partial<Entry> = {}, value?: number, random?: () => number): Universe {
  const s = byId(u, 'sessions', sessionId)
  const clean = name.trim()
  if (!s || !clean) return u
  const v = value ?? autoInitiative(u, system, extra.sheetId ?? null, random)
  // Com os turnos andando, quem entra não pode tomar a vez de quem está jogando agora.
  const list = initiativeOrder(s)
  const current = list.length ? list[s.turn % list.length] : undefined
  const added = entry(clean, v, extra)
  const order = initiativeOrder({ ...s, initiative: [...s.initiative, added] })
  const turn = current ? order.findIndex((e) => e.id === current.id) : 0
  return patch(u, 'sessions', s.id, { initiative: [...s.initiative, added], turn: Math.max(0, turn) })
}
