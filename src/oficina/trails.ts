import { fold } from '../logic/text'
import { ALIENISTA } from '../model/alienistaTexto'
import { GUIDES, sectionOf, type Guide, type GuideId } from './guides'
import { PRACTICE, type Practice } from './practice'
import { exerciseKey, type OficinaProgress } from './progress'
import { wordsOf } from './textCounts'

/*
 * As trilhas da Oficina: cada guia vira um caminho curto. As técnicas do guia viram lições
 * (ler um minuto, escrever dez), depois da terceira vem uma revisão (reescrever o primeiro
 * texto com a técnica nova), nos guias de escrita uma imitação de Machado de Assis, e no fim
 * um desafio com tudo junto.
 */

export type StepKind = 'licao' | 'revisao' | 'imitacao' | 'desafio'

export const STEP_KIND_LABEL: Record<StepKind, string> = {
  licao: 'Lição e treino',
  revisao: 'Revisão',
  imitacao: 'Imitação',
  desafio: 'Desafio da trilha',
}

/** Um trecho curto para a imitação, com as palavras-chave que ficam à vista. */
export interface Passage {
  text: string
  source: string
  keys: string[]
}

export interface TrailStep {
  id: string
  kind: StepKind
  title: string
  /** A técnica (na lição) ou o que fazer neste passo. */
  text: string
  practice: Practice
  /** Revisão: o passo cujo texto volta para ser reescrito. */
  revisits?: string
  passage?: Passage
}

export interface Trail {
  id: GuideId
  guide: Guide
  steps: TrailStep[]
}

/** Quanto tempo e quantas palavras, com os padrões (mestre: textos de preparo, mais curtos). */
export function setupOf(p: Practice, guide: Guide): { minutes: number; target: number } {
  const mestre = sectionOf(guide) === 'mestre'
  return { minutes: p.minutes ?? 10, target: p.target ?? (mestre ? 60 : 150) }
}

/** O trecho de "O Alienista" (capítulo, parágrafo) que cada trilha de escrita imita. */
const PASSAGES: Partial<Record<GuideId, [number, number]>> = {
  fundamentos: [0, 0],
  fantasia: [2, 10],
  ficcao: [3, 0],
  misterio: [4, 42],
  romance: [2, 7],
  terror: [5, 17],
  realismo: [2, 16],
  personagem: [1, 11],
  estrutura: [9, 6],
  dialogo: [4, 37],
  ritmo: [5, 21],
  revisao: [12, 14],
}

const LONG_COMMON = new Set(['enquanto', 'primeiro', 'primeira', 'portanto', 'entretanto', 'qualquer', 'nenhuma', 'nenhum', 'algumas', 'alguns', 'naquele', 'naquela', 'daquele', 'daquela'])

/**
 * As palavras-chave de um trecho: os nomes próprios (com maiúscula fora do começo de frase)
 * e as palavras longas, na ordem em que aparecem.
 */
