import { describe, expect, it } from 'vitest'
import { createUniverse } from '../model/universe'
import { dayToMonth, daysInYear, formatDate, monthToDay } from './calendar'

const months = [
  { name: 'Degelo', days: 30 },
  { name: 'Neblina', days: 31 },
  { name: 'Cinzas', days: 28 },
]

describe('calendário próprio', () => {
  it('converte dia do ano em mês e dia, e volta', () => {
    expect(dayToMonth(months, 1)).toEqual({ month: 0, dayOfMonth: 1 })
    expect(dayToMonth(months, 30)).toEqual({ month: 0, dayOfMonth: 30 })
    expect(dayToMonth(months, 31)).toEqual({ month: 1, dayOfMonth: 1 })
    expect(dayToMonth(months, 89)).toEqual({ month: 2, dayOfMonth: 28 })
    expect(monthToDay(months, 1, 12)).toBe(42)
    expect(daysInYear(months)).toBe(89)
  })

  it('escreve a data por extenso, com ou sem meses', () => {
    const u = createUniverse()
    const withSuffix = { ...u, settings: { ...u.settings, calendarSuffix: 'DC' } }
    expect(formatDate(withSuffix, { year: 359, day: 12 })).toBe('ano 359 DC, dia 12')
    expect(formatDate(withSuffix, { year: 359, day: null })).toBe('ano 359 DC')
    const withMonths = { ...withSuffix, settings: { ...withSuffix.settings, calendarMonths: months } }
    expect(formatDate(withMonths, { year: 359, day: 42 })).toBe('12 de Neblina de 359 DC')
    expect(formatDate(withMonths, null)).toBe('')
  })
})
