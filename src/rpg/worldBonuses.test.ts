import { describe, expect, it } from 'vitest'
import { createUniverse, draftEntity, draftRelation, insert } from '../model/universe'
import { attributeExpression } from './rolls'
import { attributeOf, baseAttributeOf, draftSheet } from './sheets'
import { systemFromTemplate } from './systems'
import { gameSourcesOf, syncWorldBonuses } from './worldBonuses'

describe('bônus do mundo na ficha de jogo', () => {
  it('a espécie ligada ao personagem dá +2 à vista, nas rolagens, e pode ser desligada', () => {
    let u = createUniverse('W')
    let system
    ;[u, system] = insert(u, 'systems', systemFromTemplate('t20'))
    const forca = system.attributes[0]
    let elfo
    ;[u, elfo] = insert(u, 'entities', { ...draftEntity('especie', 'Elfo'), game: { traits: ['Visão no escuro'], mods: { [forca.abbr]: 2 } } })
    let kael
    ;[u, kael] = insert(u, 'entities', draftEntity('personagem', 'Kael'))
    ;[u] = insert(u, 'relations', draftRelation(kael.id, elfo.id, 'é da espécie'))
    let sheet
    ;[u, sheet] = insert(u, 'sheets', { ...draftSheet('Kael', system, { entityId: kael.id }), attributes: { [forca.id]: 1 } })
    expect(gameSourcesOf(u, kael.id).map((e) => e.name)).toEqual(['Elfo'])

    u = syncWorldBonuses(u)
    const s = u.sheets.find((x) => x.id === sheet.id)!
    expect(s.bonuses).toEqual([{ sourceId: elfo.id, name: 'Elfo', attrs: { [forca.id]: 2 }, traits: ['Visão no escuro'] }])
    expect(baseAttributeOf(system, s, forca.id)).toBe(1)
    expect(attributeOf(system, s, forca.id)).toBe(3)
    expect(attributeExpression(system, s, forca.id)).toContain('3')
    expect(attributeOf(system, { ...s, bonusesOff: true }, forca.id)).toBe(1)
    // Nada mudou: devolve o mesmo universo (sem gravar à toa).
    expect(syncWorldBonuses(u)).toBe(u)
    // A espécie perde o bônus no Mundo: a ficha de jogo acompanha.
    const noMods = { ...u, entities: u.entities.map((e) => (e.id === elfo.id ? { ...e, game: { traits: [], mods: {} } } : e)) }
    expect(syncWorldBonuses(noMods).sheets.find((x) => x.id === sheet.id)!.bonuses).toBeUndefined()
  })
})
