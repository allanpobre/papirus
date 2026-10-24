import { formatYear, kindLabel } from '../model/labels'
import type { Entity, Fact, Relation, Scene, Universe } from '../model/schema'
import { byId, manuscriptOrder } from '../model/universe'
import { playerTag, factSentence } from './codex'
import { MentionMatcher } from './detection'
import { mentionIdsInDoc } from './doc'
import { activeAt } from './relations'
import { revealIndex, splitReveals } from './reveals'
import { stripSecrets } from './secrets'

/**
 * O caderno do leitor: o que ele já sabe do mundo, cena a cena, sem spoiler.
 * Regras (o autor só marca o que é spoiler):
 * - uma ficha entra no caderno na primeira cena em que aparece (nome no texto, elenco, ponto de vista ou lugar);
 * - o que está na ficha aparece junto, menos os trechos [a partir de "Cena"], que esperam a cena;
 * - fatos entram quando a cena de onde vieram é lida (e as fichas envolvidas já apareceram);
 * - relações entram quando as duas fichas já apareceram; as que valem só numa história ou em cenas, quando chegam lá;
 * - nada secreto entra (fichas, fatos, relações secretas e trechos [segredo]).
 */
export interface ReaderEntity {
  entity: Entity
  /** Cena (posição no manuscrito) em que apareceu pela primeira vez. */
  first: number
  summary: string
  description: string
  fields: { key: string; value: string }[]
}

export interface ReaderItem {
  /** Cena em que o leitor fica sabendo. */
  at: number
  text: string
  tag: string
  /** Fichas envolvidas (para filtrar e destacar). */
  entityIds: string[]
  kind: 'fato' | 'relacao' | 'trecho'
}

export interface ReaderBook {
  scenes: Scene[]
  /** Primeira aparição de cada ficha. */
  first: Map<string, number>
  /** Fichas que aparecem em cada cena. */
  inScene: Map<string, Set<string>>
  entities: Map<string, Entity>
  facts: ReaderItem[]
  relations: ReaderItem[]
  events: ReaderEvent[]
}

export interface ReaderEvent {
  at: number
  id: string
  year: number
  when: string
  title: string
  description: string
  entityIds: string[]
}

const isSecret = (canon: string) => canon === 'secreto'

/** Prepara o livro uma vez: aparições, fatos e relações com a cena em que o leitor os conhece. */
/**
 * Em que cena cada ficha aparece pela primeira vez: nome ou apelido no texto, menção vinculada,
 * elenco, ponto de vista ou lugar da cena. Serve ao caderno do leitor e ao grafo "num ponto da história".
 */
export function appearances(scenes: Scene[], entities: Entity[]): { first: Map<string, number>; inScene: Map<string, Set<string>> } {
  const known = new Set(entities.map((e) => e.id))
  const matcher = new MentionMatcher(entities)
  const first = new Map<string, number>()
  const inScene = new Map<string, Set<string>>()
  scenes.forEach((s, i) => {
    const ids = new Set<string>()
    for (const m of matcher.find(s.text)) ids.add(m.entityId)
    for (const id of mentionIdsInDoc(s.doc)) ids.add(id)
    for (const id of [...s.presentIds, s.povId, s.placeId]) if (id) ids.add(id)
    for (const id of [...ids]) if (!known.has(id)) ids.delete(id)
    inScene.set(s.id, ids)
    for (const id of ids) if (!first.has(id)) first.set(id, i)
  })
  return { first, inScene }
}

export function readerBook(universe: Universe): ReaderBook {
  const scenes = manuscriptOrder(universe)
  const visible = universe.entities.filter((e) => !isSecret(e.canon))
  const entities = new Map(visible.map((e) => [e.id, e]))
  const { first, inScene } = appearances(scenes, visible)

  const sceneIndex = new Map(scenes.map((s, i) => [s.id, i]))
  const seenAt = (id: string | null) => (id === null ? -1 : (first.get(id) ?? null))

  const facts: ReaderItem[] = []
  for (const f of universe.facts) {
    const at = factAt(f, seenAt, sceneIndex)
    if (at === null) continue
    facts.push({ at, text: factSentence(universe, f), tag: playerTag(universe, f), entityIds: [f.subjectId, f.objectId].filter((x): x is string => Boolean(x)), kind: 'fato' })
  }

  const relations: ReaderItem[] = []
  for (const r of universe.relations) {
    const at = relationAt(r, scenes, seenAt)
    if (at === null) continue
    relations.push({ at, text: '', tag: '', entityIds: [r.fromId, r.toId], kind: 'relacao' })
    relations[relations.length - 1].text = relationText(universe, r, at, first)
  }

  // Eventos da linha do tempo: entram quando tudo que está ligado a eles já apareceu.
  const suffix = universe.settings.calendarSuffix
  const events: ReaderEvent[] = []
  for (const ev of universe.events) {
    if (isSecret(ev.canon)) continue
    const ids = [...ev.entityIds, ev.placeId].filter((x): x is string => Boolean(x))
    if (ids.some((id) => !entities.has(id))) continue
    const seen = ids.map((id) => first.get(id))
    if (seen.some((x) => x === undefined)) continue
    events.push({
      at: Math.max(0, ...(seen as number[])),
      id: ev.id,
      year: ev.year,
      when: ev.endYear !== null ? `${formatYear(ev.year, suffix)} – ${formatYear(ev.endYear, suffix)}` : formatYear(ev.year, suffix),
      title: ev.title,
      description: ev.description,
      entityIds: ids,
    })
  }

  return {
    scenes,
    first,
    inScene,
    entities,
    facts: facts.sort((a, b) => a.at - b.at),
    relations: relations.sort((a, b) => a.at - b.at),
    events: events.sort((a, b) => a.year - b.year),
  }
}

