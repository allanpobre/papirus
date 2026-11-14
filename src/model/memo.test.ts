import { describe, expect, it } from 'vitest'
import { cachedBy, identityCache } from './memo'

describe('cachedBy', () => {
  it('só refaz a conta quando algum dos arrays muda (por identidade)', () => {
    const cache = identityCache()
    const a: number[] = []
    const b: number[] = []
    let contas = 0
    const f = (x: number[], y: number[]) => cachedBy(cache, [x, y], () => ++contas)
    expect(f(a, b)).toBe(1)
    expect(f(a, b)).toBe(1)
    // Um array novo (mesmo igual) é outro dado: refaz.
    expect(f([...a], b)).toBe(2)
    expect(f(a, [...b])).toBe(3)
    expect(f(a, b)).toBe(1)
    expect(contas).toBe(3)
  })

  it('guarda também resultado falso ou vazio', () => {
    const cache = identityCache()
    const k = {}
    let contas = 0
    const f = () => cachedBy(cache, [k], () => (contas++, 0))
    expect(f()).toBe(0)
    expect(f()).toBe(0)
    expect(contas).toBe(1)
  })
})
