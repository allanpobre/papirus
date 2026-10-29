import type { GameSystem, Session, Universe } from '../model/schema'
import { INITIATIVE_MODES } from '../model/schema'
import { byId, newId, patch } from '../model/universe'
import { roll } from '../logic/dice'
import { expireEffects, initiativeOrder, isDown } from './combat'
import { rollInitiative } from './rolls'
import { attendanceOf, partyOf } from './sessionLife'

type Entry = Session['initiative'][number]

/** Os jeitos de iniciativa. */
export type InitiativeMode = (typeof INITIATIVE_MODES)[number]

export const MODE_LABEL: Record<InitiativeMode, string> = { classica: 'Clássica', lados: 'Por lados', pipoca: 'Pipoca' }
export const MODE_HINT: Record<InitiativeMode, string> = {
  classica: 'Cada um rola; a ordem vai do maior para o menor.',
  lados: 'Um dado para os heróis, um para os inimigos. O lado que ganha age primeiro; os jogadores escolhem a ordem entre eles.',
  pipoca: 'Quem acabou de agir escolhe quem vem depois, herói ou inimigo.',
}

/** De que lado alguém luta: os personagens de jogador são os heróis; o resto, os inimigos. */
export type Side = 'herois' | 'inimigos'
export const sideOf = (u: Universe, e: Entry): Side => (e.sheetId && byId(u, 'sheets', e.sheetId)?.role === 'pj' ? 'herois' : 'inimigos')

/** Quem ainda age: inimigos derrotados, não; heróis caídos, sim (podem estar sangrando). */
const fighting = (u: Universe, s: Session) => s.initiative.filter((e) => sideOf(u, e) === 'herois' || !isDown(u, e))

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
export function startFight(u: Universe, sessionId: string, system: GameSystem | undefined, now = new Date(), random?: () => number, mode?: InitiativeMode): Universe {
  const s = byId(u, 'sessions', sessionId)
  if (!s) return u
  const how = mode ?? (s.groupId ? byId(u, 'groups', s.groupId)?.initiativeMode : undefined) ?? 'classica'
  const inside = new Set(s.initiative.map((e) => e.sheetId))
  const party = partyOf(u, s.groupId).filter((p) => attendanceOf(s, p.id) !== 'fora' && !inside.has(p.id))
  const gm = (id: string) => (attendanceOf(s, id) === 'mestre' ? 'mestre conduz' : '')
  // Por lados e na pipoca, ninguém rola a própria iniciativa.
  const added = party.map((p) =>
    how !== 'classica' || attendanceOf(s, p.id) === 'mestre' ? entry(p.name, how === 'classica' ? autoInitiative(u, system, p.id, random) : 0, { sheetId: p.id, note: gm(p.id) }) : entry(p.name, 0, { sheetId: p.id, rolled: false }),
  )
  const asked = added.filter((e) => !e.rolled).map((e) => e.sheetId!)
  const requests = asked.length
    ? [
        ...s.requests.map((r) => (r.kind === 'iniciativa' ? { ...r, open: false } : r)),
        { id: newId(), at: now.toISOString(), kind: 'iniciativa' as const, name: 'Iniciativa', expression: '', dc: null, sheetIds: asked, results: [], open: true },
      ].slice(-20)
    : s.requests
  const line = how === 'classica' ? 'Combate! Rolem a iniciativa.' : how === 'lados' ? 'Combate! Iniciativa por lados.' : 'Combate! Iniciativa pipoca.'
  return patch(u, 'sessions', s.id, {
    fight: 'iniciativa',
    fightMode: how,
    sides: null,
    turnId: null,
    acted: [],
    initiative: [...s.initiative, ...added],
    turn: 0,
    round: 1,
    requests,
    log: [...s.log, { id: newId(), at: clock(now), text: line, kind: 'nota' }],
  })
}

