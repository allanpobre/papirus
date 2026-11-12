import { describe, expect, it } from 'vitest'
import { createUniverse, draftEntity, draftRelation, insert } from '../model/universe'
import { existsIn, worldAt, worldBounds } from './timeMachine'

describe('máquina do tempo', () => {
  it('quem vivia, quem mandava e o que existia num ano', () => {
    let u = createUniverse('W')
    let rei
    ;[u, rei] = insert(u, 'entities', { ...draftEntity('personagem', 'Aldric'), startYear: 100, endYear: 160 })
    let filha
    ;[u, filha] = insert(u, 'entities', { ...draftEntity('personagem', 'Lyra'), startYear: 140, endYear: null })
    let reino
    ;[u, reino] = insert(u, 'entities', { ...draftEntity('reino', 'Valmar'), startYear: 90, endYear: null })
    const r1 = { ...draftRelation(rei.id, reino.id, 'governa'), scope: { kind: 'periodo' as const, fromYear: 120, toYear: 160, storyIds: [], sceneIds: [] } }
    const r2 = { ...draftRelation(filha.id, reino.id, 'governa'), scope: { kind: 'periodo' as const, fromYear: 161, toYear: null, storyIds: [], sceneIds: [] } }
    ;[u] = insert(u, 'relations', r1)
    ;[u] = insert(u, 'relations', r2)

    const in150 = worldAt(u, 150)
    expect(in150.alive.map((a) => [a.entity.name, a.age])).toEqual([
      ['Aldric', 50],
      ['Lyra', 10],
    ])
    expect(in150.rulers.map((r) => r.ruler.name)).toEqual(['Aldric'])
    expect(in150.standing.map((e) => e.name)).toEqual(['Valmar'])

    const in170 = worldAt(u, 170)
    expect(in170.rulers.map((r) => r.ruler.name)).toEqual(['Lyra'])
    expect(in170.gone.map((e) => e.name)).toEqual(['Aldric'])
    expect(worldAt(u, 95).notYet.map((e) => e.name).sort()).toEqual(['Aldric', 'Lyra'])

    expect(worldBounds(u)).toEqual({ min: 90, max: 161 })
    expect(existsIn({ startYear: null, endYear: null }, 1)).toBe(true)
  })

  it('sem nenhuma data, não há o que mostrar', () => {
    expect(worldBounds(createUniverse('W'))).toBeNull()
  })
})
