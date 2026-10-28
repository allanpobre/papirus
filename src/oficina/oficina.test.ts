import { describe, expect, it } from 'vitest'
import { GUIDES, sectionOf, tipOfTheDay } from './guides'
import { rollIdea } from './ideas'

describe('Oficina', () => {
  it('tem gêneros, técnicas e guias de mestre, todos completos', () => {
    for (const sec of ['genero', 'tecnica', 'mestre'] as const) expect(GUIDES.some((g) => sectionOf(g) === sec)).toBe(true)
    expect(new Set(GUIDES.map((g) => g.id)).size).toBe(GUIDES.length)
    for (const g of GUIDES) {
      expect(g.works.length, g.id).toBeGreaterThanOrEqual(3)
      expect(g.exercises.length, g.id).toBeGreaterThanOrEqual(2)
      expect(new Set(g.exercises.map((e) => e.title)).size, g.id).toBe(g.exercises.length)
    }
  })

  it('a dica do dia de quem mestra vem dos guias da mesa', () => {
    expect(sectionOf(tipOfTheDay('mestrar').guide)).toBe('mestre')
    expect(['fantasia', 'fundamentos']).toContain(tipOfTheDay('fantasia').guide.id)
  })

  it('o gerador junta quatro peças numa frase', () => {
    let n = 0
    const rand = () => ((n = (n * 7 + 3) % 10) / 10)
    const w = rollIdea('escrita', rand)
    expect(w.parts.map((p) => p.label)).toEqual(['Quem', 'Quer', 'Mas', 'Onde'])
    expect(w.sentence).toMatch(/ quer .+, mas .+\. [A-Z]/)
    const m = rollIdea('mesa', rand)
    expect(m.parts[0].label).toBe('Quem pede')
    expect(m.sentence).toContain('pede ao grupo para')
  })
})
