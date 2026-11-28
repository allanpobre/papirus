import { describe, expect, it } from 'vitest'
import { createUniverse, draftEntity, draftRelation, insert } from '../model/universe'
import type { Universe } from '../model/schema'
import { diplomacyOf, diplomacyYears, toneOf } from './quadros'

function mundo() {
  let u: Universe = createUniverse('W')
  const e = (kind: string, name: string, extra: object = {}) => {
    const [n, x] = insert(u, 'entities', { ...draftEntity(kind, name), ...extra })
    u = n
    return x.id
  }
  const r = (a: string, type: string, b: string, extra: object = {}) => {
    u = insert(u, 'relations', { ...draftRelation(a, b, type), ...extra })[0]
  }
  return { e, r, get u() { return u } }
}

describe('diplomacia', () => {
  it('cores pelo tipo, e o ano deixa só o que está em vigor', () => {
    expect(toneOf('aliado de')).toBe('alianca')
    expect(toneOf('em guerra com')).toBe('guerra')
    expect(toneOf('paz tensa com')).toBe('tensa')
    expect(toneOf('em tensão com')).toBe('tensa')
    // "em paz com" é paz de verdade (não é tensão).
    expect(toneOf('em paz com')).toBe('alianca')
    expect(toneOf('conhece')).toBe('outra')
    const m = mundo()
    const a = m.e('reino', 'Ember')
    const b = m.e('reino', 'Tide')
    const c = m.e('faccao', 'Iron')
    const p = m.e('personagem', 'Alguém')
    m.r(a, 'aliado de', b)
    m.r(a, 'em guerra com', c, { scope: { kind: 'periodo', fromYear: 100, toYear: 120, storyIds: [], sceneIds: [] } })
    m.r(p, 'aliado de', a)
    expect(diplomacyOf(m.u).edges).toHaveLength(2)
    expect(diplomacyOf(m.u).nodes.map((n) => n.name)).toEqual(['Ember', 'Iron', 'Tide'])
    expect(diplomacyOf(m.u, { year: 50 }).edges.map((e) => e.tone)).toEqual(['alianca'])
    expect(diplomacyOf(m.u, { year: 110 }).edges).toHaveLength(2)
    expect(diplomacyOf(m.u, { year: 130 }).edges).toHaveLength(1)
    // Só contam os anos de ligações entre facções e reinos.
    m.r(p, 'aliado de', b, { scope: { kind: 'periodo', fromYear: 999, toYear: null, storyIds: [], sceneIds: [] } })
    expect(diplomacyYears(m.u)).toEqual([100, 120])
  })
})
