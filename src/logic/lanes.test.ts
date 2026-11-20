import { describe, expect, it } from 'vitest'
import { ostriaUniverse } from '../model/sampleOstria'
import { lanesOf, outOfOrder, storyYear } from './lanes'
import { manuscriptOrder } from '../model/universe'

describe('linha do tempo em faixas', () => {
  const u = ostriaUniverse()
  const events = u.events.filter((e) => e.kind === 'evento')
  it('uma faixa por personagem, mais "Mundo" para o resto; segredos não viram faixa', () => {
    const lanes = lanesOf(u, events, 'personagem')
    expect(lanes[0].name).toBe('Mundo')
    expect(lanes.some((l) => l.name.startsWith('Vaelor') || l.events.some((e) => e.title === 'Nascimento de Vaelor'))).toBe(true)
    const secret = u.entities.filter((e) => e.canon === 'secreto').map((e) => e.id)
    expect(lanes.some((l) => secret.includes(l.id))).toBe(false)
  })
  it('consequência antes da causa aparece como fora de ordem', () => {
    expect(outOfOrder(events)).toEqual([])
    const fech = events.find((e) => e.title === 'Fechamento da Torre')!
    const moved = events.map((e) => (e.id === fech.id ? { ...e, year: 300 } : e))
    expect(outOfOrder(moved).map((o) => o.effect.title)).toEqual(['Fechamento da Torre'])
  })
  it('o ano da história vem da cena escolhida', () => {
    const first = manuscriptOrder(u)[0]
    expect(storyYear(u, first.id)).toBe(359)
    expect(storyYear(u, null)).toBeNull()
  })
})
