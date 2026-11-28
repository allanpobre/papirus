import { describe, expect, it } from 'vitest'
import { formulaText } from './formulaText'

const system = {
  attributes: [
    { id: 'a1', abbr: 'DES', name: 'Destreza' },
    { id: 'a3', abbr: 'SQD', name: 'Squad' },
    { id: 'a4', abbr: 'LUZ', name: 'Meia-Luz' },
    { id: 'a2', abbr: 'AGI', name: 'Agilidade' },
  ],
  resources: [{ id: 'r1', abbr: 'PV', name: 'Pontos de vida', default: 10 }],
} as unknown as Parameters<typeof formulaText>[0]

describe('fórmula em palavras', () => {
  it('troca as marcas pelo nome do atributo, do modificador e da perícia', () => {
    expect(formulaText(system, '1d20+{mod:DES}')).toBe('1d20 + modificador de Destreza')
    expect(formulaText(system, '1d20+{DES}+{per:Iniciativa}')).toBe('1d20 + Destreza + perícia Iniciativa')
    expect(formulaText(system, '{AGI}d20kh1+{per:Iniciativa}')).toBe('Agilidade d20kh1 + perícia Iniciativa')
  })

  it('sem marcas fica como está; sigla desconhecida mostra a própria sigla', () => {
    expect(formulaText(system, '1d20')).toBe('1d20')
    expect(formulaText(system, '1d10+{XYZ}')).toBe('1d10 + XYZ')
    expect(formulaText(system, '{PV}')).toBe('Pontos de vida')
  })

  it('não mexe em hífen de nome nem em sinal de menos no começo; atributo que termina em d lê certo antes de d20', () => {
    expect(formulaText(system, '1d20+{LUZ}')).toBe('1d20 + Meia-Luz')
    expect(formulaText(system, '-1+{DES}')).toBe('-1 + Destreza')
    expect(formulaText(system, '{SQD}d20kh1')).toBe('Squad d20kh1')
  })
})
