import { describe, expect, it } from 'vitest'
import { compareByRole, isLead, nodeRadius, roleRank } from './roles'

describe('papel na história', () => {
  it('a ordem: protagonista, antagonista, secundário, figurante e, por último, quem não tem papel', () => {
    expect(['figurante', undefined, 'protagonista', 'secundario', 'antagonista'].map((r) => roleRank(r as never))).toEqual([3, 4, 0, 2, 1])
    expect(roleRank(null)).toBe(4)
  })

  it('ordena por papel e, dentro do mesmo papel, por nome (com acento)', () => {
    const fichas = [
      { name: 'Zeb' },
      { name: 'Álvaro', role: 'secundario' as const },
      { name: 'Dorothy', role: 'protagonista' as const },
      { name: 'Bruxa', role: 'antagonista' as const },
      { name: 'Alice', role: 'secundario' as const },
      { name: 'Mira', role: 'figurante' as const },
    ]
    expect([...fichas].sort(compareByRole).map((f) => f.name)).toEqual(['Dorothy', 'Bruxa', 'Alice', 'Álvaro', 'Mira', 'Zeb'])
  })

  it('só o protagonista é "de destaque"', () => {
    expect(isLead('protagonista')).toBe(true)
    expect(isLead('antagonista')).toBe(false)
    expect(isLead(undefined)).toBe(false)
  })
})

describe('tamanho da bolinha nas Ligações', () => {
  it('com as mesmas ligações, o protagonista é um pouco maior (3 px no celular, 4 no computador)', () => {
    for (const grau of [0, 1, 3, 6, 12]) {
      expect(nodeRadius(grau, true, true) - nodeRadius(grau, true, false)).toBe(3)
      expect(nodeRadius(grau, false, true) - nodeRadius(grau, false, false)).toBe(4)
    }
  })

  it('o tamanho de antes não muda para quem não é protagonista', () => {
    expect(nodeRadius(0, true, false)).toBe(11)
    expect(nodeRadius(10, true, false)).toBe(18)
    expect(nodeRadius(0, false, false)).toBe(14)
    expect(nodeRadius(10, false, false)).toBe(24)
  })
})
