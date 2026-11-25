import { describe, expect, it } from 'vitest'
import { ostriaUniverse } from '../model/sampleOstria'
import { didYouMean } from './search'

describe('Você quis dizer… (busca com erro de digitação)', () => {
  const u = ostriaUniverse()
  it('acha a ficha a uma ou duas letras do que se digitou, por nome, palavra ou apelido', () => {
    expect(didYouMean(u, 'cassien').map((r) => r.title)).toContain('Cassian')
    expect(didYouMean(u, 'palidu').map((r) => r.title)).toContain('Homem Pálido')
    expect(didYouMean(u, 'pale men').map((r) => r.title)).toContain('Homem Pálido')
  })
  it('não inventa: nada parecido, ou curto demais para adivinhar', () => {
    expect(didYouMean(u, 'xyzzy')).toEqual([])
    expect(didYouMean(u, 'ka')).toEqual([])
  })
})
