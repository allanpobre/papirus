import { describe, expect, it } from 'vitest'
import { ostriaUniverse } from '../model/sampleOstria'
import { createUniverse, draftEntity, draftRelation, insert } from '../model/universe'
import { domino } from './domino'

describe('efeito dominó', () => {
  it('quem fica sem governante, quem poderia herdar e a segunda onda', () => {
    let u = createUniverse('W')
    const add = (kind: string, name: string, parentId: string | null = null) => {
      const [next, e] = insert(u, 'entities', { ...draftEntity(kind, name), parentId })
      u = next
      return e
    }
    const rei = add('personagem', 'Aldric')
    const reino = add('reino', 'Valmar')
    const filha = add('personagem', 'Lyra')
    const guarda = add('personagem', 'Doran')
    const cidade = add('lugar', 'Vila', rei.id)
    const vizinho = add('reino', 'Karnath')
    for (const [a, b, t] of [
      [rei, reino, 'governa'],
      [filha, rei, 'filha de'],
      [guarda, rei, 'protege'],
      [reino, vizinho, 'rival de'],
    ] as const)
      u = insert(u, 'relations', draftRelation(a.id, b.id, t))[0]

    const d = domino(u, rei.id)
    const g = Object.fromEntries(d.groups.map((x) => [x.key, x.items.map((i) => i.entity.name)]))
    expect(g.governo).toEqual(['Valmar'])
    expect(g.familia).toEqual(['Lyra'])
    expect(g.servem).toEqual(['Doran'])
    expect(g.dentro).toEqual(['Vila'])
    expect(d.heirs.map((e) => e.name)).toEqual(['Lyra'])
    expect(d.ripple.map((e) => e.name)).toEqual(['Karnath'])
    expect(d.groups[0].key).toBe('governo')
    void cidade
  })

  it('no exemplo: Cassian some e Ostria fica sem quem mande', () => {
    const u = ostriaUniverse()
    const cassian = u.entities.find((e) => e.name === 'Cassian')!
    const d = domino(u, cassian.id)
    expect(d.groups.find((x) => x.key === 'governo')?.items.map((i) => i.entity.name)).toContain('Ostria')
    expect(d.scenes).toBeGreaterThan(0)
  })
})
