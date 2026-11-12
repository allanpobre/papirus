import { describe, expect, it } from 'vitest'
import { createUniverse, draftEntity, insert } from '../model/universe'
import { centroid, inside, regionIn } from './regions'

describe('mapa político', () => {
  const square: [number, number][] = [
    [0.1, 0.1],
    [0.5, 0.1],
    [0.5, 0.5],
    [0.1, 0.5],
  ]
  it('centro e "está dentro"', () => {
    const [cx, cy] = centroid(square)
    expect(cx).toBeCloseTo(0.3)
    expect(cy).toBeCloseTo(0.3)
    expect(inside([0.2, 0.2], square)).toBe(true)
    expect(inside([0.8, 0.8], square)).toBe(false)
  })
  it('a região segue o período dela e a vida do dono', () => {
    const [u, reino] = insert(createUniverse('W'), 'entities', { ...draftEntity('reino', 'Valmar'), startYear: 100, endYear: 300 })
    const r = { id: 'r', entityId: reino.id, points: square, fromYear: 150, toYear: null }
    expect(regionIn(u, r, null)).toBe(true)
    expect(regionIn(u, r, 120)).toBe(false)
    expect(regionIn(u, r, 200)).toBe(true)
    expect(regionIn(u, r, 320)).toBe(false)
  })
})
