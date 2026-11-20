import { describe, expect, it } from 'vitest'
import { answer } from './kindQuestions'
import { createUniverse, draftEntity, draftRelation, insert, patch } from '../model/universe'
import { goodsOf, levelOf, rulersOf, tensionsOf, tradesOf } from './power'

describe('poder e tensões', () => {
  it('tensões pelo tipo da ligação, da pior para a mais calma, sem segredos', () => {
    let u = createUniverse('t')
    const add = (kind: string, name: string) => {
      const [n, e] = insert(u, 'entities', draftEntity(kind, name))
      u = n
      return e
    }
    const a = add('reino', 'Norte')
    const b = add('reino', 'Sul')
    const c = add('faccao', 'Guilda')
    ;[u] = insert(u, 'relations', draftRelation(a.id, b.id, 'em tensão com'))
    ;[u] = insert(u, 'relations', draftRelation(a.id, c.id, 'Em guerra com'))
    ;[u] = insert(u, 'relations', { ...draftRelation(b.id, c.id, 'em paz com'), canon: 'secreto' })
    ;[u] = insert(u, 'relations', draftRelation(c.id, b.id, 'governa'))
    expect(tensionsOf(u).map((t) => [t.b.name, t.level])).toEqual([['Guilda', 'guerra'], ['Sul', 'tensao']])
    expect(tensionsOf(u, b.id)).toHaveLength(1)
    expect(levelOf('aliado de')).toBeNull()
    expect(rulersOf(u, b.id).map((r) => r.entity.name)).toEqual(['Guilda'])
    u = patch(u, 'entities', a.id, { fields: answer([], 'Produz', 'sal, peixe e ferro') })
    u = patch(u, 'entities', b.id, { fields: answer([], 'Precisa', 'Ferro') })
    expect(tradesOf(u).map((t) => [t.from.name, t.to.name, t.good])).toEqual([['Norte', 'Sul', 'ferro']])
    expect(goodsOf('sal, peixe e ferro.')).toEqual(['sal', 'peixe', 'ferro'])
  })
})
