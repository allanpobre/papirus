import type { Entity, Scene, Universe } from '../model/schema'
import { byId } from '../model/universe'
import { chosenOf, passesOf, whoIs, type Trait } from './definers'
import { appearances } from './reader'
import { revealIndex, splitReveals } from './reveals'
import { splitSecrets } from './secrets'

/*
 * O ponto da história: uma cena na ordem de leitura (o manuscrito). Tudo que depende de "até onde a
 * história foi" (a idade, o que o leitor já sabe, o que ainda é segredo) pergunta a mesma coisa:
 * em que posição estamos? `null` é a história toda (depois da última cena).
 */

/** A posição da cena na ordem de leitura; sem cena (ou cena que não existe mais), o fim. */
export function pointIndex(order: Scene[], sceneId: string | null): number {
  if (!sceneId) return order.length - 1
  const i = order.findIndex((s) => s.id === sceneId)
  return i >= 0 ? i : order.length - 1
}

/** O ano do mundo naquele ponto: a data da última cena com data até ali (ou null, sem datas). */
export function yearAt(order: Scene[], index: number): number | null {
  for (let i = Math.min(index, order.length - 1); i >= 0; i--) {
    const y = order[i].date?.year
    if (typeof y === 'number') return y
  }
  return null
}

/** Um pedaço de texto de ficha visto num ponto da história. */
export interface PointPart {
  text: string
  /** Trecho [segredo]: o leitor nunca vê. */
  secret: boolean
  /** Trecho [a partir de "Cena"]: a cena (posição) em que o leitor descobre; `null` = não depende de cena. */
  revealAt: number | null
  /** O título da cena da revelação, para o aviso do autor. */
  revealTitle: string | null
  /** Ainda não revelado neste ponto (o autor vê com aviso; o leitor não vê). */
  future: boolean
  /** Máscara ([até "Cena"]): o que o leitor lê antes da revelação. */
  mask?: boolean
  /** Máscara que o leitor ainda lê neste ponto (antes da cena). */
  maskActive?: boolean
}

/**
 * O texto de uma ficha num ponto da história, em pedaços: o que já se sabe, o que é segredo e o que só se
 * revela mais tarde (com a cena). Um trecho marcado com uma cena que não existe mais conta como futuro,
 * por segurança: o leitor não vê.
 */
export function partsAt(text: string, index: number, order: Scene[]): PointPart[] {
  const out: PointPart[] = []
  for (const r of splitReveals(text)) {
    const at = r.sceneTitle === null ? null : revealIndex(r, order)
    const future = r.sceneTitle !== null && !r.until && (at === null || at > index)
    const title = at !== null ? order[at].title || 'Sem título' : r.sceneTitle || null
    // A máscara vale enquanto a cena não chega (sem a cena, vale sempre).
    const extra = r.until ? { mask: true, maskActive: at === null || index < at } : {}
    for (const s of splitSecrets(r.text)) if (s.text) out.push({ text: s.text, secret: s.secret, revealAt: r.sceneTitle === null ? null : at, revealTitle: r.sceneTitle === null ? null : title, future, ...extra })
  }
  return out
}

/** O texto como o leitor o vê naquele ponto: sem segredos e sem o que ainda não foi revelado. */
export function readerTextAt(text: string, index: number, order: Scene[]): string {
  return partsAt(text, index, order)
    .filter((p) => !p.secret && !p.future && (!p.mask || p.maskActive))
    .map((p) => p.text)
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ {2,}/g, ' ')
    .trim()
}

/**
 * O leitor já conhece a ficha naquele ponto? Ela entra na primeira cena em que aparece (nome no texto,
 * elenco, ponto de vista ou lugar), como no caderno do leitor. Devolve também onde ela aparece primeiro.
 */
export function knownAt(universe: Universe, order: Scene[], entity: Pick<Entity, 'id'>, index: number): { known: boolean; first: number | null } {
  const first = appearances(order, universe.entities).first.get(entity.id) ?? null
  return { known: first !== null && first <= index, first }
}

