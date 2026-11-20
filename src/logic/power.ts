import type { Entity, Relation, Universe } from '../model/schema'
import { answerOf } from './kindQuestions'
import { fold } from './text'

/*
 * Poder e tensões (política leve, sem simulação): quem manda em cada lugar, o que cada um produz e precisa
 * (campos "Produz" e "Precisa", que sugerem comércio) e as tensões entre grupos num medidor de três passos,
 * guardado como ligação comum ("em paz com", "em tensão com", "em guerra com").
 */

export const TENSION_LEVELS = [
  { id: 'paz', type: 'em paz com', label: 'Calmo' },
  { id: 'tensao', type: 'em tensão com', label: 'Tenso' },
  { id: 'guerra', type: 'em guerra com', label: 'Em guerra' },
] as const
export type TensionLevel = (typeof TENSION_LEVELS)[number]['id']

/** O nível de uma ligação, se ela for de tensão. */
export function levelOf(type: string): TensionLevel | null {
  const t = fold(type.trim())
  return TENSION_LEVELS.find((l) => fold(l.type) === t)?.id ?? null
}

export interface Tension {
  relation: Relation
  a: Entity
  b: Entity
  level: TensionLevel
}

/** As tensões do mundo (sem as secretas), da pior para a mais calma. */
export function tensionsOf(u: Universe, entityId?: string): Tension[] {
  const ent = new Map(u.entities.map((e) => [e.id, e]))
  const order: TensionLevel[] = ['guerra', 'tensao', 'paz']
  return u.relations
    .filter((r) => r.canon !== 'secreto' && (!entityId || r.fromId === entityId || r.toId === entityId))
    .map((relation) => ({ relation, a: ent.get(relation.fromId), b: ent.get(relation.toId), level: levelOf(relation.type) }))
    .filter((t): t is Tension => !!t.a && !!t.b && t.level !== null)
    .sort((x, y) => order.indexOf(x.level) - order.indexOf(y.level))
}

const RULE = /govern|rein|domin|comand|soberan|senhor de|senhora de/i

/** Quem manda num lugar: ligações de governo que chegam nele. */
export function rulersOf(u: Universe, placeId: string): { entity: Entity; relation: Relation }[] {
  const ent = new Map(u.entities.map((e) => [e.id, e]))
  return u.relations.filter((r) => r.toId === placeId && RULE.test(r.type) && ent.has(r.fromId)).map((relation) => ({ entity: ent.get(relation.fromId)!, relation }))
}

/** "sal, peixe e ferro" vira ['sal', 'peixe', 'ferro']. */
export const goodsOf = (text: string): string[] =>
  text
    .split(/,|;|\s+e\s+/)
    .map((s) => s.trim().replace(/\.$/, ''))
    .filter(Boolean)

export interface Trade {
  from: Entity
  to: Entity
  good: string
}

/** Quem produz o que outro precisa: comércio possível (ou motivo de guerra). Com `entityId`, só os dele. */
export function tradesOf(u: Universe, entityId?: string): Trade[] {
  const withGoods = u.entities
    .filter((e) => e.canon !== 'secreto')
    .map((e) => ({ e, makes: goodsOf(answerOf(e.fields, 'Produz')), needs: goodsOf(answerOf(e.fields, 'Precisa')) }))
    .filter((x) => x.makes.length || x.needs.length)
  const out: Trade[] = []
  for (const a of withGoods)
    for (const b of withGoods) {
      if (a.e.id === b.e.id) continue
      if (entityId && a.e.id !== entityId && b.e.id !== entityId) continue
      for (const good of a.makes) if (b.needs.some((n) => fold(n) === fold(good))) out.push({ from: a.e, to: b.e, good })
    }
  return out
}