/** Por lados: o que cada lado tirou no dado. */
export function setSides(u: Universe, sessionId: string, heroes: number, foes: number): Universe {
  const s = byId(u, 'sessions', sessionId)
  if (!s || !Number.isFinite(heroes) || !Number.isFinite(foes)) return u
  return patch(u, 'sessions', s.id, { sides: { heroes: Math.trunc(heroes), foes: Math.trunc(foes) } })
}

/** Por lados: quem começa cada rodada (no empate, os heróis). */
export const firstSide = (s: Session): Side => (!s.sides || s.sides.heroes >= s.sides.foes ? 'herois' : 'inimigos')

/** Por lados: de que lado é a vez agora, e quem desse lado ainda não agiu. `null` = a rodada acabou. */
export function sideTurn(u: Universe, s: Session): { side: Side; pending: Entry[] } | null {
  const first = firstSide(s)
  const order = [first, first === 'herois' ? 'inimigos' : 'herois'] as Side[]
  const live = fighting(u, s)
  for (const side of order) {
    const pending = live.filter((e) => sideOf(u, e) === side && !s.acted.includes(e.id))
    if (pending.length) return { side, pending }
  }
  return null
}

/** Pipoca: para quem a vez pode passar. Sem ninguém que falte, a rodada vira e vale qualquer um. */
export function popcornChoices(u: Universe, s: Session): { next: Entry[]; newRound: boolean } {
  const live = fighting(u, s)
  const left = live.filter((e) => e.id !== s.turnId && !s.acted.includes(e.id))
  return left.length ? { next: left, newRound: false } : { next: live, newRound: true }
}

/** Quem age agora: na clássica, pela ordem; por lados, o inimigo da vez (os heróis escolhem entre eles); na pipoca, o escolhido. */
export function currentId(s: Session): string | null {
  if (fightPhase(s) !== 'turnos') return null
  if (s.fightMode === 'classica') {
    const order = initiativeOrder(s)
    return order.length ? order[s.turn % order.length].id : null
  }
  return s.turnId && s.initiative.some((e) => e.id === s.turnId) ? s.turnId : null
}

const at = (now: Date) => clock(now)

/** Vira a rodada: as condições que venceram acabam, e o registro conta. */
function turnRound(u: Universe, sessionId: string, round: number, change: Partial<Session>, now: Date): Universe {
  const { universe: v, ended } = expireEffects(patch(u, 'sessions', sessionId, { ...change, round }), sessionId)
  const s = byId(v, 'sessions', sessionId)!
  if (s.status !== 'em-andamento') return v
  return patch(v, 'sessions', s.id, { log: [...s.log, ...[`Rodada ${round}`, ...ended].map((text) => ({ id: newId(), at: at(now), text, kind: 'nota' as const }))] })
}

/** Clássica: passa (ou volta) a vez, pulando os inimigos derrotados. */
export function nextTurn(u: Universe, sessionId: string, dir: 1 | -1 = 1, now = new Date()): Universe {
  const s = byId(u, 'sessions', sessionId)
  if (!s) return u
  const list = initiativeOrder(s)
  if (!list.length) return u
  let t = s.turn % list.length
  let round = s.round
  const skips = (i: number) => sideOf(u, list[i]) === 'inimigos' && isDown(u, list[i])
  for (let step = 0; step < list.length; step++) {
    t += dir
    if (t >= list.length) {
      t = 0
      round += 1
    } else if (t < 0) {
      t = list.length - 1
      round = Math.max(1, round - 1)
    }
    if (!skips(t)) break
  }
  return round <= s.round ? patch(u, 'sessions', s.id, { turn: t, round }) : turnRound(u, s.id, round, { turn: t }, now)
}

