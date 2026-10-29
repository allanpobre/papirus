import { describe, expect, it } from 'vitest'
import { byId, createUniverse, draftGroup, insert } from '../model/universe'
import { addMonsters, baseName, draftMonster, monsterFromEntry, monsterNames } from './bestiary'
import { beginSession, draftRecap } from './sessionLife'

describe('bestiário', () => {
  it('numera quem entra, continuando a contagem', () => {
    expect(monsterNames([], 'Goblin', 1)).toEqual(['Goblin'])
    expect(monsterNames([], 'Goblin', 3)).toEqual(['Goblin 1', 'Goblin 2', 'Goblin 3'])
    expect(monsterNames(['Goblin', 'Brisa'], 'Goblin', 2)).toEqual(['Goblin 2', 'Goblin 3'])
    expect(monsterNames(['Goblin 1', 'Goblin 2'], 'Goblin', 1)).toEqual(['Goblin 3'])
    expect(baseName('Goblin 12')).toBe('Goblin')
  })

  it('três goblins entram com vida, Defesa, ataques e iniciativa', () => {
    let u = createUniverse('Ostria')
    let g, m
    ;[u, g] = insert(u, 'groups', draftGroup('Mesa'))
    ;[u, m] = insert(u, 'monsters', { ...draftMonster('Goblin'), hp: 7, defense: 13, initiative: 2, attacks: [{ id: 'a', name: 'Cimitarra', bonus: 4, damage: '1d6+2', critical: '' }] })
    let id
    ;[u, id] = beginSession(u, g.id, null)
    u = addMonsters(u, id, m.id, 3, undefined, () => 0.5)
    const init = byId(u, 'sessions', id)!.initiative
    expect(init.map((e) => e.name)).toEqual(['Goblin 1', 'Goblin 2', 'Goblin 3'])
    expect(init[0]).toMatchObject({ hp: '7/7', defense: 13, monsterId: m.id, value: 13 })
    expect(init[0].attacks).toMatchObject([{ name: 'Cimitarra', bonus: 4, damage: '1d6+2' }])
    expect(init[0].attacks[0].id).not.toBe(init[1].attacks[0].id)
  })

  it('um combatente avulso vira inimigo pronto', () => {
    const entry = { id: 'x', name: 'Bandido 2', value: 10, hp: '3/11', note: '', sheetId: null, defense: 13, attacks: [], monsterId: null }
    expect(monsterFromEntry(entry, { bonus: 4, damage: '1d6+2' })).toMatchObject({ name: 'Bandido', hp: 11, defense: 13, attacks: [{ name: 'Ataque', bonus: 4, damage: '1d6+2' }] })
    expect(monsterFromEntry(entry, null).attacks).toEqual([])
  })
})

describe('diário da campanha', () => {
  it('o rascunho vem das notas, sem rolagens, rodadas e chamada', () => {
    let u = createUniverse('Ostria')
    let g
    ;[u, g] = insert(u, 'groups', draftGroup('Mesa'))
    let id
    ;[u, id] = beginSession(u, g.id, null)
    const s = byId(u, 'sessions', id)!
    const log = (text: string, kind: 'nota' | 'rolagem' = 'nota') => ({ id: text, at: '20:00', text, kind })
    const full = {
      ...s,
      log: [...s.log, log('Chegaram ao porto.'), log('Brisa — Furtividade: 17', 'rolagem'), log('Rodada 2'), log('Taren fica de fora desta sessão (Bruno não veio).'), log('Aviso à mesa: Um inimigo aparece!'), log('Teste pedido: Percepção — todos'), log('Ilsa apareceu na janela.')],
    }
    expect(draftRecap(full)).toBe('Chegaram ao porto.\nUm inimigo aparece!\nIlsa apareceu na janela.')
  })
})
