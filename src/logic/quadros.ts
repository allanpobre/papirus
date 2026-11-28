import { levelOf } from './power'
import { fold } from './text'
import type { Entity, Universe } from '../model/schema'
import { byId } from '../model/universe'

/**
 * Diplomacia, em Ligações: quem é aliado, rival ou está em guerra com quem, entre facções e reinos. Sai das ligações
 * que a pessoa já escreveu ("aliado de", "em guerra com"…): nada a desenhar à mão. (A Família já tem a sua, em logic/family.ts.)
 */

// ---------------------------------------------------------------- diplomacia

export type Tone = 'alianca' | 'guerra' | 'tensa' | 'outra'
export const TONE_LABEL: Record<Tone, string> = { alianca: 'Aliança e paz', guerra: 'Guerra e rivalidade', tensa: 'Tensão', outra: 'Outras ligações' }
export const DIPLOMACY_KINDS = ['faccao', 'reino']
/** Onde o medidor de tensões (Calmo · Tenso · Em guerra) aparece na ficha: o quadro lê as mesmas tensões, entre estes tipos. */
export const TENSION_KINDS = ['faccao', 'reino', 'lugar', 'cultura', 'religiao', 'especie']
/** Esta ligação entra na diplomacia? Uma tensão vale entre qualquer um dos tipos acima; as outras ligações, só entre facções e reinos. */
const kindsFor = (type: string) => (levelOf(type) ? TENSION_KINDS : DIPLOMACY_KINDS)

/** A cor da ligação, pelo que está escrito no tipo. Ordem: guerra, depois tensão, depois aliança/paz. */
export function toneOf(type: string): Tone {
  const t = fold(type)
  if (/guerr|inimig|rival|hostil|ataca|conflit|disputa|odei|traid|conquist/.test(t)) return 'guerra'
  if (/tens|tregua|desconf|neutr|fria/.test(t)) return 'tensa'
  if (/alia|pacto|tratado|amig|apoi|comerci|vassal|protege|servi|paz/.test(t)) return 'alianca'
  return 'outra'
}

export interface DiplomacyEdge {
  id: string
  from: string
  to: string
  tone: Tone
  label: string
}

/** Facções e reinos ligados entre si (num ano, se quiser: só vale o que está em vigor nele). */
export function diplomacyOf(u: Universe, { year = null, hideSecrets = false }: { year?: number | null; hideSecrets?: boolean } = {}): { nodes: Entity[]; edges: DiplomacyEdge[] } {
  const ok = (id: string, kinds: string[]) => {
    const e = byId(u, 'entities', id)
    return Boolean(e && kinds.includes(e.kind) && !(hideSecrets && e.canon === 'secreto'))
  }
  const edges: DiplomacyEdge[] = []
  for (const r of u.relations) {
    const kinds = kindsFor(r.type)
    if (r.listId || r.fromId === r.toId || !ok(r.fromId, kinds) || !ok(r.toId, kinds)) continue
    if (hideSecrets && r.canon === 'secreto') continue
    if (year !== null && r.scope.kind === 'periodo') {
      if (r.scope.fromYear !== null && year < r.scope.fromYear) continue
      if (r.scope.toYear !== null && year > r.scope.toYear) continue
    }
    edges.push({ id: r.id, from: r.fromId, to: r.toId, tone: toneOf(r.type), label: r.type })
  }
  const ids = new Set(edges.flatMap((e) => [e.from, e.to]))
  const nodes = [...ids].flatMap((id) => {
    const e = byId(u, 'entities', id)
    return e ? [e] : []
  })
  return { nodes: nodes.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), edges }
}

/** Os anos em que alguma ligação entre facções/reinos começa ou termina (para o controle de ano). */
export function diplomacyYears(u: Universe): number[] {
  const ok = (id: string, kinds: string[]) => kinds.includes(byId(u, 'entities', id)?.kind ?? '')
  const years = new Set<number>()
  for (const r of u.relations)
    if (!r.listId && r.scope.kind === 'periodo' && ok(r.fromId, kindsFor(r.type)) && ok(r.toId, kindsFor(r.type))) {
      if (r.scope.fromYear !== null) years.add(r.scope.fromYear)
      if (r.scope.toYear !== null) years.add(r.scope.toYear)
    }
  return [...years].sort((a, b) => a - b)
}
