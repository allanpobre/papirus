import type { BookDesign, Scene, SceneDoc, Universe } from '../model/schema'
import { scenesOf } from '../model/universe'
import { storiesOf } from '../export/bookDesign'
import { fold } from './text'

/**
 * Revisão antes de publicar: aponta, não corrige sozinho. As correções de tipografia
 * (aspas, reticências, travessão, espaços) têm um botão para aplicar no livro todo,
 * com desfazer; o resto é sugestão para o autor decidir.
 */
export type ReviewKind =
  | 'cena-vazia'
  | 'cena-curta'
  | 'repeticao'
  | 'frase-longa'
  | 'aspas'
  | 'reticencias'
  | 'travessao'
  | 'espacos'
  | 'grafia'
  | 'sem-titulo'

export interface ReviewIssue {
  kind: ReviewKind
  sceneId: string
  sceneTitle: string
  /** Trecho onde aparece (curto). */
  excerpt: string
  message: string
  /** Na repetição: a palavra (para juntar por palavra e poder ignorar). */
  word?: string
}

export const REVIEW_INFO: Record<ReviewKind, { title: string; hint: string; fixable: boolean }> = {
  'cena-vazia': { title: 'Cenas vazias', hint: 'Não entram no livro. Escreva, ou tire da história.', fixable: false },
  'cena-curta': { title: 'Cenas muito curtas', hint: 'Menos de 40 palavras. Às vezes é de propósito.', fixable: false },
  repeticao: { title: 'Palavras repetidas perto', hint: 'A mesma palavra duas vezes em poucas linhas.', fixable: false },
  'frase-longa': { title: 'Frases muito longas', hint: 'Mais de 45 palavras sem ponto. Leitores cansam.', fixable: false },
  aspas: { title: 'Aspas retas', hint: 'No livro, "assim" vira “assim”.', fixable: true },
  reticencias: { title: 'Reticências com três pontos', hint: '"..." vira "…" (um caractere só, não quebra no fim da linha).', fixable: true },
  travessao: { title: 'Hífen no lugar de travessão', hint: 'Falas e incisos com "-" ou "–" viram "—".', fixable: true },
  espacos: { title: 'Espaços sobrando', hint: 'Espaço duplo, ou espaço antes de vírgula e ponto.', fixable: true },
  grafia: { title: 'Mesmo nome escrito de jeitos diferentes', hint: 'Ex.: "Ostria" e "Óstria". Confira qual é o certo.', fixable: false },
  'sem-titulo': { title: 'Capítulos sem título', hint: 'Os títulos de cena estão ligados na diagramação, mas esta cena não tem.', fixable: false },
}

/** Palavras comuns demais para contar como repetição. */
const STOP = new Set(
  'quando porque porém então entre sobre depois antes ainda mesmo muito pouco outra outro outras outros sempre nunca tinha tinham havia estava estavam seria seriam disse respondeu perguntou aquele aquela aqueles aquelas esse essa esses essas este esta estes estas isso isto aquilo também apenas assim agora tudo nada alguém ninguém nosso nossa seus suas dele dela deles delas pelo pela pelos pelas como mais menos onde coisa coisas'.split(
    ' ',
  ),
)