function factAt(f: Fact, seenAt: (id: string | null) => number | null, sceneIndex: Map<string, number>): number | null {
  if (isSecret(f.canon)) return null
  const subject = seenAt(f.subjectId)
  const object = seenAt(f.objectId)
  const speaker = f.speakerId ? seenAt(f.speakerId) : -1
  if (subject === null || object === null || speaker === null) return null
  const source = f.sourceSceneId ? sceneIndex.get(f.sourceSceneId) : -1
  if (source === undefined) return null
  return Math.max(subject, object, speaker, source, 0)
}

function relationAt(r: Relation, scenes: Scene[], seenAt: (id: string | null) => number | null): number | null {
  if (isSecret(r.canon)) return null
  const from = seenAt(r.fromId)
  const to = seenAt(r.toId)
  if (from === null || to === null) return null
  const both = Math.max(from, to)
  if (r.scope.kind === 'geral' || r.scope.kind === 'periodo') return both
  for (let i = both; i < scenes.length; i++) if (activeAt(r, scenes[i])) return i
  return null
}

function relationText(universe: Universe, r: Relation, at: number, first: Map<string, number>): string {
  const name = (id: string) => byId(universe, 'entities', id)?.name ?? '?'
  // Quem está por trás só aparece se o leitor já conhece essa ficha.
  const via = r.via.filter((v) => (first.get(v.entityId) ?? Infinity) <= at && !isSecret(byId(universe, 'entities', v.entityId)?.canon ?? 'secreto'))
  return `${name(r.fromId)} ${r.type} ${name(r.toId)}${via.length ? `, ${via.map((v) => `${v.role || 'com'} ${name(v.entityId)}`).join(', ')}` : ''}`
}

/** Texto como o leitor o vê depois de ler até a cena `upto`. */
export function readerText(text: string, upto: number, scenes: Scene[]): string {
  const parts = splitReveals(stripSecretsKeepingReveals(text))
  return parts
    .filter((p) => {
      if (p.sceneTitle === null) return true
      const i = revealIndex(p, scenes)
      // Cena não encontrada (apagada ou renomeada sem o #id): fica escondido, por segurança.
      return i !== null && i <= upto
    })
    .map((p) => p.text)
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ {2,}/g, ' ')
    .trim()
}

/** Tira [segredo] sem mexer nas marcações de revelação. */
function stripSecretsKeepingReveals(text: string): string {
  return /\[segredo\]/i.test(text) ? stripSecrets(text) : text
}

/** Trechos de fichas que se revelam exatamente na cena `at` (para "Você descobriu"). */
export function revealedPassages(book: ReaderBook, at: number, upto: number): ReaderItem[] {
  const out: ReaderItem[] = []
  for (const [id, e] of book.entities) {
    const seen = book.first.get(id)
    if (seen === undefined || seen > upto) continue
    for (const source of [e.summary, e.description, ...e.fields.map((f) => f.value)]) {
      for (const p of splitReveals(stripSecretsKeepingReveals(source))) {
        if (p.sceneTitle === null) continue
        const i = revealIndex(p, book.scenes)
        if (i === null) continue
        // Se a ficha só aparece depois da cena marcada, o trecho chega junto com ela.
        const when = Math.max(i, seen)
        if (when === at && p.text.trim()) out.push({ at, text: p.text.trim(), tag: e.name, entityIds: [id], kind: 'trecho' })
      }
    }
  }
  return out
}

/** Fichas conhecidas até a cena `upto`, com o texto já filtrado. */
export function readerEntities(book: ReaderBook, upto: number): ReaderEntity[] {
  const out: ReaderEntity[] = []
  for (const [id, e] of book.entities) {
    const at = book.first.get(id)
    if (at === undefined || at > upto) continue
    out.push({
      entity: e,
      first: at,
      summary: readerText(e.summary, upto, book.scenes),
      description: readerText(e.description, upto, book.scenes),
      fields: e.fields.map((f) => ({ key: f.key, value: readerText(f.value, upto, book.scenes) })).filter((f) => f.key.trim() && f.value),
    })
  }
  return out.sort((a, b) => a.first - b.first || a.entity.name.localeCompare(b.entity.name))
}

/** O que o leitor descobre ao ler a cena `at`. */
export function discoveries(book: ReaderBook, at: number) {
  const scene = book.scenes[at]
  const newEntities = scene ? [...(book.inScene.get(scene.id) ?? [])].filter((id) => book.first.get(id) === at).map((id) => book.entities.get(id)!) : []
  return {
    entities: newEntities,
    items: [...revealedPassages(book, at, at), ...book.facts.filter((f) => f.at === at), ...book.relations.filter((r) => r.at === at)],
  }
}

export const entityKindLabel = (e: Entity) => kindLabel(e.kind)
