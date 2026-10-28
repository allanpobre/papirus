import { describe, expect, it } from 'vitest'
import { generateNames } from './names'

// Sorteio previsível para o teste.
const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647
  return (seed - 1) / 2147483646
}

describe('gerador de nomes', () => {
  it('gera nomes novos, com letra maiúscula, sem repetir os que já existem', () => {
    const existing = ['Kael', 'Mira', 'Ilsa', 'Vaelor', 'Ostria', 'Tavren', 'Kaelor', 'Miriel']
    const names = generateNames(existing, 'fantasia', 6, seeded(7))
    expect(names.length).toBeGreaterThanOrEqual(4)
    for (const n of names) {
      expect(n).toMatch(/^\p{Lu}\p{Ll}+$/u)
      expect(existing).not.toContain(n)
      expect(n.length).toBeGreaterThanOrEqual(3)
    }
  })
  it('com poucos nomes no universo, usa a lista do gênero', () => {
    const names = generateNames([], 'pessoas', 5, seeded(3))
    expect(names.length).toBe(5)
  })
})
