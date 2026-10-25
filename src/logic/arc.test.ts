import { describe, expect, it } from 'vitest'
import { sampleUniverse } from '../model/sample'
import { characterArc } from './arc'

describe('arco do personagem', () => {
  it('o boticário: entra no 1, adere ao barbeiro no 8 e volta depois', async () => {
    const u = await sampleUniverse()
    const crispim = u.entities.find((e) => e.name === 'Crispim Soares')!
    const arc = characterArc(u, crispim.id)
    expect(arc.first?.n).toBe(1)
    const step = (n: number) => arc.steps[n - 1].moments.map((m) => `${m.kind}: ${m.text}`)
    expect(step(1)).toContain('entra: Entra na história')
    expect(step(8)).toContain('relacao-comeca: Crispim Soares adere a Porfírio')
    expect(step(8)).toContain('relacao-termina: Crispim Soares concorda com Simão Bacamarte')
    expect(step(8).some((m) => m.startsWith('revela: Na revolta, finge-se doente'))).toBe(true)
    expect(step(12)).toContain('relacao-comeca: Crispim Soares concorda com Simão Bacamarte')
    expect(step(4)).toContain('sabe: passa a saber: Simão Bacamarte acha que a loucura é um continente')
  })

  it('uma ideia também tem arco: entra quando aparece no texto', async () => {
    const u = await sampleUniverse()
    const teoria = u.entities.find((e) => e.name === 'Teoria do desequilíbrio')!
    expect(characterArc(u, teoria.id).first?.n).toBe(12)
  })
})

describe('idade', () => {
  it('pela data da cena e o nascimento na ficha', async () => {
    const { ageIn, ageLabel } = await import('./age')
    expect(ageIn({ startYear: 1738, endYear: null }, 1783)).toBe(45)
    expect(ageIn({ startYear: 1738, endYear: 1787 }, 1790)).toBeNull()
    expect(ageIn({ startYear: 1738, endYear: null }, 1700)).toBeNull()
    expect(ageIn({ startYear: null, endYear: null }, 1783)).toBeNull()
    expect(ageLabel(1)).toBe('1 ano')
  })
})
