import { describe, expect, it } from 'vitest'
import type { Universe } from '../model/schema'
import { createUniverse, draftGroup, draftSession, insert, newId, patch } from '../model/universe'
import { applyDamage, combatTargets, hurtHp, isDown, lifeOf, parseHp } from './combat'
import { aimAt, critDamage, damageAfter, describeOutcome, landed, physicalRoll, resolveRoll, type CombatTarget } from './rolls'
import { critMult, defenseLabel, draftSheet } from './sheets'
import { makeSystem } from './systems'

const fixed = (values: number[]) => {
  let i = 0
  return () => values[i++ % values.length]
}
/** O d20 sai com o número pedido. */
const d20 = (n: number) => fixed([(n - 0.5) / 20])
const goblin: CombatTarget = { id: 'g', name: 'Goblin', defense: 14, defenseLabel: 'Defesa' }

describe('ataque contra um alvo', () => {
  const sys = makeSystem('t20')
  const test = (n: number, bonus = 7, critFrom = 20) => aimAt(resolveRoll(sys, 'Espada longa', `1d20${bonus >= 0 ? `+${bonus}` : bonus}`, undefined, d20(n), critFrom), { target: goblin, damage: { expression: '1d8+4', mult: 2 } })

  it('acerta quando o total alcança a Defesa e erra quando não', () => {
    expect(test(7).verdict).toBe('Acerta')
    expect(test(7).label).toBe('Espada longa contra Goblin')
    expect(test(6).verdict).toBe('Erra')
    expect(test(6).tone).toBe('falha')
  })

  it('20 natural sempre acerta, 1 natural sempre erra', () => {
    expect(test(20, -10).verdict).toBe('Crítico! Acerta')
    expect(test(1, 30).verdict).toBe('Erra (1 natural)')
  })

  it('a margem de crítico só vale se acertar', () => {
    expect(test(19, 7, 19).verdict).toBe('Crítico! Acerta')
    expect(test(19, -10, 19).verdict).toBe('Erra')
  })

  it('sem a Defesa do alvo, só soma', () => {
    const o = aimAt(resolveRoll(sys, 'Arco', '1d20+3', undefined, d20(10)), { target: { ...goblin, defense: null }, damage: { expression: '1d6', mult: 3 } })
    expect(o.verdict).toBeNull()
    expect(landed(o)).toBe(true)
  })

  it('o dado físico refaz a conta e mantém o alvo', () => {
    const o = physicalRoll(sys, test(2), [15])
    expect(o.result.total).toBe(22)
    expect(o.verdict).toBe('Acerta')
    expect(o.combat?.target.name).toBe('Goblin')
    expect(describeOutcome(o, 'Kaya')).toBe('Kaya — Espada longa contra Goblin (Defesa 14): 22 (Acerta) · 1d20+7 [15] · dado físico')
  })

  it('depois de acertar vem o dano; no crítico, os dados dobram', () => {
    expect(damageAfter(sys, test(6))).toBeNull()
    const dmg = damageAfter(sys, test(7), fixed([0.5]))!
    expect(dmg.expression).toBe('1d8+4')
    expect(dmg.label).toBe('Espada longa (dano) em Goblin')
    expect(dmg.combat?.hurts).toBe(true)
    expect(damageAfter(sys, test(20), fixed([0.5]))!.expression).toBe('2d8+4')
  })

  it('multiplicador e dados do crítico', () => {
    expect(critMult('19/x3')).toBe(3)
    expect(critMult('19')).toBe(2)
    expect(critDamage('1d8+2d6+4', 2)).toBe('2d8+4d6+4')
    expect(critDamage('d12-1', 3)).toBe('3d12-1')
  })

  it('o nome da Defesa segue o sistema', () => {
    expect(defenseLabel(makeSystem('t20'))).toBe('Defesa')
    expect(defenseLabel(makeSystem('d20-5e'))).toBe('CA')
  })
})

describe('vida na iniciativa', () => {
  it('lê e desconta o PV anotado à mão', () => {
    expect(parseHp('7')).toEqual({ current: 7, max: null })
    expect(parseHp(' 3 / 7 ')).toEqual({ current: 3, max: 7 })
    expect(parseHp('muito')).toBeNull()
    expect(hurtHp('7', -9)).toBe('-2/7')
    expect(hurtHp('3/7', -2)).toBe('1/7')
    expect(hurtHp('3/7', 10)).toBe('7/7')
    expect(hurtHp('', -2)).toBeNull()
  })

  const setup = () => {
    const sys = makeSystem('t20')
    let u: Universe = { ...createUniverse('Teste'), systems: [sys] }
    let groupId = ''
    ;[u, { id: groupId }] = insert(u, 'groups', draftGroup('Mesa', sys.id))
    const pv = sys.resources.find((r) => r.abbr === 'PV')!.id
    const def = sys.resources.find((r) => r.abbr === 'DEF')!.id
    let kayaId = ''
    ;[u, { id: kayaId }] = insert(u, 'sheets', { ...draftSheet('Kaya', sys, { groupId }), resources: { [pv]: { current: 24, max: 31 }, [def]: { current: 17, max: 17 } } })
    let sessionId = ''
    ;[u, { id: sessionId }] = insert(u, 'sessions', draftSession(1, groupId))
    const kaya = { id: newId(), name: 'Kaya', value: 18, hp: '', note: '', sheetId: kayaId, defense: null, attacks: [], monsterId: null, conditions: [] }
    const gob = { id: newId(), name: 'Goblin', value: 12, hp: '7', note: '', sheetId: null, defense: 14, attacks: [], monsterId: null, conditions: [] }
    u = patch(u, 'sessions', sessionId, { status: 'em-andamento', initiative: [gob, kaya] })
    return { u, sys, sessionId, kaya, gob, kayaId }
  }

  it('lista os alvos na ordem, com a Defesa da ficha ou a anotada', () => {
    const { u, sys, sessionId, kayaId } = setup()
    const session = u.sessions.find((s) => s.id === sessionId)!
    expect(combatTargets(u, session, sys).map((t) => [t.name, t.defense])).toEqual([
      ['Kaya', 17],
      ['Goblin', 14],
    ])
    expect(combatTargets(u, session, sys, { sheetId: kayaId }).map((t) => t.name)).toEqual(['Goblin'])
  })

  it('o dano sai da ficha ou do PV anotado, e quem chega a zero é derrotado', () => {
    const { u, sessionId, kaya, gob } = setup()
    const hitKaya = applyDamage(u, sessionId, kaya.id, 5)!
    expect([hitKaya.current, hitKaya.max, hitKaya.down]).toEqual([19, 31, false])
    const hitGob = applyDamage(hitKaya.universe, sessionId, gob.id, 9)!
    expect([hitGob.current, hitGob.max, hitGob.down]).toEqual([-2, 7, true])
    const after = hitGob.universe.sessions.find((s) => s.id === sessionId)!.initiative.find((e) => e.id === gob.id)!
    expect(after.hp).toBe('-2/7')
    expect(isDown(hitGob.universe, after)).toBe(true)
    expect(lifeOf(hitGob.universe, after)).toEqual({ current: -2, max: 7, abbr: 'PV' })
  })

  it('sem PV anotado, não há o que descontar', () => {
    const { u, sessionId, gob } = setup()
    const blank = patch(u, 'sessions', sessionId, { initiative: u.sessions.find((s) => s.id === sessionId)!.initiative.map((e) => (e.id === gob.id ? { ...e, hp: '' } : e)) })
    expect(applyDamage(blank, sessionId, gob.id, 3)).toBeNull()
  })
})
