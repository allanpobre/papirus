import { describe, expect, it } from 'vitest'
import { createUniverse, insert } from '../model/universe'
import { draftMonster } from './bestiary'
import { addStarterMonsters, missingStarters, STARTER_MONSTERS } from './starterBestiary'

describe('inimigos comuns para quem nunca mestrou', () => {
  it('põe os cinco no bestiário vazio, com vida, Defesa e ataque, e devolve o Goblin para já escolher', () => {
    const [u, first] = addStarterMonsters(createUniverse('Campanha'))
    expect(u.monsters.map((m) => m.name)).toEqual(STARTER_MONSTERS.map((m) => m.name))
    expect(u.monsters.find((m) => m.id === first)?.name).toBe('Goblin')
    for (const m of u.monsters) {
      expect(m.hp).toBeGreaterThan(0)
      expect(m.defense).not.toBeNull()
      expect(m.attacks).toHaveLength(1)
      expect(m.attacks[0].id).toBeTruthy()
      expect(m.attacks[0].damage).toMatch(/^\d+d\d+(\+\d+)?$/)
    }
    // Cada ataque tem o seu próprio id (nenhum é compartilhado entre inimigos).
    expect(new Set(u.monsters.map((m) => m.attacks[0].id)).size).toBe(5)
  })

  it('não repete quem já está (pelo nome) e some da oferta quando todos já estão', () => {
    let u = createUniverse('Campanha')
    ;[u] = insert(u, 'monsters', { ...draftMonster('goblin'), hp: 9 })
    expect(missingStarters(u).map((m) => m.name)).not.toContain('Goblin')
    const [depois] = addStarterMonsters(u)
    expect(depois.monsters).toHaveLength(5)
    // O Goblin do mestre (com 9 de vida) não foi trocado.
    expect(depois.monsters.find((m) => m.name === 'goblin')?.hp).toBe(9)
    expect(missingStarters(depois)).toHaveLength(0)
    const [mesmo, first] = addStarterMonsters(depois)
    expect(mesmo.monsters).toHaveLength(5)
    expect(first).toBeNull()
  })
})
