import { describe, expect, it } from 'vitest'
import type { Universe } from '../model/schema'
import { byId, createUniverse, draftGroup, insert } from '../model/universe'
import { addCondition, applyDamage, conditionsOf, expireEffects, initiativeOrder, isDown, lifeBefore, lifeOf, restoreLife, roundsLeft } from './combat'
import { currentId, defineTurns, joinFight, nextTurn, removeFromFight, setInitiative, startFight, turnQueue, waitingFor } from './fight'
import { beginSession } from './sessionLife'
import { draftSheet } from './sheets'
import { makeSystem } from './systems'

/** Uma mesa com 3 heróis e 12 goblins: 15 no combate, com os turnos já definidos. */
function luta() {
  let u: Universe = createUniverse('Ostria')
  let system, g
  ;[u, system] = insert(u, 'systems', makeSystem('d20-5e'))
  ;[u, g] = insert(u, 'groups', draftGroup('Mesa', system.id))
  for (const n of ['Brisa', 'Taren', 'Ilmar']) [u] = insert(u, 'sheets', draftSheet(n, system, { groupId: g.id, player: n }))
  let id
  ;[u, id] = beginSession(u, g.id, null)
  u = startFight(u, id, system)
  // Iniciativas todas diferentes (de 30 para baixo), para a ordem ser previsível.
  let v = 30
  for (let i = 1; i <= 12; i++) u = joinFight(u, id, `Goblin ${i}`, system, { hp: '7/7' }, v--)
  for (const e of waitingFor(byId(u, 'sessions', id)!)) u = setInitiative(u, id, e.id, v--)
  u = defineTurns(u, id)
  return { u, id, system }
}
const sess = (u: Universe, id: string) => byId(u, 'sessions', id)!

