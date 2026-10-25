import { describe, expect, it } from 'vitest'
import { createUniverse, draftEntity, draftRelation, insert } from '../model/universe'
import { familyLayout, familyLinks } from './family'

describe('árvore da família', () => {
  it('lê pai/filha/casado/irmão das relações e põe cada um na sua geração', () => {
    let u = createUniverse('T')
    const p = (name: string) => {
      let e
      ;[u, e] = insert(u, 'entities', draftEntity('personagem', name))
      return e.id
    }
    const [avo, pai, mae, filha, filho] = ['Avô', 'Pai', 'Mãe', 'Filha', 'Filho'].map(p)
    const rel = (a: string, b: string, t: string) => ([u] = insert(u, 'relations', draftRelation(a, b, t)))
    rel(pai, avo, 'filho de')
    rel(pai, mae, 'casado com')
    rel(mae, filha, 'mãe de')
    rel(filha, filho, 'irmã de')
    rel(pai, filha, 'desconfia de')
    const links = familyLinks(u)
    expect(links).toHaveLength(4)
    const { nodes, generations } = familyLayout(links)
    const gen = new Map(nodes.map((n) => [n.id, n.gen]))
    expect(generations).toBe(3)
    expect([gen.get(avo), gen.get(pai), gen.get(mae), gen.get(filha), gen.get(filho)]).toEqual([0, 1, 1, 2, 2])
  })
})