const sentenceSplit = /(?<=[.!?…])\s+(?=[—–\-"“«A-ZÁÉÍÓÚÂÊÔÃÕÇ])/u

function excerptAround(text: string, index: number, radius = 50): string {
  const start = Math.max(0, index - radius)
  const end = Math.min(text.length, index + radius)
  return `${start > 0 ? '…' : ''}${text.slice(start, end).replace(/\s+/g, ' ').trim()}${end < text.length ? '…' : ''}`
}

/** As cenas que entram no livro, na ordem. */
export function bookScenes(universe: Universe, d: BookDesign): Scene[] {
  const stories = storiesOf(universe, d)
  return stories.length ? stories.flatMap((s) => scenesOf(universe, s.id)) : scenesOf(universe, null)
}

export function reviewBook(universe: Universe, d: BookDesign): ReviewIssue[] {
  const issues: ReviewIssue[] = []
  const scenes = bookScenes(universe, d)
  const spellings = new Map<string, Map<string, { sceneId: string; title: string; excerpt: string }>>()
  // Nomes de fichas se repetem naturalmente: não contam como repetição.
  const names = new Set(universe.entities.flatMap((e) => [e.name, ...e.aliases]).flatMap((n) => fold(n).split(/[^\p{L}\p{N}]+/u)))
  // Palavras que o autor disse que são tema, não descuido.
  const ignored = new Set((d.reviewIgnore ?? []).map((w) => fold(w)))

  for (const s of scenes) {
    const title = s.title || 'Sem título'
    const add = (kind: ReviewKind, excerpt: string, message: string, word?: string) => issues.push({ kind, sceneId: s.id, sceneTitle: title, excerpt, message, ...(word ? { word } : {}) })
    const text = s.text
    const words = text.match(/[\p{L}\p{N}]+(?:[-'’][\p{L}]+)*/gu) ?? []

    if (!text.trim()) {
      add('cena-vazia', '', 'Cena sem texto.')
      continue
    }
    if (words.length < 40) add('cena-curta', excerptAround(text, 0, 60), `${words.length} palavras.`)
    if (d.chapterTitles && d.chapterUnit === 'cena' && !s.title.trim()) add('sem-titulo', excerptAround(text, 0, 40), 'Cena sem título.')

    // Repetição: palavra de 5+ letras de novo dentro de ~30 palavras.
    const seen = new Map<string, number>()
    const reported = new Set<string>()
    const re = /[\p{L}]{5,}/gu
    let i = 0
    for (const m of text.matchAll(re)) {
      const w = fold(m[0])
      if (!STOP.has(w) && !names.has(w) && !ignored.has(w) && !w.endsWith('mente')) {
        const last = seen.get(w)
        if (last !== undefined && i - last <= 30 && !reported.has(w)) {
          reported.add(w)
          add('repeticao', excerptAround(text, m.index), `“${m[0]}” aparece de novo ${i - last} palavras depois.`, m[0].toLocaleLowerCase('pt-BR'))
        }
        seen.set(w, i)
      }
      i++
    }

    for (const sentence of text.split(sentenceSplit)) {
      const n = sentence.match(/\S+/g)?.length ?? 0
      if (n > 45) add('frase-longa', excerptAround(sentence, 0, 70), `${n} palavras numa frase só.`)
    }

    const count = (re: RegExp) => [...text.matchAll(re)]
    const quotes = count(/"/g)
    if (quotes.length) add('aspas', excerptAround(text, quotes[0].index), `${quotes.length} aspas retas.`)
    const dots = count(/\.{3}/g)
    if (dots.length) add('reticencias', excerptAround(text, dots[0].index), `${dots.length} vezes "...".`)
    const dashes = count(/(^|\n)\s*[-–]\s|\s[-–]\s/g)
    if (dashes.length) add('travessao', excerptAround(text, dashes[0].index + 1), `${dashes.length} hífens que parecem travessão.`)
    const spaces = count(/ {2,}|\s+[,.;:!?](?!\.)/g)
    if (spaces.length) add('espacos', excerptAround(text, spaces[0].index), `${spaces.length} lugares.`)

    // Grafias: palavras com maiúscula que só diferem por acento.
    for (const m of text.matchAll(/(?<![\p{L}\p{N}])\p{Lu}[\p{L}]{3,}/gu)) {
      // Só nomes no meio da frase: no começo, "Está" e "Esta" seriam falso alarme.
      if (!/[\p{L}\p{N},;:]\s+$/u.test(text.slice(Math.max(0, m.index - 4), m.index))) continue
      const key = fold(m[0])
      const forms = spellings.get(key) ?? new Map()
      if (!forms.has(m[0])) forms.set(m[0], { sceneId: s.id, title, excerpt: excerptAround(text, m.index, 40) })
      spellings.set(key, forms)
    }
  }

  for (const forms of spellings.values()) {
    if (forms.size < 2) continue
    const [first, ...rest] = [...forms.entries()]
    for (const [form, where] of rest) {
      issues.push({ kind: 'grafia', sceneId: where.sceneId, sceneTitle: where.title, excerpt: where.excerpt, message: `“${form}” aqui, “${first[0]}” em “${first[1].title}”.` })
    }
  }
  return issues
}

// ─── Correções de tipografia ─────────────────────────────────────────

interface DocNode {
  type: string
  text?: string
  content?: DocNode[]
}

/** Aspas retas → curvas, considerando o que vem antes. */
function curlyQuotes(t: string): string {
  return t.replace(/"/g, (_m, offset: number, all: string) => (offset === 0 || /[\s([{—–-]/.test(all[offset - 1]) ? '“' : '”'))
}

const FIXES: Partial<Record<ReviewKind, (t: string, startOfParagraph: boolean) => string>> = {
  aspas: (t) => curlyQuotes(t),
  reticencias: (t) => t.replace(/\.{3}/g, '…'),
  travessao: (t, start) => (start ? t.replace(/^\s*[-–]\s/, '— ') : t).replace(/(\s)[-–](\s)/g, '$1—$2'),
  espacos: (t) => t.replace(/ {2,}/g, ' ').replace(/\s+([,.;:!?])(?!\.)/g, '$1'),
}

function fixDoc(doc: SceneDoc, fix: (t: string, start: boolean) => string): SceneDoc {
  const walk = (n: DocNode, start: { v: boolean }): DocNode => {
    if (n.type === 'text' && n.text) {
      const out = fix(n.text, start.v)
      start.v = false
      return { ...n, text: out }
    }
    if (!n.content) return n
    const isBlock = n.type === 'paragraph' || n.type === 'heading'
    const s = isBlock ? { v: true } : start
    return { ...n, content: n.content.map((c) => walk(c, s)) }
  }
  return walk(doc as DocNode, { v: true }) as SceneDoc
}

const textOf = (doc: SceneDoc): string => {
  const parts: string[] = []
  const walk = (n: DocNode, out: string[]) => {
    if (n.type === 'text') out.push(n.text ?? '')
    n.content?.forEach((c) => walk(c, out))
  }
  for (const block of ((doc as DocNode).content ?? []) as DocNode[]) {
    const p: string[] = []
    walk(block, p)
    parts.push(p.join(''))
  }
  return parts.filter((x) => x.trim()).join('\n\n')
}

/** Aplica uma correção de tipografia em todas as cenas do livro. Devolve o universo e quantas cenas mudaram. */
export function applyFix(universe: Universe, d: BookDesign, kind: ReviewKind): { universe: Universe; changed: number } {
  const fix = FIXES[kind]
  if (!fix) return { universe, changed: 0 }
  const ids = new Set(bookScenes(universe, d).map((s) => s.id))
  let changed = 0
  const now = new Date().toISOString()
  const scenes = universe.scenes.map((s) => {
    if (!ids.has(s.id)) return s
    const doc = fixDoc(s.doc, fix)
    if (JSON.stringify(doc) === JSON.stringify(s.doc)) return s
    changed++
    return { ...s, doc, text: textOf(doc), updatedAt: now }
  })
  return { universe: changed ? { ...universe, scenes, updatedAt: now } : universe, changed }
}
