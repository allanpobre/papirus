import { describe, expect, it } from 'vitest'
import { coverLook, coverSeed } from './coverLook'

describe('capa gerada', () => {
  it('o mesmo nome dá sempre a mesma capa, sem ligar para maiúsculas nem espaços nas pontas', () => {
    expect(coverLook('Maré Baixa')).toEqual(coverLook('  maré baixa '))
    expect(coverSeed('Maré Baixa')).toBe(coverSeed('MARÉ BAIXA'))
  })

  it('nomes diferentes se espalham pelas cores e pelos desenhos', () => {
    const names = ['Maré Baixa', 'As Cinzas de Ostria', 'O Último Farol', 'Noite sem Lua', 'Crônicas de Vidro', 'A Guerra dos Sete', 'Zênite', 'Sombras', 'O Alienista', 'Terra Oca', 'Vento Norte', 'Sal e Ferro']
    const looks = names.map(coverLook)
    expect(new Set(looks.map((l) => l.tone)).size).toBeGreaterThanOrEqual(5)
    expect(new Set(looks.map((l) => l.motif)).size).toBeGreaterThanOrEqual(4)
    for (const l of looks) {
      expect(l.tone).toMatch(/^#[0-9a-f]{6}$/)
      expect(l.motif).toBeGreaterThanOrEqual(0)
      expect(l.motif).toBeLessThan(6)
    }
  })
})
