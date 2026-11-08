import { isPast, listsOf, membersOf } from '../model/lists'
import type { Entity, Universe } from '../model/schema'
import { fold } from './text'

/*
 * Um campo vazio que as ligações já respondem: "Malkai líder de Nova Gyudenvän" preenche o
 * "Líder" da facção; "Porto inimigo de Nova Gyudenvän", os "Inimigos"; "Rhea governa Porto",
 * o "Quem governa" do lugar; o papel "líder" numa lista também. Assim não se escreve duas vezes.
 */

/** Nomes diferentes para a mesma ligação. */
const SAME: Record<string, string> = {
  governante: 'governa',
  'quem governa': 'governa',
  'quem manda': 'governa',
  soberano: 'governa',
  soberana: 'governa',
  rei: 'governa',
  rainha: 'governa',
  chefe: 'lider',
  comandante: 'lider',
  fundador: 'fundou',
  fundadora: 'fundou',
  criador: 'criou',
  criadora: 'criou',
}

/** Ligações que valem dos dois lados: se A é inimigo de B, B também é de A. */
const BOTH_WAYS = new Set(['aliado', 'aliada', 'inimigo', 'inimiga', 'rival', 'irmao', 'irma', 'casado', 'casada', 'amigo', 'amiga'])

/** O miolo de um nome de campo ou de ligação: "Inimigos" e "inimigo de" dão "inimigo". */
export function linkKey(text: string): string {
  let k = fold(text.trim()).replace(/\s+/g, ' ')
  k = k.replace(/\s+(de|da|do|das|dos|a|ao|com|em)$/, '')
  k = SAME[k] ?? k
  k = k.replace(/^quem\s+/, '')
  if (k.length > 4 && /[rz]es$/.test(k)) k = k.slice(0, -2)
  else if (k.length > 3 && k.endsWith('s')) k = k.slice(0, -1)
  return SAME[k] ?? k
}

/** As fichas que as ligações (e os papéis nas listas) dão para o campo `key` desta ficha. */
export function derivedField(u: Universe, e: Entity, key: string): string[] {
  const k = linkKey(key)
  if (!k) return []
  const ids: string[] = []
  const add = (id: string) => {
    if (id !== e.id && !ids.includes(id)) ids.push(id)
  }
  for (const r of u.relations) {
    if (r.listId || isPast(r) || (r.toId !== e.id && r.fromId !== e.id)) continue
    const t = linkKey(r.type)
    if (t !== k) continue
    if (r.toId === e.id) add(r.fromId)
    else if (BOTH_WAYS.has(t)) add(r.toId)
  }
  for (const l of listsOf(e)) for (const { relation, member } of membersOf(u, e.id, l.id)) if (relation.role && !isPast(relation) && linkKey(relation.role) === k) add(member.id)
  return ids
}
