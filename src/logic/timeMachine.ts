import type { Entity, Relation, Universe } from '../model/schema'
import { ageIn } from './age'

/**
 * Máquina do tempo: o mundo num ano. Usa o que já existe nas fichas (início e fim), nas
 * ligações (as de período valem só dentro dele) e nos eventos. Nada novo para preencher.
 */

/** A ficha existe neste ano? Sem datas, existe sempre. */
export function existsIn(e: Pick<Entity, 'startYear' | 'endYear'>, year: number): boolean {
  return (e.startYear === null || year >= e.startYear) && (e.endYear === null || year <= e.endYear)
}

/** A ligação vale neste ano? Só as de período dependem do ano. */
export function relationIn(r: Relation, year: number): boolean {
  if (r.scope.kind !== 'periodo') return true
  return (r.scope.fromYear === null || year >= r.scope.fromYear) && (r.scope.toYear === null || year <= r.scope.toYear)
}

/** Ligações que dizem quem manda em quê. */
const RULE = /govern|rein|domin|líder|lider|chefe|comand|soberan|imperad|rei de|rainha de|senhor de|senhora de/i

/** Do primeiro ao último ano que o mundo conhece (fichas com data, eventos e ligações de período). */
export function worldBounds(u: Universe): { min: number; max: number } | null {
  const years: number[] = []
  for (const e of u.entities) {
    if (e.startYear !== null) years.push(e.startYear)
    if (e.endYear !== null) years.push(e.endYear)
  }
  for (const ev of u.events) {
    years.push(ev.year)
    if (ev.endYear !== null) years.push(ev.endYear)
  }
  for (const r of u.relations)
    if (r.scope.kind === 'periodo') {
      if (r.scope.fromYear !== null) years.push(r.scope.fromYear)
      if (r.scope.toYear !== null) years.push(r.scope.toYear)
    }
  if (!years.length) return null
  return { min: Math.min(...years), max: Math.max(...years) }
}

export interface WorldAt {
  /** Personagens vivos, com a idade quando se sabe. */
  alive: { entity: Entity; age: number | null }[]
  /** Ainda não tinham nascido (ou sido fundados). */
  notYet: Entity[]
  /** Já tinham morrido (ou acabado). */
  gone: Entity[]
  /** Quem mandava em quê. */
  rulers: { ruler: Entity; realm: Entity; type: string }[]
  /** Lugares, reinos e facções com data que existiam. */
  standing: Entity[]
  /** Eventos daquele ano ou em andamento. */
  events: Universe['events']
}

export function worldAt(u: Universe, year: number): WorldAt {
  const byIdMap = new Map(u.entities.map((e) => [e.id, e]))
  const dated = u.entities.filter((e) => e.startYear !== null || e.endYear !== null)
  const alive = u.entities
    .filter((e) => e.kind === 'personagem' && e.startYear !== null && existsIn(e, year))
    .map((entity) => ({ entity, age: ageIn(entity, year) }))
    .sort((a, b) => (b.age ?? -1) - (a.age ?? -1))
  const notYet = dated.filter((e) => e.startYear !== null && year < e.startYear)
  const gone = dated.filter((e) => e.endYear !== null && year > e.endYear)
  const rulers = u.relations
    .filter((r) => RULE.test(r.type) && relationIn(r, year))
    .map((r) => ({ ruler: byIdMap.get(r.fromId), realm: byIdMap.get(r.toId), type: r.type }))
    .filter((x): x is { ruler: Entity; realm: Entity; type: string } => Boolean(x.ruler && x.realm && existsIn(x.ruler, year) && existsIn(x.realm, year)))
  const standing = dated.filter((e) => e.kind !== 'personagem' && existsIn(e, year))
  const events = u.events.filter((ev) => (ev.endYear === null ? ev.year === year : ev.year <= year && year <= ev.endYear)).sort((a, b) => a.year - b.year)
  return { alive, notYet, gone, rulers, standing, events }
}