/** Por lados: alguém terminou de agir. Acabando um lado, vem o outro; acabando os dois, vira a rodada. */
export function actedSide(u: Universe, sessionId: string, entryIds: string[], now = new Date()): Universe {
  const s = byId(u, 'sessions', sessionId)
  if (!s) return u
  const acted = [...new Set([...s.acted, ...entryIds.filter((id) => s.initiative.some((e) => e.id === id))])]
  let next = patch(u, 'sessions', s.id, { acted })
  if (!sideTurn(next, byId(next, 'sessions', s.id)!)) next = turnRound(next, s.id, s.round + 1, { acted: [] }, now)
  const now2 = byId(next, 'sessions', s.id)!
  const turn = sideTurn(next, now2)
  return patch(next, 'sessions', s.id, { turnId: turn?.side === 'inimigos' ? turn.pending[0].id : null })
}

/** Pipoca: quem agiu passa a vez para alguém. Se todos já agiram, a rodada vira. */
export function passTo(u: Universe, sessionId: string, toId: string, now = new Date()): Universe {
  const s = byId(u, 'sessions', sessionId)
  if (!s) return u
  const { next, newRound } = popcornChoices(u, s)
  if (!next.some((e) => e.id === toId)) return u
  const to = s.initiative.find((e) => e.id === toId)!
  const from = s.initiative.find((e) => e.id === s.turnId)
  const line = { id: newId(), at: at(now), text: from ? `${from.name} passa a vez para ${to.name}.` : `${to.name} começa.`, kind: 'nota' as const }
  if (newRound) return turnRound(patch(u, 'sessions', s.id, { log: [...s.log, line] }), s.id, s.round + 1, { acted: [], turnId: toId }, now)
  return patch(u, 'sessions', s.id, { acted: s.turnId ? [...s.acted, s.turnId] : s.acted, turnId: toId, log: [...s.log, line] })
}

