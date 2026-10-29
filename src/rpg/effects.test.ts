import { describe, expect, it } from 'vitest'
import { byId, createUniverse, draftGroup, insert, patch } from '../model/universe'
import { addCondition, applyDamage, conditionsOf, expireEffects, lifeBefore, removeCondition, restoreLife, roundsLeft } from './combat'
import { beginSession } from './sessionLife'
import { draftSheet } from './sheets'
import { makeSystem } from './systems'

function combat() {
  let u = createUniverse('Ostria')
  let system, g, kaya
  ;[u, system] = insert(u, 'systems', makeSystem('d20-5e'))
  ;[u, g] = insert(u, 'groups', draftGroup('Mesa', system.id))
  ;[u, kaya] = insert(u, 'sheets', draftSheet('Kaya', system, { groupId: g.id }))
  let id
  ;[u, id] = beginSession(u, g.id, null)
  const gob = { id: 'gob', name: 'Goblin', value: 5, hp: '7/7', note: '', sheetId: null, defense: 12, attacks: [], monsterId: null, conditions: [], rolled: true }
  const k = { id: 'k', name: 'Kaya', value: 15, hp: '', note: '', sheetId: kaya.id, defense: null, attacks: [], monsterId: null, conditions: [], rolled: true }
  u = patch(u, 'sessions', id, { initiative: [k, gob] })
  return { u, id, kaya }
}

describe('condições com duração', () => {
  it('quem tem ficha guarda na ficha; quem não tem, no combatente', () => {
    let { u, id, kaya } = combat()
    u = addCondition(u, id, 'k', 'Atordoado', null)
    u = addCondition(u, id, 'gob', 'Caído', 2)
    expect(byId(u, 'sheets', kaya.id)!.conditions).toEqual(['Atordoado'])
    const s = byId(u, 'sessions', id)!
    expect(conditionsOf(u, s.initiative[1])).toEqual(['Caído'])
    expect(roundsLeft(s, 'gob', 'Caído')).toBe(2)
    expect(roundsLeft(s, 'k', 'Atordoado')).toBeNull()
  })

  it('acabam sozinhas quando chega a rodada, e dizem o quê', () => {
    let { u, id } = combat()
    u = addCondition(u, id, 'gob', 'Caído', 2)
    u = patch(u, 'sessions', id, { round: 2 })
    expect(expireEffects(u, id).ended).toEqual([])
    u = patch(u, 'sessions', id, { round: 3 })
    const { universe, ended } = expireEffects(u, id)
    expect(ended).toEqual(['Caído acabou em Goblin.'])
    expect(byId(universe, 'sessions', id)!.initiative[1].conditions).toEqual([])
    expect(byId(universe, 'sessions', id)!.effects).toEqual([])
  })

  it('tirar à mão também tira a contagem', () => {
    let { u, id, kaya } = combat()
    u = addCondition(u, id, 'k', 'Envenenado', 3)
    u = removeCondition(u, id, 'k', 'Envenenado')
    expect(byId(u, 'sheets', kaya.id)!.conditions).toEqual([])
    expect(byId(u, 'sessions', id)!.effects).toEqual([])
  })
})

describe('desfazer o dano', () => {
  it('a vida volta como estava, com ou sem ficha', () => {
    let { u, id, kaya } = combat()
    const beforeGob = lifeBefore(u, id, 'gob')!
    const beforeKaya = lifeBefore(u, id, 'k')!
    u = applyDamage(u, id, 'gob', 9)!.universe
    u = applyDamage(u, id, 'k', 4)!.universe
    expect(byId(u, 'sessions', id)!.initiative[1].hp).toBe('-2/7')
    u = restoreLife(u, id, beforeGob)
    u = restoreLife(u, id, beforeKaya)
    expect(byId(u, 'sessions', id)!.initiative[1].hp).toBe('7/7')
    expect(byId(u, 'sheets', kaya.id)!.resources).toEqual(beforeKaya && 'resources' in beforeKaya ? beforeKaya.resources : {})
  })
})
