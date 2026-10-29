import { describe, expect, it } from 'vitest'
import type { Universe } from '../model/schema'
import { byId, createUniverse, draftGroup, insert, patch } from '../model/universe'
import { askRoll, closeRequest, judge, openRequests, recordResult, requestLabel, requestTargets, rollFor } from './requests'
import { resolveRoll } from './rolls'
import { beginSession, setAttendance } from './sessionLife'
import { draftSheet } from './sheets'
import { makeSystem } from './systems'

const fixed = (values: number[]) => {
  let i = 0
  return () => values[i++ % values.length]
}
const d20 = (n: number) => fixed([(n - 0.5) / 20])

function table() {
  let u: Universe = createUniverse('Ostria')
  const sys = makeSystem('d20-5e')
  let system, g
  ;[u, system] = insert(u, 'systems', sys)
  ;[u, g] = insert(u, 'groups', draftGroup('Mesa de sexta', system.id))
  let brisa, taren, ilmar
  ;[u, brisa] = insert(u, 'sheets', draftSheet('Brisa', system, { groupId: g.id, player: 'Ana' }))
  ;[u, taren] = insert(u, 'sheets', draftSheet('Taren', system, { groupId: g.id, player: 'Bruno' }))
  ;[u, ilmar] = insert(u, 'sheets', draftSheet('Ilmar', system, { groupId: g.id, player: 'Carla' }))
  let id
  ;[u, id] = beginSession(u, g.id, null)
  return { u, system, id, brisa, taren, ilmar }
}

describe('pedir teste', () => {
  it('para todos que jogam: quem ficou de fora não rola; quem o mestre conduz, sim', () => {
    let { u, id, brisa, taren, ilmar } = table()
    u = setAttendance(u, id, taren.id, 'fora')
    u = setAttendance(u, id, ilmar.id, 'mestre')
    const [next, req] = askRoll(u, id, { kind: 'pericia', name: 'Percepção', dc: 15, sheetIds: [] })
    const s = byId(next, 'sessions', id)!
    expect(requestTargets(next, s, req!).map((p) => p.name)).toEqual(['Brisa', 'Ilmar'])
    expect(s.log.at(-1)!.text).toBe('Teste pedido: Percepção · CD 15 — todos')
    const [only] = askRoll(next, id, { kind: 'atributo', name: 'Força', dc: null, sheetIds: [brisa.id] })
    expect(byId(only, 'sessions', id)!.log.at(-1)!.text).toBe('Teste pedido: Força — Brisa')
  })

  it('a dificuldade diz quem passou; o último resultado de cada um vale', () => {
    let { u, system, id, brisa } = table()
    let req
    ;[u, req] = askRoll(u, id, { kind: 'livre', name: 'Sorte', expression: '1d20', dc: 12, sheetIds: [] })
    u = recordResult(u, id, req!.id, brisa, resolveRoll(system, 'Sorte', '1d20', undefined, d20(8)), 'jogador', system)
    u = recordResult(u, id, req!.id, brisa, resolveRoll(system, 'Sorte', '1d20', undefined, d20(15)), 'mestre', system)
    const r = byId(u, 'sessions', id)!.requests[0]
    expect(r.results).toHaveLength(1)
    expect(r.results[0]).toMatchObject({ sheetId: brisa.id, total: 15, pass: true, verdict: 'Passou', by: 'mestre' })
    expect(byId(u, 'sessions', id)!.log.at(-1)!.text).toContain('Brisa — Sorte: 15')
    expect(byId(u, 'sessions', id)!.log.at(-1)!.text).toContain('passou')
    u = closeRequest(u, id, req!.id)
    expect(openRequests(byId(u, 'sessions', id))).toEqual([])
  })

  it('sem dificuldade, o mestre decide; nos sucessos, conta quantos', () => {
    const total = makeSystem('d20-5e')
    expect(judge(total, resolveRoll(total, 'x', '1d20', undefined, d20(3)), null)).toEqual({ pass: null, verdict: null })
    const pool = makeSystem('parada')
    const o = resolveRoll(pool, 'x', '3d10', undefined, fixed([0.95, 0.95, 0.05]))
    expect(judge(pool, o, 2).pass).toBe(true)
    expect(judge(pool, o, 3).pass).toBe(false)
  })

  it('o mestre rola por alguém pela ficha', () => {
    const { u, system, id, brisa } = table()
    const [next, req] = askRoll(u, id, { kind: 'pericia', name: system.skills[0].name, dc: null, sheetIds: [] })
    const o = rollFor(system, brisa, req!, d20(10))
    expect(o?.label).toBe(system.skills[0].name)
    expect(requestLabel(req!, system)).toBe(system.skills[0].name)
    expect(patch(next, 'sessions', id, {})).toBeTruthy()
  })
})
