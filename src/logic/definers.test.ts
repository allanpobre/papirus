import { describe, expect, it } from 'vitest'
import { inheritedFields } from '../model/lists'
import { ostriaUniverse } from '../model/sampleOstria'
import { draftEntity, insert } from '../model/universe'
import { addDefiner, addException, addOption, choose, chosenOf, definersFor, kindForName, removeException, setPasses, whoIs } from './definers'

describe('Quem é: o que define alguém neste mundo', () => {
  it('um mundo cyberpunk: Corpo define personagens; a opção passa as características e há exceções', () => {
    let u = ostriaUniverse()
    const kael = u.entities.find((e) => e.name === 'Kael')!
    let corpo
    ;[u, corpo] = addDefiner(u, 'Corpo', ['personagem'])
    expect(corpo.kind).toBe('Corpo')
    expect(definersFor(u, 'personagem').map((d) => d.name)).toEqual(['Corpo'])
    expect(definersFor(u, 'reino')).toEqual([])

    let meio: string
    ;[u, meio] = addOption(u, corpo, 'Meio-ciborgue')
    u = setPasses(u, meio, corpo, [
      { key: 'Braço', value: 'mecânico' },
      { key: 'Sente frio', value: 'não' },
    ])
    u = choose(u, kael.id, corpo, meio)
    expect(chosenOf(u, kael.id, corpo)?.option.name).toBe('Meio-ciborgue')
    // A herança é a de sempre: o "o que todos têm" da lista.
    expect(inheritedFields(u, kael.id).map((i) => `${i.key}: ${i.value}`)).toEqual(['Braço: mecânico', 'Sente frio: não'])

    // Exceção: este sente frio.
    let me = u.entities.find((e) => e.id === kael.id)!
    me = { ...me, fields: addException(me, 'Sente frio', 'sim') }
    u = { ...u, entities: u.entities.map((e) => (e.id === me.id ? me : e)) }
    const [who] = whoIs(u, me)
    expect(who.option?.name).toBe('Meio-ciborgue')
    expect(who.traits).toEqual([
      { key: 'Braço', value: 'mecânico', exception: null },
      { key: 'Sente frio', value: 'não', exception: 'sim' },
    ])
    expect(removeException(me, 'Sente frio').some((f) => f.key === 'Sente frio')).toBe(false)

    // Trocar de opção sai da anterior; tirar deixa sem.
    let casca: string
    ;[u, casca] = addOption(u, corpo, 'Casca total')
    u = choose(u, kael.id, corpo, casca)
    expect(chosenOf(u, kael.id, corpo)?.option.name).toBe('Casca total')
    expect(u.relations.filter((r) => r.fromId === kael.id && r.toId === meio)).toHaveLength(0)
    u = choose(u, kael.id, corpo, null)
    expect(chosenOf(u, kael.id, corpo)).toBeNull()
  })

  it('vale para facções e reinos também', () => {
    let u = ostriaUniverse()
    let regime
    ;[u, regime] = addDefiner(u, 'Regime', ['reino', 'faccao'])
    let mon: string
    ;[u, mon] = addOption(u, regime, 'Monarquia')
    const reino = u.entities.find((e) => e.kind === 'reino')!
    u = choose(u, reino.id, regime, mon)
    expect(whoIs(u, reino)[0].option?.name).toBe('Monarquia')
  })

  it('Espécie usa o tipo de sempre e reconhece a lista "Quem é desta espécie" de antes', () => {
    expect(kindForName('Espécie')).toBe('especie')
    expect(kindForName('Lua de nascimento')).toBe('Lua de nascimento')
    let u = ostriaUniverse()
    let elfo
    ;[u, elfo] = insert(u, 'entities', { ...draftEntity('especie', 'Elfo'), lists: [{ id: 'l1', name: 'Quem é desta espécie', accepts: [], shared: [{ key: 'Vida', value: '700 anos' }] }] })
    const mira = u.entities.find((e) => e.name === 'Mira')!
    u = { ...u, relations: [...u.relations, { ...u.relations[0], id: 'r-elfo', fromId: mira.id, toId: elfo.id, type: 'faz parte de', listId: 'l1', scope: { kind: 'geral', fromYear: null, toYear: null, storyIds: [], sceneIds: [] } }] }
    let especie
    ;[u, especie] = addDefiner(u, 'Espécie', ['personagem'])
    expect(chosenOf(u, mira.id, especie)?.option.name).toBe('Elfo')
    expect(whoIs(u, mira)[0].traits[0]).toEqual({ key: 'Vida', value: '700 anos', exception: null })
  })
})
