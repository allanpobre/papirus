import type { Entity, Scene, Universe } from '../model/schema'
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
    const future = r.sceneTitle !== null && (at === null || at > index)
    const title = at !== null ? order[at].title || 'Sem título' : r.sceneTitle || null
    for (const s of splitSecrets(r.text)) if (s.text) out.push({ text: s.text, secret: s.secret, revealAt: r.sceneTitle === null ? null : at, revealTitle: r.sceneTitle === null ? null : title, future })
  }
  return out
}

/** O texto como o leitor o vê naquele ponto: sem segredos e sem o que ainda não foi revelado. */
export function readerTextAt(text: string, index: number, order: Scene[]): string {
  return partsAt(text, index, order)
    .filter((p) => !p.secret && !p.future)
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
