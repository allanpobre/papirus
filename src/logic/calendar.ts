import type { NarrativeDate, Universe } from '../model/schema'

export type Months = Universe['settings']['calendarMonths']

/** Dia do ano (1 em diante) → mês e dia do mês. Dias além do ano ficam no último mês. */
export function dayToMonth(months: Months, day: number): { month: number; dayOfMonth: number } | null {
  if (!months.length || day < 1) return null
  let rest = day
  for (let i = 0; i < months.length; i++) {
    if (rest <= months[i].days || i === months.length - 1) return { month: i, dayOfMonth: rest }
    rest -= months[i].days
  }
  return null
}

/** Mês (índice) e dia do mês → dia do ano. */
export function monthToDay(months: Months, month: number, dayOfMonth: number): number {
  return months.slice(0, month).reduce((n, m) => n + m.days, 0) + dayOfMonth
}

/** Data narrativa por extenso: "12 de Neblina de 359 DC", ou "ano 359, dia 12 DC". */
export function formatDate(universe: Universe, date: NarrativeDate | null): string {
  if (!date) return ''
  const suffix = universe.settings.calendarSuffix
  const year = suffix ? `${date.year} ${suffix}` : String(date.year)
  if (date.day === null) return `ano ${year}`
  const md = dayToMonth(universe.settings.calendarMonths, date.day)
  if (md) return `${md.dayOfMonth} de ${universe.settings.calendarMonths[md.month].name} de ${year}`
  return `ano ${year}, dia ${date.day}`
}

/** Dias num ano do calendário (ou null sem meses). */
export const daysInYear = (months: Months) => (months.length ? months.reduce((n, m) => n + m.days, 0) : null)
