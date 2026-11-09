import { describe, expect, it } from 'vitest'
import { byId, createUniverse, draftEntity, draftGroup, draftSession, insert, patch } from '../model/universe'
import { creaturesToAdd, monsterFromCreature } from './bestiary'
import { linkPlayerSheets, linkToWorld, sessionsOf, sheetsOf, worldMatch } from './oneCharacter'
import { draftSheet } from './sheets'

const base = () => {
  const [u, g] = insert(createUniverse('Ostria'), 'groups', draftGroup('Grupo de sexta'))
  return { u, groupId: g.id }
}

describe('um personagem só', () => {
  it('personagem de jogador novo ganha a ficha no Mundo, ou liga à de mesmo nome (ou apelido)', () => {
    let { u, groupId } = base()
    let kaya
    ;[u, kaya] = insert(u, 'sheets', draftSheet('Kaya', null, { role: 'pj', groupId, player: 'Ana' }))
    u = linkToWorld(u, kaya.id)
    const linked = byId(u, 'sheets', kaya.id)!
    expect(linked.entityId).not.toBeNull()
    expect(byId(u, 'entities', linked.entityId!)).toMatchObject({ kind: 'personagem', name: 'Kaya' })

    // Já existe "Brenn" no Mundo, com o apelido "Capitão": liga, sem criar outra ficha.
    let brenn
    ;[u, brenn] = insert(u, 'entities', { ...draftEntity('personagem', 'Brenn'), aliases: ['Capitão'] })
    let capitao
    ;[u, capitao] = insert(u, 'sheets', draftSheet('capitão', null, { role: 'pj', groupId }))
    const before = u.entities.length
    u = linkToWorld(u, capitao.id)
    expect(u.entities.length).toBe(before)
    expect(byId(u, 'sheets', capitao.id)!.entityId).toBe(brenn.id)
    expect(worldMatch(u, 'BRENN')).toBe(brenn.id)
    expect(sheetsOf(u, brenn.id).map((s) => s.id)).toEqual([capitao.id])
  })

  it('os personagens de jogador antigos ganham a ficha no Mundo; os NPCs ficam como estão', () => {
    let { u, groupId } = base()
    ;[u] = insert(u, 'sheets', draftSheet('Taren', null, { role: 'pj', groupId }))
    ;[u] = insert(u, 'sheets', draftSheet('Goblin', null, { role: 'npc', groupId }))
    u = linkPlayerSheets(u)
    expect(u.sheets.find((s) => s.name === 'Taren')!.entityId).not.toBeNull()
    expect(u.sheets.find((s) => s.name === 'Goblin')!.entityId).toBeNull()
    expect(u.entities.map((e) => e.name)).toEqual(['Taren'])
    // De novo não muda nada.
    expect(linkPlayerSheets(u)).toBe(u)
  })

  it('as sessões em que a ficha aparece: jogou, o mestre conduziu, ou está no resumo', () => {
    let { u, groupId } = base()
    let kaya
    ;[u, kaya] = insert(u, 'sheets', draftSheet('Kaya', null, { role: 'pj', groupId }))
    u = linkToWorld(u, kaya.id)
    const kayaId = byId(u, 'sheets', kaya.id)!.entityId!
    let ilsa
    ;[u, ilsa] = insert(u, 'entities', draftEntity('personagem', 'Ilsa'))
    let s1, s2, s3
    ;[u, s1] = insert(u, 'sessions', { ...draftSession(1, groupId), status: 'encerrada', recap: 'Ilsa observava da Torre.' })
    ;[u, s2] = insert(u, 'sessions', { ...draftSession(2, groupId), title: 'Sessão 2 — A Torre', status: 'encerrada' })
    u = patch(u, 'sessions', s2.id, { attendance: { [kaya.id]: 'mestre' } })
    ;[u, s3] = insert(u, 'sessions', draftSession(3, groupId))
    expect(sessionsOf(u, kayaId)).toEqual([
      { sessionId: s1.id, label: 'Sessão 1', why: ['jogou'] },
      { sessionId: s2.id, label: 'Sessão 2 — A Torre', why: ['o mestre conduziu'] },
    ])
    expect(sessionsOf(u, ilsa.id)).toEqual([{ sessionId: s1.id, label: 'Sessão 1', why: ['no resumo'] }])
    // A sessão planejada ainda não conta.
    expect(sessionsOf(u, kayaId).some((x) => x.sessionId === s3.id)).toBe(false)
  })

  it('as espécies do Mundo viram inimigos prontos, sem repetir os que já estão no bestiário', () => {
    let u = createUniverse('Ostria')
    let lobo
    ;[u, lobo] = insert(u, 'entities', { ...draftEntity('especie', 'Lobo cinzento'), summary: 'Caça em bando nas falésias.' })
    ;[u] = insert(u, 'entities', draftEntity('especie', 'Goblin'))
    ;[u] = insert(u, 'monsters', { ...monsterFromCreature({ ...lobo, name: 'goblin' }) })
    expect(creaturesToAdd(u).map((e) => e.name)).toEqual(['Lobo cinzento'])
    expect(monsterFromCreature(lobo)).toMatchObject({ name: 'Lobo cinzento', notes: 'Caça em bando nas falésias.' })
  })
})
