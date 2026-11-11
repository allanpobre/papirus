import { describe, expect, it } from 'vitest'
import { ostriaUniverse } from '../model/sampleOstria'
import { createUniverse, draftEntity, insert } from '../model/universe'
import { kindCounts, worldGaps } from './worldGaps'

describe('o que falta no mundo', () => {
  it('aponta fichas sem resumo e soltas, com a primeira para abrir', () => {
    let [u, a] = insert(createUniverse('W'), 'entities', draftEntity('personagem', 'Ana'))
    ;[u] = insert(u, 'entities', { ...draftEntity('lugar', 'Vila'), summary: 'Uma vila.' })
    const gaps = worldGaps(u)
    expect(gaps.find((g) => g.key === 'resumo')).toMatchObject({ count: 1, id: a.id, text: '1 ficha sem resumo' })
    expect(gaps.find((g) => g.key === 'soltas')?.count).toBe(2)
    // Sem mapa, "fora do mapa" não faz sentido.
    expect(gaps.find((g) => g.key === 'mapa')).toBeUndefined()
  })

  it('no Simples, só o essencial', () => {
    const u = ostriaUniverse()
    expect(worldGaps(u, { full: false }).every((g) => !g.full)).toBe(true)
    expect(kindCounts(u)[0].count).toBeGreaterThanOrEqual(kindCounts(u).at(-1)!.count)
  })
})
