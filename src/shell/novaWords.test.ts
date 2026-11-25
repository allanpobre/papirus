import { describe, expect, it } from 'vitest'
import { novaWords } from './novaWords'

describe('novaWords', () => {
  it('sem a Nova cara, nada muda', () => {
    expect(novaWords('A Trama e o menu “Mais”', false)).toBe('A Trama e o menu “Mais”')
  })
  it('com a Nova cara: História, três partes e Menu', () => {
    expect(novaWords('A Trama', true)).toBe('A História')
    expect(novaWords('vira pista (Trama) ou ideia', true)).toBe('vira pista (História) ou ideia')
    expect(novaWords('Fichas, Ligações, Linha do tempo e Mapas: tudo', true)).toBe('Fichas, Ligações e Mapas: tudo')
    expect(novaWords('no fim do menu “Mais”.', true)).toBe('no fim do “Menu”.')
    // Palavras parecidas ficam como estão.
    expect(novaWords('as tramas e o Tramado', true)).toBe('as tramas e o Tramado')
  })
})
