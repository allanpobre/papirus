import { describe, expect, it } from 'vitest'
import { suggestKind } from './kindGuess'

describe('que tipo de ficha o nome novo parece ser (frases do exemplo de Oz)', () => {
  it('"na cidade de X", "chegou a X" e "em X" sugerem lugar', () => {
    expect(suggestKind('Esmeralda', ['Os viajantes chegaram à cidade de Esmeralda ao anoitecer.'])).toBe('lugar')
    expect(suggestKind('Kansas', ['Dorothy morava no meio das grandes pradarias do Kansas, com Tio Henry.'])).toBe('lugar')
    expect(suggestKind('Cidade das Esmeraldas', ['Dorothy chegou à Cidade das Esmeraldas depois de uma longa viagem.'])).toBe('lugar')
    expect(suggestKind('Oz', ['Eles queriam saber o caminho para a terra de Oz.'])).toBe('lugar')
    expect(suggestKind('Quadling', ['O Espantalho e Dorothy foram para Quadling pela estrada de tijolos.'])).toBe('lugar')
    expect(suggestKind('Winkie', ['A bruxa vivia em Winkie há muitos anos.'])).toBe('lugar')
  })

  it('verbo de fala ou de ação com o nome sugere personagem', () => {
    expect(suggestKind('Dorothy', ['Dorothy disse que queria voltar para casa.'])).toBe('personagem')
    expect(suggestKind('Toto', ['— Cuidado — disse Toto, mas ninguém ouviu.', 'Toto latiu duas vezes.'])).toBe('personagem')
    expect(suggestKind('Henry', ['Então o Tio Henry levantou os olhos.', 'Depois Sr. Henry saiu.'])).toBe('personagem')
    expect(suggestKind('Zeb', ['Zeb respondeu devagar, e Dorothy sorriu.'])).toBe('personagem')
  })

  it('personagem que aparece depois de "em"/"pensou em" continua personagem', () => {
    expect(suggestKind('Dorothy', ['O Leão pensou em Dorothy o dia inteiro.'])).toBe('personagem')
    expect(suggestKind('Dorothy', ['Dorothy olhou em volta; Dorothy sorriu.'])).toBe('personagem')
  })

  it('sem pista ou com pistas empatadas, fica personagem (o que a Revisão já sugeria)', () => {
    expect(suggestKind('Zorba', ['Zorba.'])).toBe('personagem')
    expect(suggestKind('Zorba', ['Havia um velho chamado Zorba.'])).toBe('personagem')
    expect(suggestKind('Vila', ['Chegou a Vila e Vila disse que sim.'])).toBe('personagem')
  })

  it('soma as vezes que o nome aparece, em mais de uma cena', () => {
    expect(suggestKind('Ix', ['Eles falaram de Ix.', 'Voltaram para Ix no outono.', 'Nunca moraram em Ix.'])).toBe('lugar')
  })

  it('verbo de estado ("era", "estava") não decide: "Vaelor era linda" serve para gente e para cidade', () => {
    expect(suggestKind('Vaelor', ['Chegou à cidade de Vaelor. Todos diziam que Vaelor era linda.'])).toBe('lugar')
    expect(suggestKind('Vaelor', ['Vaelor era linda.'])).toBe('personagem')
  })

  it('nome com símbolos do regex não quebra', () => {
    expect(suggestKind('A.B. (norte)', ['Chegou a A.B. (norte) ontem.'])).toBe('lugar')
  })
})
