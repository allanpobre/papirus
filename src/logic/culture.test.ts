import { describe, expect, it } from 'vitest'
import { createUniverse, draftEntity } from '../model/universe'
import { dayInLife, feastsOf } from './culture'
import type { Entity } from '../model/schema'

const make = (over: Partial<Entity>): Entity => ({ ...draftEntity('cultura', 'Gente do Sal'), id: 'c', createdAt: '', updatedAt: '', ...over }) as Entity

describe('culturas vivas', () => {
  it('um dia na vida usa só as respostas dadas', () => {
    const u = createUniverse('t')
    const c = make({ fields: [{ key: 'Comida', value: 'peixe seco.' }, { key: 'Tabu', value: 'nunca comer sozinho' }] })
    const text = dayInLife(c, { ...u, entities: [c] })
    expect(text).toContain('No almoço, peixe seco.')
    expect(text).toContain('Ninguém ousa comer sozinho')
    expect(text).not.toContain('Veste')
    expect(dayInLife(make({}), u)).toBe('')
  })
  it('festas na ordem do ano, com o mês do calendário, sem segredos', () => {
    const u = createUniverse('t')
    u.settings.calendarMonths = [{ name: 'Brumal', days: 30 }, { name: 'Solar', days: 30 }]
    const a = make({ id: 'a', feasts: [{ id: 'f1', name: 'Fogueiras', month: 1, about: '' }, { id: 'f2', name: 'Primeira Chuva', month: 0, day: 3, about: '' }] })
    const b = make({ id: 'b', canon: 'secreto', feasts: [{ id: 'f3', name: 'Oculta', about: '' }] })
    const rows = feastsOf({ ...u, entities: [a, b] })
    expect(rows.map((r) => [r.name, r.when])).toEqual([['Primeira Chuva', '3 de Brumal'], ['Fogueiras', 'Solar']])
  })
})
