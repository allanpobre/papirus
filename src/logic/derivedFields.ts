import { formatYear } from '../model/labels'
import { isPast, listsOf, membersOf } from '../model/lists'
import type { Entity, Universe } from '../model/schema'
import { entityName } from '../model/universe'
import { ageIn, ageLabel } from './age'
import { isBlank } from './kindQuestions'
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

/**
 * As fichas que as ligações (e os papéis nas listas) dão para o campo `key` desta ficha.
 * `openOnly` deixa de fora ligações e fichas secretas (para o que sai do app ou vai para a IA sem segredos).
 */
export function derivedField(u: Universe, e: Entity, key: string, { openOnly = false }: { openOnly?: boolean } = {}): string[] {
  const k = linkKey(key)
  if (!k) return []
  const ids: string[] = []
  const add = (id: string) => {
    if (id === e.id || ids.includes(id)) return
    if (openOnly && u.entities.find((x) => x.id === id)?.canon === 'secreto') return
    ids.push(id)
  }
  for (const r of u.relations) {
    if (r.listId || isPast(r) || (r.toId !== e.id && r.fromId !== e.id) || (openOnly && r.canon === 'secreto')) continue
    const t = linkKey(r.type)
    if (t !== k) continue
    if (r.toId === e.id) add(r.fromId)
    else if (BOTH_WAYS.has(t)) add(r.toId)
  }
  for (const l of listsOf(e)) for (const { relation, member } of membersOf(u, e.id, l.id)) if (relation.role && !isPast(relation) && !(openOnly && relation.canon === 'secreto') && linkKey(relation.role) === k) add(member.id)
  return ids
}

/** O "agora" da história: o ano mais tardio das cenas com data (o mesmo da tabela do Mundo). */
export function storyNow(u: Universe): number | null {
  let max: number | null = null
  for (const s of u.scenes) if (typeof s.date?.year === 'number' && (max === null || s.date.year > max)) max = s.date.year
  return max
}

const PLAYER_KEYS = new Set(['jogador', 'jogadora', 'quem joga', 'jogado por'])

/**
 * Um campo vazio que outra parte do app já sabe, em texto: a "Idade" (pelo nascimento e o ano
 * mais tardio das cenas) e o que está na ficha de jogo ligada a esta ficha ("Jogador", "Classe", "Raça").
 */
export function derivedText(u: Universe, e: Entity, key: string): { text: string; via: string } | null {
  const k = fold(key.trim())
  if (!k) return null
  if (k === 'idade') {
    const now = storyNow(u)
    const age = ageIn(e, now)
    if (age !== null && now !== null) return { text: `${ageLabel(age)} em ${formatYear(now, u.settings.calendarSuffix)}`, via: 'pelo nascimento' }
  }
  for (const s of u.sheets) {
    if (s.entityId !== e.id) continue
    if (PLAYER_KEYS.has(k) && s.role === 'pj' && s.player.trim()) return { text: s.player.trim(), via: 'pela ficha de jogo' }
    for (const [sk, v] of Object.entries(s.fields)) {
      const f = fold(sk.trim())
      if (v.trim() && (f === k || f.startsWith(`${k} `))) return { text: v.trim(), via: 'pela ficha de jogo' }
    }
  }
  return null
}

/** O que um campo vazio mostra, e de onde vem: "Malkai" pelas ligações, "34 anos em 1342" pelo nascimento. */
export function derivedValue(u: Universe, e: Entity, key: string, opts: { openOnly?: boolean } = {}): { text: string; via: string } | null {
  const ids = derivedField(u, e, key, opts)
  if (ids.length) return { text: ids.map((id) => entityName(u, id)).join(', '), via: 'pelas ligações' }
  return derivedText(u, e, key)
}

/** Para o campo vazio em Editar: "Malkai · pelas ligações", "34 anos em 1342 · pelo nascimento". */
export function derivedHint(u: Universe, e: Entity, key: string, opts: { openOnly?: boolean } = {}): string | null {
  const v = derivedValue(u, e, key, opts)
  return v ? `${v.text} · ${v.via}` : null
}

/** Só com o nome: sem texto, sem campo preenchido e sem nada que a ligue ao resto do mundo. */
export function onlyName(u: Universe, e: Entity): boolean {
  if (!isBlank(e) || e.aliases.length || e.tags.length || e.image || e.parentId) return false
  if (u.relations.some((r) => r.fromId === e.id || r.toId === e.id || r.via.some((v) => v.entityId === e.id))) return false
  if (u.facts.some((f) => f.subjectId === e.id || f.objectId === e.id)) return false
  if (u.events.some((ev) => ev.entityIds.includes(e.id) || ev.placeId === e.id)) return false
  if (u.entities.some((x) => x.parentId === e.id)) return false
  return !u.entities.some((x) => x.fields.some((f) => f.type === 'ficha' && f.ref === e.id))
}