/** Quando o leitor descobre uma ligação: a cena e o título; sem `reveal`, desde sempre (null). */
export interface RevealInfo {
  /** Posição da cena; `Infinity` se a cena não existe mais (o leitor nunca vê, por segurança). */
  at: number
  title: string
  /** Ainda não revelada no ponto escolhido. */
  future: boolean
}

export function relationRevealAt(r: { reveal?: { sceneId: string } }, index: number, order: Scene[]): RevealInfo | null {
  if (!r.reveal) return null
  const at = order.findIndex((s) => s.id === r.reveal!.sceneId)
  const title = at >= 0 ? order[at].title || 'Sem título' : 'uma cena que não existe mais'
  return { at: at >= 0 ? at : Infinity, title, future: at < 0 || at > index }
}

/** Um item do "Quem é" num ponto da história: a verdade, quando o leitor a descobre e o que ele vê até lá. */
export interface WhoIsRowAt {
  definerId: string
  definerName: string
  /** A verdade (o que o autor escolheu). */
  option: Entity
  traits: Trait[]
  relationId: string
  reveal: RevealInfo | null
  /** O que o leitor vê antes da revelação (outra opção), ou nada. */
  mask: Entity | null
  maskTraits: { key: string; value: string }[]
}

export function whoIsAt(u: Universe, e: Entity, index: number, order: Scene[]): WhoIsRowAt[] {
  const out: WhoIsRowAt[] = []
  for (const row of whoIs(u, e)) {
    if (!row.option) continue
    const chosen = chosenOf(u, e.id, row.definer)
    const relation = chosen ? byId(u, 'relations', chosen.relationId) : undefined
    const reveal = relation ? relationRevealAt(relation, index, order) : null
    const mask = relation?.reveal?.maskId ? (byId(u, 'entities', relation.reveal.maskId) ?? null) : null
    out.push({
      definerId: row.definer.id,
      definerName: row.definer.name,
      option: row.option,
      traits: row.traits,
      relationId: chosen?.relationId ?? '',
      reveal,
      mask,
      maskTraits: mask ? passesOf(mask, row.definer).filter((p) => p.key.trim()) : [],
    })
  }
  return out
}

/** Quando o leitor conhece a ficha inteira (`reveal` da ficha): a cena e se ainda não chegou. */
export function entityRevealAt(e: Pick<Entity, 'reveal'>, index: number, order: Scene[]): RevealInfo | null {
  return e.reveal ? relationRevealAt(e, index, order) : null
}

/**
 * Jogo limpo (como em Obra Dinn e Outer Wilds): o que o leitor teve antes da revelação para desconfiar.
 * Conta as pistas (de Pistas e mistérios) ligadas às fichas, em cenas antes da revelação, e as cenas antes
 * dela em que as fichas já aparecem. Sem nenhuma das duas, a revelação chega do nada.
 */
export function cluesBefore(u: Universe, order: Scene[], entityIds: string[], at: number): { clues: number; scenes: number } {
  const ids = new Set(entityIds)
  const index = new Map(order.map((s, i) => [s.id, i]))
  let clues = 0
  for (const seed of u.seeds) {
    if (!seed.entityIds.some((id) => ids.has(id))) continue
    for (const c of seed.clues) if (c.sceneId && (index.get(c.sceneId) ?? Infinity) < at) clues++
    if (seed.setupSceneId && (index.get(seed.setupSceneId) ?? Infinity) < at) clues++
  }
  const { inScene } = appearances(order, u.entities.map((e) => (ids.has(e.id) ? { ...e, reveal: undefined } : e)))
  let scenes = 0
  for (let i = 0; i < Math.min(at, order.length); i++) if ([...ids].some((id) => inScene.get(order[i].id)?.has(id))) scenes++
  return { clues, scenes }
}
