import type { Entity, Relation, Universe } from '../model/schema'
import { fold } from './text'

/*
 * Panteão e crenças, só com ligações (nada de estrutura nova, para valer na wiki, no grafo e no leitor):
 * deus → religião "é deus de" (o domínio vai na nota), deus → deus "é filho de", lenda → deus ou religião
 * (qualquer ligação com uma ficha de lenda) e povo ou pessoa → religião "acredita em".
 */

export const GOD_OF = 'é deus de'
export const BELIEVES = 'acredita em'
const isType = (r: Relation, t: string) => fold(r.type.trim()) === fold(t)
const isChild = (r: Relation) => /^(e )?filh[oa] de$/.test(fold(r.type.trim()))

export interface God {
  entity: Entity
  relation: Relation
  /** O domínio (a nota da ligação): "o mar e os afogados". */
  domain: string
  /** Ids dos pais que também são deuses deste panteão. */
  parents: string[]
  myths: Entity[]
}

export interface Pantheon {
  gods: God[]
  believers: { entity: Entity; relation: Relation }[]
  /** Lendas ligadas à própria religião (não a um deus). */
  myths: Entity[]
}

export function pantheonOf(u: Universe, religionId: string): Pantheon {
  const ent = new Map(u.entities.map((e) => [e.id, e]))
  const godRels = u.relations.filter((r) => r.toId === religionId && isType(r, GOD_OF) && ent.has(r.fromId))
  const godIds = new Set(godRels.map((r) => r.fromId))
  const mythsOf = (id: string) =>
    u.relations
      .filter((r) => r.fromId === id || r.toId === id)
      .map((r) => ent.get(r.fromId === id ? r.toId : r.fromId))
      .filter((e): e is Entity => !!e && e.kind === 'documento')
      .filter((e, i, all) => all.findIndex((x) => x.id === e.id) === i)
  const gods = godRels.map((relation) => ({
    entity: ent.get(relation.fromId)!,
    relation,
    domain: relation.note.trim(),
    parents: u.relations.filter((r) => r.fromId === relation.fromId && isChild(r) && godIds.has(r.toId)).map((r) => r.toId),
    myths: mythsOf(relation.fromId),
  }))
  const believers = u.relations
    .filter((r) => r.toId === religionId && isType(r, BELIEVES) && ent.has(r.fromId))
    .map((relation) => ({ entity: ent.get(relation.fromId)!, relation }))
  return { gods, believers, myths: mythsOf(religionId) }
}

/** Posição das estrelas: os sem pai no anel de dentro (ou no centro, se for um só), cada filho perto do pai, para fora. Pontos de 0 a 1. */
export function skyLayout(gods: God[]): Map<string, { x: number; y: number }> {
  const pos = new Map<string, { x: number; y: number }>()
  const at = (a: number, r: number) => ({ x: 0.5 + Math.cos(a) * r, y: 0.5 + Math.sin(a) * r * 0.85 })
  const angle = new Map<string, number>()
  const roots = gods.filter((g) => g.parents.length === 0)
  if (roots.length === 1) {
    pos.set(roots[0].entity.id, { x: 0.5, y: 0.5 })
    angle.set(roots[0].entity.id, -Math.PI / 2)
  } else
    roots.forEach((g, i) => {
      const a = (i / roots.length) * Math.PI * 2 - Math.PI / 2
      angle.set(g.entity.id, a)
      pos.set(g.entity.id, at(a, 0.2))
    })
  // Filhos em volta do primeiro pai já posto: um leque para fora (com um pai só no centro, a volta toda).
  let rest = gods.filter((g) => !pos.has(g.entity.id))
  for (let ring = 1; rest.length && ring < 4; ring++) {
    const byParent = new Map<string, God[]>()
    for (const g of rest) {
      const parent = g.parents.find((id) => pos.has(id))
      if (parent) byParent.set(parent, [...(byParent.get(parent) ?? []), g])
    }
    if (!byParent.size) break
    for (const [parent, kids] of byParent) {
      const center = roots.length === 1 && ring === 1
      const base = angle.get(parent) ?? 0
      const spread = center ? (Math.PI * 2) / kids.length : Math.min(0.9, 1.6 / kids.length)
      kids.forEach((k, j) => {
        const a = center ? base + j * spread : base + (j - (kids.length - 1) / 2) * spread
        angle.set(k.entity.id, a)
        pos.set(k.entity.id, at(a, Math.min(0.42, (roots.length === 1 ? 0.12 : 0.2) + ring * 0.2)))
      })
    }
    rest = rest.filter((g) => !pos.has(g.entity.id))
  }
  // Quem sobrou (pais fora do panteão): no anel de fora.
  rest.forEach((g, i) => pos.set(g.entity.id, at((i / rest.length) * Math.PI * 2, 0.42)))
  return pos
}
