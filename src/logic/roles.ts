import { STORY_ROLES, type StoryRole } from '../model/schema'

/** A ordem dos papéis na história: protagonista primeiro, quem não tem papel por último. */
export const roleRank = (role: StoryRole | undefined | null): number => {
  const i = role ? STORY_ROLES.indexOf(role) : -1
  return i < 0 ? STORY_ROLES.length : i
}

/** Para ordenar fichas: papel (protagonistas primeiro) e, dentro do mesmo papel, por nome. */
export const compareByRole = (a: { role?: StoryRole | null; name: string }, b: { role?: StoryRole | null; name: string }): number =>
  roleRank(a.role) - roleRank(b.role) || a.name.localeCompare(b.name, 'pt')

/** Um personagem de protagonista: nas Ligações ganha uma bolinha um pouco maior. */
export const isLead = (role: StoryRole | undefined | null): boolean => role === 'protagonista'

/** O raio da bolinha nas Ligações: cresce com o número de ligações; o protagonista ganha um pouco mais (3 px no celular, 4 no computador). */
export function nodeRadius(degree: number, narrow: boolean, lead: boolean): number {
  const base = narrow ? 11 + Math.min(7, degree * 1.1) : 14 + Math.min(10, degree * 1.5)
  return base + (lead ? (narrow ? 3 : 4) : 0)
}
