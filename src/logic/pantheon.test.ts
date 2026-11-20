import { describe, expect, it } from 'vitest'
import { createUniverse, draftEntity, draftRelation, insert } from '../model/universe'
import { pantheonOf, skyLayout } from './pantheon'

describe('panteão', () => {
  it('deuses com domínio, filhos, lendas e quem acredita, tudo por ligações', () => {
    let u = createUniverse('t')
    const add = (kind: string, name: string) => {
      const [n, e] = insert(u, 'entities', draftEntity(kind, name))
      u = n
      return e
    }
    const rel = (a: string, b: string, t: string, note = '') => {
      ;[u] = insert(u, 'relations', { ...draftRelation(a, b, t), note })
    }
    const fe = add('religiao', 'Fé das Marés')
    const mae = add('personagem', 'Mãe-Mar')
    const filho = add('personagem', 'Afogado')
    const lenda = add('documento', 'Canto da Maré')
    const povo = add('cultura', 'Gente do Sal')
    rel(mae.id, fe.id, 'é deus de', 'o mar')
    rel(filho.id, fe.id, 'É deus de')
    rel(filho.id, mae.id, 'filho de')
    rel(lenda.id, mae.id, 'conta sobre')
    rel(povo.id, fe.id, 'acredita em')
    const p = pantheonOf(u, fe.id)
    expect(p.gods.map((g) => [g.entity.name, g.domain])).toEqual([['Mãe-Mar', 'o mar'], ['Afogado', '']])
    expect(p.gods[1].parents).toEqual([mae.id])
    expect(p.gods[0].myths.map((m) => m.name)).toEqual(['Canto da Maré'])
    expect(p.believers.map((b) => b.entity.name)).toEqual(['Gente do Sal'])
    const pos = skyLayout(p.gods)
    expect(pos.get(mae.id)).toEqual({ x: 0.5, y: 0.5 })
    expect(pos.get(filho.id)!.y).toBeLessThan(0.5)
  })
})
