import { describe, expect, it } from 'vitest'
import { generateContinent, insideShape } from './continent'

describe('gerar continente', () => {
  it('a mesma semente dá o mesmo mapa; outra, outro', () => {
    expect(generateContinent(7)).toEqual(generateContinent(7))
    expect(generateContinent(7).coast).not.toEqual(generateContinent(8).coast)
  })
  it('montanhas e florestas ficam na terra, e tudo dentro do mapa', () => {
    for (const seed of [1, 2, 3, 42]) {
      const c = generateContinent(seed)
      expect(c.coast.length).toBeGreaterThan(50)
      for (const m of [...c.mountains, ...c.forests]) expect(insideShape(m, c.coast)).toBe(true)
      for (const [x, y] of c.coast) expect(x >= 0 && x <= 1 && y >= 0 && y <= 1).toBe(true)
    }
  })
})
