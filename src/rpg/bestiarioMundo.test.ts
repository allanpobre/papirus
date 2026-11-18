import { describe, expect, it } from 'vitest'
import { byId, createUniverse, draftEntity, draftGroup, insert, patch } from '../model/universe'
import { addMonsters, creaturesToAdd, draftMonster, filterMonsters, monsterFromCreature, monsterTypes, syncMonstersFromWorld, worldTraits } from './bestiary'
import { beginSession } from './sessionLife'

function mundo() {
  let u = createUniverse('Oz')
  let kalidah, tigre, vilao
  ;[u, kalidah] = insert(u, 'entities', draftEntity('especie', 'Kalidah'))
  u = patch(u, 'entities', kalidah.id, { summary: 'Corpo de urso e cabeça de tigre.', game: { traits: ['Garras longas', ' Caça em dupla '], mods: { FOR: 3, DES: 0 } } })
  ;[u, tigre] = insert(u, 'entities', draftEntity('especie', 'Tigre de Dentes de Sabre'))
  ;[u, vilao] = insert(u, 'entities', draftEntity('personagem', 'A Bruxa Má do Oeste'))
  return { u, kalidah, tigre, vilao }
}

describe('bestiário a partir do Mundo', () => {
  it('a espécie vira inimigo, herdando o "No jogo" (traços sem espaço sobrando, modificadores que não são zero)', () => {
    const { u, kalidah } = mundo()
    const e = byId(u, 'entities', kalidah.id)!
    expect(worldTraits(e)).toEqual({ traits: ['Garras longas', 'Caça em dupla'], mods: { FOR: 3 } })
    expect(monsterFromCreature(e)).toMatchObject({ name: 'Kalidah', notes: 'Corpo de urso e cabeça de tigre.', entityId: kalidah.id, type: 'Criatura', level: null, traits: ['Garras longas', 'Caça em dupla'], mods: { FOR: 3 } })
    // Sem "No jogo", sem traços e sem modificadores (nada de campos vazios).
    const tigre = monsterFromCreature(draftEntity('especie', 'Tigre') as never)
    expect(tigre.traits).toBeUndefined()
    expect(tigre.mods).toBeUndefined()
  })

  it('as espécies que já estão no bestiário (pela ficha ou pelo nome) não são oferecidas de novo', () => {
    let { u, kalidah, tigre } = mundo()
    expect(creaturesToAdd(u).map((e) => e.name)).toEqual(['Kalidah', 'Tigre de Dentes de Sabre'])
    ;[u] = insert(u, 'monsters', monsterFromCreature(byId(u, 'entities', kalidah.id)!))
    expect(creaturesToAdd(u).map((e) => e.name)).toEqual(['Tigre de Dentes de Sabre'])
    // Um inimigo do mesmo nome, criado à mão, também conta.
    ;[u] = insert(u, 'monsters', draftMonster('tigre de dentes de sabre'))
    expect(creaturesToAdd(u)).toEqual([])
    expect(tigre.id).toBeTruthy()
  })

  it('o inimigo acompanha o "No jogo" da ficha: muda, tira e volta ao mesmo universo se nada mudou', () => {
    let { u, kalidah } = mundo()
    let m
    ;[u, m] = insert(u, 'monsters', monsterFromCreature(byId(u, 'entities', kalidah.id)!))
    expect(syncMonstersFromWorld(u)).toBe(u)
    // A ficha ganha um traço e muda o modificador.
    u = patch(u, 'entities', kalidah.id, { game: { traits: ['Garras longas'], mods: { FOR: 4, CON: 1 } } })
    let sync = syncMonstersFromWorld(u)
    expect(byId(sync, 'monsters', m.id)).toMatchObject({ traits: ['Garras longas'], mods: { FOR: 4, CON: 1 } })
    expect(syncMonstersFromWorld(sync)).toBe(sync)
    // A ficha perde o "No jogo": o inimigo também.
    sync = syncMonstersFromWorld(patch(sync, 'entities', kalidah.id, { game: undefined }))
    expect(byId(sync, 'monsters', m.id)!.traits).toBeUndefined()
    expect(byId(sync, 'monsters', m.id)!.mods).toBeUndefined()
    // Inimigo sem ficha do Mundo (ou com a ficha apagada) fica como está.
    const solto = insert(sync, 'monsters', draftMonster('Goblin'))[0]
    expect(syncMonstersFromWorld(solto)).toBe(solto)
  })

  it('no combate, os traços herdados aparecem na iniciativa junto do nome', () => {
    let { u, kalidah } = mundo()
    let g, m, id
    ;[u, g] = insert(u, 'groups', draftGroup('Mesa'))
    ;[u, m] = insert(u, 'monsters', monsterFromCreature(byId(u, 'entities', kalidah.id)!))
    ;[u, id] = beginSession(u, g.id, null)
    u = addMonsters(u, id, m.id, 2, undefined, () => 0.5)
    const init = byId(u, 'sessions', id)!.initiative
    expect(init.map((e) => e.name)).toEqual(['Kalidah 1', 'Kalidah 2'])
    expect(init[0].note).toBe('Garras longas · Caça em dupla')
  })
})

