import { describe, expect, it } from 'vitest'
import { entitySchema } from '../model/schema'
import { createUniverse, draftEntity, insert } from '../model/universe'
import { compareByRole, isLead, nodeRadius, roleIn, roleRank } from './roles'

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

describe('papel por livro', () => {
  const dorothy = { role: 'secundario' as const, bookRoles: { l1: 'secundario', l2: 'protagonista', l3: 'invalido' } }

  it('com um livro escolhido vale o papel marcado para ele; senão, o geral', () => {
    expect(roleIn(dorothy, 'l2')).toBe('protagonista')
    expect(roleIn(dorothy, 'l1')).toBe('secundario')
    // Livro sem marcação: o papel geral.
    expect(roleIn(dorothy, 'l9')).toBe('secundario')
    // Todos os livros (sem livro escolhido): o papel geral.
    expect(roleIn(dorothy, null)).toBe('secundario')
  })

  it('um papel desconhecido (de outra versão) é ignorado, e quem não tem papel nenhum fica sem', () => {
    expect(roleIn(dorothy, 'l3')).toBe('secundario')
    expect(roleIn({}, 'l1')).toBeUndefined()
    expect(roleIn({ bookRoles: { l1: 'antagonista' } }, 'l1')).toBe('antagonista')
    expect(roleIn({ bookRoles: { l1: 'antagonista' } }, null)).toBeUndefined()
  })

  it('o papel por livro entra na ordem: no livro 2 a Dorothy vem antes do Espantalho', () => {
    const fichas = [
      { name: 'Espantalho', role: 'secundario' as const },
      { name: 'Dorothy', ...dorothy },
    ]
    const ordem = (livro: string | null) => [...fichas].sort((a, b) => compareByRole({ role: roleIn(a, livro), name: a.name }, { role: roleIn(b, livro), name: b.name })).map((f) => f.name)
    expect(ordem('l2')).toEqual(['Dorothy', 'Espantalho'])
    expect(ordem('l1')).toEqual(['Dorothy', 'Espantalho'])
    expect(ordem(null)).toEqual(['Dorothy', 'Espantalho'])
    // Se for secundária em todos menos no 2, só no 2 passa na frente de um secundário que vem antes no alfabeto.
    const outras = [{ name: 'Alice', role: 'secundario' as const }, { name: 'Zita', role: 'secundario' as const, bookRoles: { l2: 'protagonista' } }]
    expect([...outras].sort((a, b) => compareByRole({ role: roleIn(a, 'l2'), name: a.name }, { role: roleIn(b, 'l2'), name: b.name })).map((f) => f.name)).toEqual(['Zita', 'Alice'])
    expect([...outras].sort((a, b) => compareByRole({ role: roleIn(a, 'l1'), name: a.name }, { role: roleIn(b, 'l1'), name: b.name })).map((f) => f.name)).toEqual(['Alice', 'Zita'])
  })
})

describe('papel por livro: universos antigos e valores estranhos', () => {
  const base = insert(createUniverse('T'), 'entities', draftEntity('personagem', 'Dorothy'))[1]

  it('uma ficha sem o campo continua abrindo, e o campo é opcional', () => {
    const e = entitySchema.parse(base)
    expect(e.bookRoles).toBeUndefined()
    expect(entitySchema.parse({ ...base, bookRoles: { l1: 'protagonista' } }).bookRoles).toEqual({ l1: 'protagonista' })
  })

  it('um valor que não é um mapa (de outra versão) não derruba a ficha', () => {
    expect(entitySchema.parse({ ...base, bookRoles: 5 }).bookRoles).toBeUndefined()
    expect(entitySchema.parse({ ...base, bookRoles: ['x'] }).bookRoles).toBeUndefined()
  })
})
