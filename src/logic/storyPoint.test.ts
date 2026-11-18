import { describe, expect, it } from 'vitest'
import { ostriaUniverse } from '../model/sampleOstria'
import { manuscriptOrder } from '../model/universe'
import { derivedText } from './derivedFields'
import { knownAt, partsAt, pointIndex, readerTextAt, yearAt } from './storyPoint'

describe('o ponto da história', () => {
  const u = ostriaUniverse()
  const order = manuscriptOrder(u)
  const at = (title: string) => order.findIndex((s) => s.title === title)

  it('a posição é a da cena na ordem de leitura; sem cena (ou cena apagada) é o fim', () => {
    expect(pointIndex(order, order[2].id)).toBe(2)
    expect(pointIndex(order, null)).toBe(order.length - 1)
    expect(pointIndex(order, 'nao-existe')).toBe(order.length - 1)
  })

  it('o ano naquele ponto é o da última cena com data até ali', () => {
    const dated = order.map((s, i) => ({ ...s, date: i === 0 ? { year: 300, day: null } : i === 2 ? { year: 305, day: null } : null }))
    expect(yearAt(dated, 0)).toBe(300)
    expect(yearAt(dated, 1)).toBe(300)
    expect(yearAt(dated, 2)).toBe(305)
    expect(yearAt(dated.map((s) => ({ ...s, date: null })), 3)).toBeNull()
  })

  it('o texto da ficha se divide no que já se sabe, no que é segredo e no que só se revela depois', () => {
    const text = 'Fala pouco. [a partir de "O retrato"]Tem os olhos do príncipe.[/a partir] [segredo]É Vaelor.[/segredo]'
    const antes = partsAt(text, at('O retrato') - 1, order)
    expect(antes.find((p) => p.text.includes('olhos'))).toMatchObject({ future: true, revealTitle: 'O retrato', revealAt: at('O retrato') })
    expect(antes.find((p) => p.text.includes('Vaelor'))).toMatchObject({ secret: true })
    const depois = partsAt(text, at('O retrato'), order)
    expect(depois.find((p) => p.text.includes('olhos'))!.future).toBe(false)
    // O leitor: nunca o segredo; o trecho só a partir da cena.
    expect(readerTextAt(text, at('O retrato') - 1, order)).toBe('Fala pouco.')
    expect(readerTextAt(text, at('O retrato'), order)).toBe('Fala pouco. Tem os olhos do príncipe.')
    // Cena que não existe mais: fica escondido do leitor, por segurança.
    expect(readerTextAt('A [a partir de "Sumiu"]B[/a partir]', order.length - 1, order)).toBe('A')
  })

  it('o leitor só conhece a ficha a partir da primeira cena em que ela aparece', () => {
    const mira = u.entities.find((e) => e.name === 'Mira')!
    const { first } = knownAt(u, order, mira, order.length - 1)
    expect(first).not.toBeNull()
    expect(knownAt(u, order, mira, first!).known).toBe(true)
    if (first! > 0) expect(knownAt(u, order, mira, first! - 1).known).toBe(false)
  })

  it('a idade vazia se calcula no ano do ponto escolhido (e no "agora" da história sem ponto)', () => {
    const kael = { ...u.entities.find((e) => e.name === 'Kael')!, startYear: 340, endYear: null }
    expect(derivedText(u, kael, 'Idade', 350)?.text).toMatch(/^10 anos em/)
    expect(derivedText(u, kael, 'Idade', 359)?.text).toMatch(/^19 anos em/)
    expect(derivedText(u, kael, 'Idade')?.text).toMatch(/^19 anos em/)
  })
})