describe('buscar e filtrar o bestiário', () => {
  const lista = [
    { ...draftMonster('Goblin'), type: 'Goblinoide', level: 1, notes: 'Pequeno e covarde.' },
    { ...draftMonster('Lobo'), type: 'Fera', level: 1 },
    { ...draftMonster('Esqueleto'), type: 'Morto-vivo', level: 2 },
    { ...draftMonster('Ogro'), type: 'Gigante', level: 5, traits: ['Clava grande'] },
    { ...draftMonster('Dragão'), type: 'Dragão', level: 9 },
    { ...draftMonster('Sombra') },
  ].map((m, i) => ({ ...m, id: `m${i}`, createdAt: '', updatedAt: '' }) as never) as Parameters<typeof filterMonsters>[0]
  const nomes = (r: ReturnType<typeof filterMonsters>) => r.map((m) => m.name)

  it('o texto procura no nome, no tipo, nas notas e nos traços, sem ligar para acento ou maiúscula', () => {
    expect(nomes(filterMonsters(lista, { text: 'gob' }))).toEqual(['Goblin'])
    expect(nomes(filterMonsters(lista, { text: 'MORTO' }))).toEqual(['Esqueleto'])
    expect(nomes(filterMonsters(lista, { text: 'covarde' }))).toEqual(['Goblin'])
    expect(nomes(filterMonsters(lista, { text: 'clava' }))).toEqual(['Ogro'])
    expect(nomes(filterMonsters(lista, { text: 'dragao' }))).toEqual(['Dragão'])
  })

  it('o tipo e o nível filtram juntos; "sem nível" pega quem não tem', () => {
    expect(nomes(filterMonsters(lista, { type: 'fera' }))).toEqual(['Lobo'])
    expect(nomes(filterMonsters(lista, { level: '1-3' }))).toEqual(['Goblin', 'Lobo', 'Esqueleto'])
    expect(nomes(filterMonsters(lista, { level: '4-6' }))).toEqual(['Ogro'])
    expect(nomes(filterMonsters(lista, { level: '7+' }))).toEqual(['Dragão'])
    expect(nomes(filterMonsters(lista, { level: 'sem' }))).toEqual(['Sombra'])
    expect(nomes(filterMonsters(lista, { level: '1-3', type: 'Goblinoide', text: 'gob' }))).toEqual(['Goblin'])
    expect(filterMonsters(lista, {})).toHaveLength(6)
  })

  it('os tipos do filtro: sem repetir (nem por maiúscula) e em ordem', () => {
    expect(monsterTypes(lista)).toEqual(['Dragão', 'Fera', 'Gigante', 'Goblinoide', 'Morto-vivo'])
    expect(monsterTypes([...lista, { ...lista[1], id: 'x', type: 'FERA' }])).toEqual(['Dragão', 'Fera', 'Gigante', 'Goblinoide', 'Morto-vivo'])
  })
})
