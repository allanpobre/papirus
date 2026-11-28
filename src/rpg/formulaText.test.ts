import { describe, expect, it } from 'vitest'
import { formulaText } from './formulaText'

const system = {
  attributes: [
    { id: 'a1', abbr: 'DES', name: 'Destreza' },
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
})
