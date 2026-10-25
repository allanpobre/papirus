import type { Entity } from '../model/schema'

/** Idade (em anos do calendário do mundo) num ano; `null` se não dá para saber, ou se ainda não nasceu / já morreu. */
export function ageIn(e: Pick<Entity, 'startYear' | 'endYear'>, year: number | null | undefined): number | null {
  if (e.startYear === null || year === null || year === undefined) return null
  if (year < e.startYear || (e.endYear !== null && year > e.endYear)) return null
  return year - e.startYear
}

export const ageLabel = (n: number) => (n === 0 ? 'recém-nascido' : n === 1 ? '1 ano' : `${n} anos`)