export function keywordsOf(text: string, max = 7): string[] {
  const tokens = wordsOf(text)
  const upper = (w: string) => /^\p{Lu}/u.test(w)
  const endOf = (j: number) => tokens[j].at + tokens[j].word.length
  // "Dr.", "D.": abreviações, que não contam como nome nem fecham frase.
  const abbreviation = (j: number) => tokens[j].word.length <= 3 && upper(tokens[j].word) && text[endOf(j)] === '.'
  const sentenceStart = (j: number) => {
    const before = text.slice(0, tokens[j].at).trimEnd()
    if (!before || /[!?…—:;]$/u.test(before)) return true
    return before.endsWith('.') && !(j > 0 && abbreviation(j - 1))
  }
  const names: { word: string; at: number }[] = []
  for (let i = 0; i < tokens.length; i++) {
    if (!upper(tokens[i].word) || abbreviation(i)) continue
    // Nomes compostos ficam juntos: "Simão Bacamarte", "Rio de Janeiro".
    let j = i
    while (j + 1 < tokens.length && text.slice(endOf(j), tokens[j + 1].at) === ' ') {
      if (upper(tokens[j + 1].word)) j++
      else if (/^(de|da|do|das|dos)$/.test(tokens[j + 1].word) && j + 2 < tokens.length && text.slice(endOf(j + 1), tokens[j + 2].at) === ' ' && upper(tokens[j + 2].word)) j += 2
      else break
    }
    // No começo da frase, só conta como nome se for composto.
    if (j > i || !sentenceStart(i)) names.push({ word: text.slice(tokens[i].at, endOf(j)), at: tokens[i].at })
    i = j
  }
  const long = tokens.filter((t) => fold(t.word).length >= 8 && !LONG_COMMON.has(fold(t.word)) && !/^\p{Lu}/u.test(t.word))
  const picked: { word: string; at: number }[] = []
  const seen = new Set<string>()
  // Nomes até um pouco mais da metade; o resto, palavras longas.
  const nameRoom = Math.ceil(max / 2) + 1
  for (const t of [...names.slice(0, nameRoom), ...long, ...names.slice(nameRoom)]) {
    const key = fold(t.word)
    if (seen.has(key) || picked.length >= max) continue
    seen.add(key)
    picked.push(t)
  }
  return picked.sort((a, b) => a.at - b.at).map((t) => t.word)
}

export function passageOf(id: GuideId): Passage | null {
  const ref = PASSAGES[id]
  if (!ref) return null
  const chapter = ALIENISTA[ref[0]]
  const text = chapter?.paragrafos[ref[1]]
  if (!text) return null
  return { text, source: `Machado de Assis, O Alienista (1882), “${chapter.titulo}”`, keys: keywordsOf(text) }
}

function buildTrail(guide: Guide): Trail {
  const mestre = sectionOf(guide) === 'mestre'
  const lessons: TrailStep[] = guide.works.map((w, i) => ({
    id: `l${i + 1}`,
    kind: 'licao',
    title: w.title,
    text: w.text,
    practice: PRACTICE[guide.id][i] ?? { prompt: w.text, ask: ['O que você tentou nesta técnica?'] },
  }))
  const steps = lessons.slice(0, 3)
  if (lessons.length >= 3) {
    const [a, , c] = lessons
    steps.push({
      id: 'rev',
      kind: 'revisao',
      title: `Revisão: ${a.title}`,
      text: `Volte no que você escreveu em “${a.title}” e reescreva usando “${c.title}”: ${c.text}`,
      revisits: a.id,
      practice: {
        prompt: `Reescreva o seu texto de “${a.title}” usando “${c.title}”.`,
        target: mestre ? 60 : 120,
        focus: c.practice.focus,
        ask: [`O que mudou com “${c.title}”?`, 'Qual versão você prefere? Por quê?'],
      },
    })
  }
  const passage = mestre ? null : passageOf(guide.id)
  if (passage)
    steps.push({
      id: 'imit',
      kind: 'imitacao',
      title: 'Imitação: Machado de Assis',
      text: 'Leia o trecho com calma. Depois ele some, ficam só as palavras-chave, e você reescreve de memória. No fim, compare os dois lado a lado.',
      passage,
      practice: {
        prompt: 'Reescreva o trecho de memória, com as palavras-chave à vista.',
        minutes: 0,
        target: Math.round(wordsOf(passage.text).length * 0.6),
        ask: ['Você manteve a ordem das ideias do original?', 'O que o original tem que o seu não tem?'],
      },
    })
  steps.push(...lessons.slice(3))
  const ex = guide.exercises[0]
  if (ex)
    steps.push({
      id: 'desafio',
      kind: 'desafio',
      title: `Desafio: ${ex.title}`,
      text: mestre ? 'Junte as técnicas da trilha num preparo só, para a próxima sessão.' : 'Junte as técnicas da trilha num texto mais longo. Leve o tempo que precisar.',
      practice: {
        prompt: ex.prompt,
        minutes: mestre ? 15 : 20,
        target: mestre ? 100 : 300,
        ask: ['Quais técnicas da trilha aparecem no seu texto? Onde?', 'Se fosse refazer amanhã, o que mudaria?'],
      },
    })
  return { id: guide.id, guide, steps }
}

