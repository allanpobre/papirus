import { describe, expect, it } from 'vitest'
import { createUniverse } from '../model/universe'
import { DEFAULT_SEED, sowWorld } from './worldSeed'

const seeded = (n = 7) => () => ((n = (n * 9301 + 49297) % 233280) / 233280)

describe('semente do mundo', () => {
  it('cria as primeiras fichas, ligadas, com resumo e a descrição do mundo', () => {
    const { universe: u, created } = sowWorld(createUniverse('W'), DEFAULT_SEED, seeded())
    expect(created).toBe(6)
    expect(u.entities.every((e) => e.summary.trim())).toBe(true)
    expect(u.relations.length).toBeGreaterThanOrEqual(4)
    expect(u.entities.some((e) => e.kind === 'reino' && e.name.startsWith('Reino de '))).toBe(true)
    // A capital fica dentro do reino.
    const realm = u.entities.find((e) => e.kind === 'reino')!
    expect(u.entities.some((e) => e.kind === 'lugar' && e.parentId === realm.id)).toBe(true)
    expect(u.description).toMatch(/^Um mundo de fantasia cheio de aventura/)
    // Nomes sem repetir.
    expect(new Set(u.entities.map((e) => e.name)).size).toBe(u.entities.length)
  })

  it('cidades rivais, sem magia, com o nome da ameaça escrito pela pessoa', () => {
    const { universe: u } = sowWorld(createUniverse('W'), { genero: 'historico', tom: 'sombrio', poder: 'nada', governo: 'cidades', ameaca: 'guerra', ameacaNome: 'A Grande Seca' }, seeded(3))
    expect(u.entities.filter((e) => e.kind === 'lugar')).toHaveLength(2)
    expect(u.relations.some((r) => r.type === 'rival de')).toBe(true)
    expect(u.entities.some((e) => e.kind === 'magia')).toBe(false)
    expect(u.entities.some((e) => e.name === 'A Grande Seca')).toBe(true)
  })

  it('não troca a descrição que o mundo já tinha', () => {
    const base = { ...createUniverse('W'), description: 'Meu mundo.' }
    expect(sowWorld(base, DEFAULT_SEED, seeded()).universe.description).toBe('Meu mundo.')
  })
})
