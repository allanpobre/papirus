import { REVIEW_INFO, type ReviewIssue } from '../logic/review'
import type { BookDesign, Universe } from '../model/schema'
import { bookContent } from './bookDesign'

/*
 * O caminho do manuscrito ao livro, na página do Livro: cada passo diz o que achou, sem
 * cobrar nada. "ok" é que não há o que apontar; "olhar", que há algo simples a resolver (ou
 * que o Papirus resolve sozinho); "neutro" é só informação.
 */

export type StepState = 'ok' | 'olhar' | 'neutro'

export interface PathStep {
  state: StepState
  detail: string
}

const plural = (n: number, one: string, many: string) => `${n.toLocaleString('pt-BR')} ${n === 1 ? one : many}`

/** O texto: quantos capítulos e palavras, e o que fica de fora ou sem título. */
export function textStep(universe: Universe, design: BookDesign, issues: ReviewIssue[]): PathStep & { chapters: number } {
  const { parts, words } = bookContent(universe, design)
  const chapters = parts.reduce((n, p) => n + p.chapters.length, 0)
  if (!chapters) return { state: 'olhar', detail: 'Ainda sem texto: escreva a primeira cena.', chapters }
  const empty = issues.filter((i) => i.kind === 'cena-vazia').length
  const untitled = issues.filter((i) => i.kind === 'sem-titulo').length
  const detail = [
    plural(chapters, 'capítulo', 'capítulos'),
    plural(words, 'palavra', 'palavras'),
    untitled && plural(untitled, 'cena sem título', 'cenas sem título'),
    empty && `${plural(empty, 'cena sem texto fica', 'cenas sem texto ficam')} de fora`,
  ]
    .filter(Boolean)
    .join(' · ')
  return { state: untitled ? 'olhar' : 'ok', detail, chapters }
}

/** Os tipos que o Papirus corrige sozinho (tipografia) e os que são para o autor olhar. */
export const LOOK_KINDS = ['frase-longa', 'repeticao', 'cena-curta', 'grafia'] as const

/** Revisar: quanto o Papirus arruma sozinho e em quantas cenas vale olhar. */
export function reviewStep(issues: ReviewIssue[]): PathStep & { fix: number; look: number } {
  const fix = issues.filter((i) => REVIEW_INFO[i.kind].fixable).length
  const look = new Set(issues.filter((i) => (LOOK_KINDS as readonly string[]).includes(i.kind)).map((i) => i.sceneId)).size
  const detail = [fix && `${plural(fix, 'coisa', 'coisas')} que o Papirus arruma sozinho`, look && `${plural(look, 'cena', 'cenas')} para olhar`].filter(Boolean).join(' · ')
  return { state: fix ? 'olhar' : look ? 'neutro' : 'ok', detail: detail || 'Nada para apontar.', fix, look }
}