describe('um combate com 15', () => {
  it('os 15 entram na ordem, cada um com a sua vez', () => {
    const { u, id } = luta()
    expect(sess(u, id).initiative).toHaveLength(15)
    expect(initiativeOrder(sess(u, id))).toHaveLength(15)
    expect(turnQueue(u, sess(u, id))).toHaveLength(15)
    expect(new Set(sess(u, id).initiative.map((e) => e.name)).size).toBe(15)
  })

  it('passar o turno 15 vezes dá a volta: cada um age uma vez e a rodada 2 começa pelo primeiro', () => {
    let { u, id } = luta()
    const primeiro = currentId(sess(u, id))
    const vistos: string[] = []
    for (let i = 0; i < 15; i++) {
      vistos.push(currentId(sess(u, id))!)
      u = nextTurn(u, id, 1)
    }
    expect(new Set(vistos).size).toBe(15)
    expect(sess(u, id).round).toBe(2)
    expect(currentId(sess(u, id))).toBe(primeiro)
    // E voltar uma vez devolve a vez anterior (e a rodada 1).
    u = nextTurn(u, id, -1)
    expect(sess(u, id).round).toBe(1)
    expect(currentId(sess(u, id))).toBe(vistos[14])
  })

  it('o dano tira só da vida de quem foi atingido e o "Desfazer" devolve exatamente o que era', () => {
    let { u, id } = luta()
    const goblins = sess(u, id).initiative.filter((e) => e.name.startsWith('Goblin'))
    const alvo = goblins[4]
    const antes = lifeBefore(u, id, alvo.id)!
    const hit = applyDamage(u, id, alvo.id, 5)!
    expect(hit).toMatchObject({ name: alvo.name, current: 2, max: 7, down: false })
    u = hit.universe
    // Os outros 14 ficam como estavam.
    for (const e of sess(u, id).initiative) if (e.id !== alvo.id) expect(e.hp).toBe(sess(hit.universe, id).initiative.find((x) => x.id === e.id)!.hp)
    expect(goblins.filter((e) => e.id !== alvo.id).every((e) => lifeOf(u, sess(u, id).initiative.find((x) => x.id === e.id)!)!.current === 7)).toBe(true)
    // Dano que derruba.
    const kill = applyDamage(u, id, alvo.id, 9)!
    expect(isDown(kill.universe, sess(kill.universe, id).initiative.find((e) => e.id === alvo.id)!)).toBe(true)
    // Desfazer: a vida volta ao que era antes de tudo.
    const volta = restoreLife(kill.universe, id, antes)
    expect(lifeOf(volta, sess(volta, id).initiative.find((e) => e.id === alvo.id)!)).toMatchObject({ current: 7, max: 7 })
  })

  it('várias condições com duração: cada uma acaba na sua rodada, só em quem a tem', () => {
    let { u, id } = luta()
    const [a, b, c] = sess(u, id).initiative.filter((e) => e.name.startsWith('Goblin'))
    u = addCondition(u, id, a.id, 'Atordoado', 1)
    u = addCondition(u, id, b.id, 'Caído', 2)
    u = addCondition(u, id, c.id, 'Atordoado', null)
    expect(roundsLeft(sess(u, id), a.id, 'Atordoado')).toBe(1)
    expect(roundsLeft(sess(u, id), b.id, 'Caído')).toBe(2)
    expect(roundsLeft(sess(u, id), c.id, 'Atordoado')).toBeNull()
    // Uma volta inteira: a rodada 2 começa e a condição de 1 rodada acaba sozinha (com a linha no registro).
    for (let i = 0; i < 15; i++) u = nextTurn(u, id, 1)
    expect(sess(u, id).round).toBe(2)
    const log = () => sess(u, id).log.map((l) => l.text)
    expect(log()).toContain(`Atordoado acabou em ${a.name}.`)
    expect(conditionsOf(u, sess(u, id).initiative.find((e) => e.id === a.id)!)).toEqual([])
    expect(conditionsOf(u, sess(u, id).initiative.find((e) => e.id === b.id)!)).toEqual(['Caído'])
    expect(roundsLeft(sess(u, id), b.id, 'Caído')).toBe(1)
    // Mais uma volta: a de 2 rodadas acaba; a "até tirar" continua, e nada acaba duas vezes.
    for (let i = 0; i < 15; i++) u = nextTurn(u, id, 1)
    expect(log()).toContain(`Caído acabou em ${b.name}.`)
    expect(log().filter((t) => t.includes('acabou em'))).toHaveLength(2)
    expect(conditionsOf(u, sess(u, id).initiative.find((e) => e.id === b.id)!)).toEqual([])
    expect(conditionsOf(u, sess(u, id).initiative.find((e) => e.id === c.id)!)).toEqual(['Atordoado'])
  })

  it('tirar alguém no meio do combate não perde a vez de ninguém', () => {
    let { u, id } = luta()
    const ordem = turnQueue(u, sess(u, id)).map((q) => q.entry.id)
    // Tira o terceiro e o último da ordem.
    u = removeFromFight(u, id, ordem[2])
    u = removeFromFight(u, id, ordem[14])
    expect(sess(u, id).initiative).toHaveLength(13)
    const vistos: string[] = []
    for (let i = 0; i < 13; i++) {
      vistos.push(currentId(sess(u, id))!)
      u = nextTurn(u, id, 1)
    }
    expect(new Set(vistos).size).toBe(13)
    expect(vistos).not.toContain(ordem[2])
    expect(sess(u, id).round).toBe(2)
  })

  it('fazer tudo isso num combate de 40 é rápido (o custo não explode com o tamanho)', () => {
    let { u, id, system } = luta()
    for (let i = 1; i <= 25; i++) u = joinFight(u, id, `Lobo ${i}`, system, { hp: '11/11' }, 100 + i)
    expect(sess(u, id).initiative).toHaveLength(40)
    const t0 = performance.now()
    for (let r = 0; r < 3; r++) {
      for (let i = 0; i < 40; i++) {
        const alvo = sess(u, id).initiative[(i * 7) % 40]
        u = applyDamage(u, id, alvo.id, 1)?.universe ?? u
        u = nextTurn(u, id, 1)
      }
      u = addCondition(u, id, sess(u, id).initiative[r].id, 'Atordoado', 1)
      u = expireEffects(u, id).universe
    }
    // 120 passadas de turno, 120 danos e 3 condições: bem menos de um segundo (no node, sem CPU lenta).
    expect(performance.now() - t0).toBeLessThan(1000)
  })
})
