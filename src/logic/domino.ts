import type { Entity, Universe } from '../model/schema'
import { relationVerb } from './relations'

/**
 * Efeito dominó: "e se esta ficha sumir?". Segue as ligações e diz quem sente o golpe e como:
 * quem fica sem governante (e quem poderia herdar), quem perde a quem servir, quem fica de luto,
 * o que fica sem dono, que lugares perdem onde ficavam, e o que vem na segunda onda.
 */
export interface DominoGroup {
  key: string
  title: string
  items: { entity: Entity; why: string }[]
}

export interface Domino {
  groups: DominoGroup[]
  /** Quem pode assumir o que ela governava: filhos e herdeiros. */
  heirs: Entity[]
  /** Segunda onda: ligados aos atingidos (sem repetir). */
  ripple: Entity[]
  /** Fatos e cenas em que aparece. */
  facts: number
  scenes: number
}

const RULE = /govern|rein|domin|líder|lider|chefe|comand|soberan|senhor de|senhora de/i
const FAMILY = /pai de|mãe de|mae de|filh[oa] de|irm[ãa]o? de|irmã de|avô|avó|net[oa] de|prim[oa] de|ti[oa] de|sobrinh/i
const LOVE = /\bama\b|amad|casad|noiv|amante|esposa|marido/i
const SERVE = /serve|aconselh|protege|segue|devot|guarda|treina|cuida/i
const ENEMY = /inimig|rival|caça|odeia|desconfia|persegue|ameaça/i
const OWN = /dono|carrega|possui|guarda|empunha|usa\b/i
const CHILD_OF = /filh[oa] de|herdeir/i
const PARENT_OF = /pai de|mãe de|mae de/i

export function domino(u: Universe, id: string): Domino {
  const byId = new Map(u.entities.map((e) => [e.id, e]))
  const groups = new Map<string, DominoGroup>()
  const put = (key: string, title: string, entity: Entity | undefined, why: string) => {
    if (!entity || entity.id === id) return
    const g = groups.get(key) ?? { key, title, items: [] }
    if (!g.items.some((x) => x.entity.id === entity.id)) g.items.push({ entity, why })
    groups.set(key, g)
  }
  const ruled: Entity[] = []
  const selfName = byId.get(id)?.name ?? ''
  for (const r of u.relations) {
    const out = r.fromId === id
    const inn = r.toId === id
    if (!out && !inn) continue
    const other = byId.get(out ? r.toId : r.fromId)
    const t = r.type.trim()
    // A ligação em frase, para dizer por que a ficha sente o golpe.
    const why = out ? `${selfName} ${relationVerb(t)} ${other?.name ?? ''}` : `${other?.name ?? ''} ${relationVerb(t)} ${selfName}`
    if (RULE.test(t)) {
      if (out) {
        put('governo', 'Ficam sem quem mande', other, why)
        if (other) ruled.push(other)
      } else put('poder', 'Perdem o que comandavam', other, why)
    } else if (FAMILY.test(t)) put('familia', 'A família de luto', other, why)
    else if (LOVE.test(t)) put('amor', 'Perdem quem amam', other, why)
    else if (inn && SERVE.test(t)) put('servem', 'Perdem a quem servir', other, why)
    else if (ENEMY.test(t)) put('inimigos', 'Perdem um inimigo (e ganham espaço)', other, why)
    else if (out && OWN.test(t)) put('posses', 'Ficam sem dono', other, why)
    else put('outras', 'Outras ligações', other, why)
  }
  // Lugares e coisas que ficavam dentro dela.
  for (const e of u.entities) if (e.parentId === id) put('dentro', 'Perdem onde ficavam', e, `ficava em ${selfName}`)

  // Quem poderia herdar o que ela governava: filhos e herdeiros.
  const heirs = new Map<string, Entity>()
  if (ruled.length)
    for (const r of u.relations) {
      if (r.toId === id && CHILD_OF.test(r.type)) heirs.set(r.fromId, byId.get(r.fromId)!)
      if (r.fromId === id && PARENT_OF.test(r.type)) heirs.set(r.toId, byId.get(r.toId)!)
    }

  // Segunda onda: quem está ligado aos atingidos.
  const hit = new Set([id, ...[...groups.values()].flatMap((g) => g.items.map((x) => x.entity.id))])
  const ripple = new Map<string, Entity>()
  for (const r of u.relations) {
    const a = hit.has(r.fromId) && r.fromId !== id
    const b = hit.has(r.toId) && r.toId !== id
    if (a && !hit.has(r.toId)) ripple.set(r.toId, byId.get(r.toId)!)
    if (b && !hit.has(r.fromId)) ripple.set(r.fromId, byId.get(r.fromId)!)
  }

  const self = byId.get(id)
  const names = self ? [self.name, ...self.aliases].filter((n) => n.trim()) : []
  const said = (text: string) => names.some((n) => text.toLocaleLowerCase('pt-BR').includes(n.toLocaleLowerCase('pt-BR')))
  const ORDER = ['governo', 'poder', 'servem', 'familia', 'amor', 'posses', 'dentro', 'inimigos', 'outras']
  return {
    groups: [...groups.values()].sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key)),
    heirs: [...heirs.values()].filter(Boolean),
    ripple: [...ripple.values()].filter(Boolean),
    facts: u.facts.filter((f) => f.subjectId === id || f.objectId === id).length,
    scenes: names.length ? u.scenes.filter((s) => said(s.text)).length : 0,
  }
}