/** Alguém disse "Terminei" (pelo celular ou pelo mestre). Na clássica, passa a vez se era dele; por lados, marca. */
export function finishedTurn(u: Universe, sessionId: string, entryId: string, now = new Date()): Universe {
  const s = byId(u, 'sessions', sessionId)
  if (!s || fightPhase(s) !== 'turnos') return u
  if (s.fightMode === 'lados') return actedSide(u, sessionId, [entryId], now)
  if (s.fightMode === 'classica') return currentId(s) === entryId ? nextTurn(u, sessionId, 1, now) : u
  return u
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
export function defineTurns(u: Universe, sessionId: string, now = new Date(), startId?: string): Universe {
  const s = byId(u, 'sessions', sessionId)
  if (!s || !s.initiative.length || waitingFor(s).length) return u
  const closed = s.requests.map((r) => (r.kind === 'iniciativa' ? { ...r, open: false } : r))
  if (s.fightMode === 'lados') {
    if (!s.sides) return u
    const first = firstSide(s)
    const text = `Por lados: heróis ${s.sides.heroes} × inimigos ${s.sides.foes}. Começam os ${first === 'herois' ? 'heróis' : 'inimigos'}.`
    const v = patch(u, 'sessions', s.id, { fight: 'turnos', turn: 0, round: 1, acted: [], requests: closed, log: [...s.log, { id: newId(), at: clock(now), text, kind: 'nota' }] })
    const turn = sideTurn(v, byId(v, 'sessions', s.id)!)
    return patch(v, 'sessions', s.id, { turnId: turn?.side === 'inimigos' ? turn.pending[0].id : null })
  }
  if (s.fightMode === 'pipoca') {
    const start = s.initiative.find((e) => e.id === startId)
    if (!start) return u
    return patch(u, 'sessions', s.id, { fight: 'turnos', turn: 0, round: 1, acted: [], turnId: start.id, requests: closed, log: [...s.log, { id: newId(), at: clock(now), text: `Pipoca: começa ${start.name}.`, kind: 'nota' }] })
  }
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
    sides: null,
    turnId: null,
    acted: [],
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

/** Alguém sai do combate. A vez fica com quem estava agindo (ou passa adiante, se era quem saiu). */
export function removeFromFight(u: Universe, sessionId: string, entryId: string): Universe {
  const s = byId(u, 'sessions', sessionId)
  if (!s) return u
  const initiative = s.initiative.filter((e) => e.id !== entryId)
  if (s.fightMode === 'classica') {
    const list = initiativeOrder(s)
    const i = list.findIndex((e) => e.id === entryId)
    const turn = list.length ? s.turn % list.length : 0
    return patch(u, 'sessions', s.id, { initiative, turn: i < turn ? Math.max(0, turn - 1) : initiative.length ? turn % initiative.length : 0 })
  }
  const next = patch(u, 'sessions', s.id, { initiative, acted: s.acted.filter((id) => id !== entryId), turnId: s.turnId === entryId ? null : s.turnId })
  if (s.fightMode !== 'lados' || fightPhase(s) !== 'turnos') return next
  const turn = sideTurn(next, byId(next, 'sessions', s.id)!)
  return patch(next, 'sessions', s.id, { turnId: turn?.side === 'inimigos' ? turn.pending[0].id : null })
}

/** Como a fila de turnos aparece: quem age, quem vem e quem já agiu nesta rodada. */
export type QueueSpot = { entry: Entry; state: 'agora' | 'depois' | 'agiu'; side: Side }

export function turnQueue(u: Universe, s: Session): QueueSpot[] {
  const spot = (e: Entry, state: QueueSpot['state']): QueueSpot => ({ entry: e, state, side: sideOf(u, e) })
  if (s.fightMode === 'classica') {
    const order = initiativeOrder(s)
    if (!order.length) return []
    const t = s.turn % order.length
    // A partir de quem age, dando a volta.
    return [...order.slice(t), ...order.slice(0, t)].map((e, i) => spot(e, i === 0 ? 'agora' : 'depois'))
  }
  if (s.fightMode === 'lados') {
    const turn = sideTurn(u, s)
    const first = firstSide(s)
    const sides: Side[] = [first, first === 'herois' ? 'inimigos' : 'herois']
    const ordered = sides.flatMap((side) => s.initiative.filter((e) => sideOf(u, e) === side))
    const pending = ordered.filter((e) => !s.acted.includes(e.id))
    const done = ordered.filter((e) => s.acted.includes(e.id))
    return [...pending.map((e) => spot(e, turn && (turn.side === 'herois' ? sideOf(u, e) === 'herois' : e.id === s.turnId) ? 'agora' : 'depois')), ...done.map((e) => spot(e, 'agiu'))]
  }
  const now = s.initiative.find((e) => e.id === s.turnId)
  return [
    ...(now ? [spot(now, 'agora')] : []),
    ...s.initiative.filter((e) => e.id !== s.turnId && !s.acted.includes(e.id)).map((e) => spot(e, 'depois')),
    ...s.initiative.filter((e) => e.id !== s.turnId && s.acted.includes(e.id)).map((e) => spot(e, 'agiu')),
  ]
}

/**
 * Um jogador disse "Terminei" pelo celular. Só vale se for mesmo a vez dele: na clássica e na
 * pipoca, se é ele quem age; por lados, se é a vez dos heróis e ele ainda não agiu.
 */
export function playerTurn(u: Universe, groupId: string, who: string, to?: string, now = new Date()): Universe {
  const s = u.sessions.find((x) => x.groupId === groupId && x.status === 'em-andamento')
  if (!s || fightPhase(s) !== 'turnos') return u
  const me = s.initiative.find((e) => e.name === who && sideOf(u, e) === 'herois')
  if (!me) return u
  if (s.fightMode === 'pipoca') return currentId(s) === me.id && to ? passTo(u, s.id, to, now) : u
  if (s.fightMode === 'lados') return sideTurn(u, s)?.side === 'herois' && !s.acted.includes(me.id) ? actedSide(u, s.id, [me.id], now) : u
  return currentId(s) === me.id ? nextTurn(u, s.id, 1, now) : u
}
