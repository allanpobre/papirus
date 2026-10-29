import { describe, expect, it } from 'vitest'
import type { Universe } from '../model/schema'
import { byId, createUniverse, draftGroup, insert, patch } from '../model/universe'
import { codexSnapshot } from '../share/snapshot'
import { initiativeOrder } from './combat'
import { defineTurns, endFight, fightPhase, joinFight, setInitiative, startFight, waitingFor } from './fight'
import { openRequests, recordResult } from './requests'
import { resolveRoll } from './rolls'
import { beginSession, setAttendance } from './sessionLife'
import { draftSheet } from './sheets'
import { makeSystem } from './systems'

const d20 = (n: number) => () => (n - 0.5) / 20

function table() {
  let u: Universe = createUniverse('Ostria')
  let system, g
  ;[u, system] = insert(u, 'systems', makeSystem('d20-5e'))
  ;[u, g] = insert(u, 'groups', draftGroup('Mesa de sexta', system.id))
  let brisa, taren, ilmar
  ;[u, brisa] = insert(u, 'sheets', draftSheet('Brisa', system, { groupId: g.id, player: 'Ana' }))
  ;[u, taren] = insert(u, 'sheets', draftSheet('Taren', system, { groupId: g.id, player: 'Bruno' }))
  ;[u, ilmar] = insert(u, 'sheets', draftSheet('Ilmar', system, { groupId: g.id, player: 'Carla' }))
  let id
  ;[u, id] = beginSession(u, g.id, null)
  return { u, system, g, id, brisa, taren, ilmar }
}

describe('combate em passos', () => {
  it('começar: quem veio espera a iniciativa e recebe o pedido; quem o mestre conduz já entra rolado; quem ficou de fora não entra', () => {
    let { u, system, id, taren, ilmar } = table()
    u = setAttendance(u, id, taren.id, 'fora')
    u = setAttendance(u, id, ilmar.id, 'mestre')
    expect(fightPhase(byId(u, 'sessions', id))).toBe('fora')
    u = startFight(u, id, system, new Date(), d20(10))
    const s = byId(u, 'sessions', id)!
    expect(fightPhase(s)).toBe('iniciativa')
    expect(s.initiative.map((e) => [e.name, e.rolled])).toEqual([
      ['Brisa', false],
      ['Ilmar', true],
    ])
    const [req] = openRequests(s)
    expect(req.kind).toBe('iniciativa')
    expect(req.sheetIds).toEqual([s.initiative[0].sheetId])
    expect(s.log.at(-1)!.text).toBe('Combate! Rolem a iniciativa.')
  })

  it('a rolagem do jogador vai para o lugar dele; "Definir turnos" só com todos rolados, e aí o celular vê a ordem', () => {
    let { u, system, g, id, brisa } = table()
    u = startFight(u, id, system)
    u = joinFight(u, id, 'Goblin', system, {}, 12)
    expect(defineTurns(u, id)).toBe(u)
    expect(codexSnapshot(u, g.id).combat).toBeNull()

    const req = openRequests(byId(u, 'sessions', id)!)[0]
    u = recordResult(u, id, req.id, brisa, resolveRoll(system, 'Iniciativa', '1d20+2', undefined, d20(16)), 'jogador', system)
    let s = byId(u, 'sessions', id)!
    expect(s.initiative.find((e) => e.name === 'Brisa')).toMatchObject({ value: 18, rolled: true })
    expect(s.requests[0].results[0].pass).toBeNull()
    for (const e of waitingFor(s)) u = setInitiative(u, id, e.id, e.name === 'Taren' ? 20 : 3)
    // O mestre rolou por Taren e Ilmar: o pedido deles conta como respondido.
    expect(byId(u, 'sessions', id)!.requests[0].results.map((r) => [r.total, r.by])).toEqual([
      [18, 'jogador'],
      [20, 'mestre'],
      [3, 'mestre'],
    ])

    u = defineTurns(u, id)
    s = byId(u, 'sessions', id)!
    expect(fightPhase(s)).toBe('turnos')
    expect(openRequests(s)).toEqual([])
    expect(s.log.at(-1)!.text).toBe('Ordem da iniciativa: Taren 20 · Brisa 18 · Goblin 12 · Ilmar 3')
    expect(codexSnapshot(u, g.id).combat?.order.map((e) => e.name)).toEqual(['Taren', 'Brisa', 'Goblin', 'Ilmar'])
  })

  it('quem entra com os turnos andando não toma a vez de quem está jogando', () => {
    let { u, system, id } = table()
    u = joinFight(u, id, 'Bandido', system, {}, 10)
    u = joinFight(u, id, 'Goblin', system, {}, 5)
    u = patch(u, 'sessions', id, { turn: 1 })
    u = joinFight(u, id, 'Lobo', system, {}, 15)
    const s = byId(u, 'sessions', id)!
    expect(initiativeOrder(s)[s.turn].name).toBe('Goblin')
  })

  it('encerrar limpa a iniciativa, o pedido e as condições com duração; combates antigos (sem fase) estão em turnos', () => {
    let { u, system, id } = table()
    u = startFight(u, id, system)
    u = endFight(u, id)
    const s = byId(u, 'sessions', id)!
    expect(fightPhase(s)).toBe('fora')
    expect(s.initiative).toEqual([])
    expect(openRequests(s)).toEqual([])
    const old = patch(u, 'sessions', id, { fight: '', initiative: [{ ...joinFight(u, id, 'Goblin', system, {}, 3).sessions.find((x) => x.id === id)!.initiative[0] }] })
    expect(fightPhase(byId(old, 'sessions', id))).toBe('turnos')
  })
})