/** As trilhas, na ordem da biblioteca. */
export const TRAILS: Trail[] = GUIDES.map(buildTrail)

export const trailOf = (id: GuideId): Trail => TRAILS.find((t) => t.id === id)!

/** Quanto leva um passo: a leitura e o tempo de escrita. */
export function stepTime(trail: Trail, step: TrailStep): string {
  if (step.kind === 'imitacao') return '1 min lendo · sem relógio'
  const { minutes, target } = setupOf(step.practice, trail.guide)
  return `1 min lendo · ${minutes} min escrevendo${target ? ` · ${target} palavras` : ''}`
}

export const stepKey = (trail: string, step: string) => `${trail}:${step}`

/** Feito: guardado na trilha (ou, no desafio, o exercício do guia já marcado como feito antes das trilhas). */
export function isStepDone(p: OficinaProgress, trail: Trail, step: TrailStep): boolean {
  if (p.steps.includes(stepKey(trail.id, step.id))) return true
  return step.kind === 'desafio' && Boolean(trail.guide.exercises[0]) && p.done.includes(exerciseKey(trail.id, trail.guide.exercises[0].title))
}

export const doneCount = (p: OficinaProgress, trail: Trail) => trail.steps.filter((s) => isStepDone(p, trail, s)).length

export const trailComplete = (p: OficinaProgress, trail: Trail) => doneCount(p, trail) === trail.steps.length

export const nextStep = (p: OficinaProgress, trail: Trail): TrailStep | null => trail.steps.find((s) => !isStepDone(p, trail, s)) ?? null

export const startedTrails = (p: OficinaProgress) => TRAILS.filter((t) => t.id === p.trail || doneCount(p, t) > 0)

/**
 * O passo de hoje: o próximo da trilha escolhida. Trilha completa: o próximo de outra
 * trilha da mesma prateleira que ainda não acabou.
 */
export function todayStep(p: OficinaProgress): { trail: Trail; step: TrailStep } | null {
  const current = trailOf((p.trail as GuideId | null) ?? 'fundamentos')
  const step = nextStep(p, current)
  if (step) return { trail: current, step }
  const section = sectionOf(current.guide)
  for (const t of TRAILS.filter((x) => sectionOf(x.guide) === section)) {
    const s = nextStep(p, t)
    if (s) return { trail: t, step: s }
  }
  return null
}

/** Pedaços do texto, marcando as palavras que passam no teste (para pintar na tela). */
export function segments(text: string, mark: (folded: string) => boolean): { text: string; mark: boolean }[] {
  const out: { text: string; mark: boolean }[] = []
  let at = 0
  for (const { word, at: i } of wordsOf(text)) {
    if (i > at) out.push({ text: text.slice(at, i), mark: false })
    out.push({ text: word, mark: mark(fold(word)) })
    at = i + word.length
  }
  if (at < text.length) out.push({ text: text.slice(at), mark: false })
  return out
}

/**
 * A comparação da imitação: as palavras em comum e quanto do original (palavras de 4 letras
 * ou mais) voltou no texto de quem escreveu, de 0 a 1.
 */
export function compareImitation(original: string, attempt: string): { shared: Set<string>; score: number } {
  const mine = new Set(wordsOf(attempt).map((w) => fold(w.word)))
  const theirs = new Set(wordsOf(original).map((w) => fold(w.word)))
  const shared = new Set([...theirs].filter((w) => mine.has(w)))
  const content = [...theirs].filter((w) => w.length >= 4)
  const score = content.length ? content.filter((w) => mine.has(w)).length / content.length : 0
  return { shared, score }
}
