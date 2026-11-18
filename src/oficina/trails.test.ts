import { describe, expect, it } from 'vitest'
import { MAGICO_DE_OZ } from '../model/ozTexto'
import { GUIDES, sectionOf } from './guides'
import { OZ_TRECHOS } from './ozTrechos'
import { PRACTICE } from './practice'
import type { OficinaProgress } from './progress'
import { compareImitation, doneCount, isStepDone, keywordsOf, nextStep, OZ_THEME_LABEL, ozPassageOf, segments, stepKey, trailComplete, todayStep, trailOf, TRAILS } from './trails'
import { dialogueShare, forbiddenIn, menteWords, nearRepeats, sentenceLengths, speechVerbs, wordsOf } from './textCounts'

const blank = (over: Partial<OficinaProgress> = {}): OficinaProgress => ({ read: [], done: [], steps: [], trail: null, asked: false, notes: {}, ...over })

describe('as trilhas', () => {
  it('cada guia vira uma trilha: lições, revisão, imitação (só na escrita) e desafio', () => {
    expect(TRAILS).toHaveLength(GUIDES.length)
    for (const g of GUIDES) {
      expect(PRACTICE[g.id], g.id).toHaveLength(g.works.length)
      const t = trailOf(g.id)
      const kinds = t.steps.map((s) => s.kind)
      expect(
        kinds.filter((k) => k === 'licao'),
        g.id,
      ).toHaveLength(g.works.length)
      expect(kinds.slice(0, 4), g.id).toEqual(['licao', 'licao', 'licao', 'revisao'])
      expect(kinds.at(-1), g.id).toBe('desafio')
      expect(kinds.includes('imitacao'), g.id).toBe(sectionOf(g) !== 'mestre')
      expect(new Set(t.steps.map((s) => s.id)).size, g.id).toBe(t.steps.length)
      for (const s of t.steps) expect(s.practice.ask.length, `${g.id}:${s.id}`).toBeGreaterThan(0)
    }
    const f = trailOf('fundamentos')
    expect(f.steps.map((s) => s.id)).toEqual(['l1', 'l2', 'l3', 'rev', 'imit', 'l4', 'l5', 'desafio'])
    expect(f.steps[3]).toMatchObject({ title: 'Revisão: Desejo e obstáculo', revisits: 'l1' })
    expect(f.steps[4].passage?.text).toMatch(/^As crônicas da vila de Itaguaí/)
  })

  it('o passo de hoje é o próximo da trilha escolhida, e o desafio antigo já marcado conta', () => {
    const f = trailOf('fundamentos')
    expect(todayStep(blank())?.step.id).toBe('l1')
    const p = blank({ trail: 'fundamentos', steps: [stepKey('fundamentos', 'l1'), stepKey('fundamentos', 'l2')] })
    expect(nextStep(p, f)?.id).toBe('l3')
    expect(doneCount(p, f)).toBe(2)
    const legacy = blank({ done: [`fundamentos:${f.guide.exercises[0].title}`] })
    expect(isStepDone(legacy, f, f.steps.at(-1)!)).toBe(true)
    // Trilha completa: o próximo passo vem de outra trilha da mesma prateleira.
    const all = blank({ trail: 'mestrar', steps: trailOf('mestrar').steps.map((s) => stepKey('mestrar', s.id)) })
    expect(todayStep(all)?.trail.id).toBe('aventuras')
  })

  it('as palavras-chave da imitação são os nomes e as palavras longas, na ordem', () => {
    const text = trailOf('fundamentos').steps[4].passage!.text
    const keys = keywordsOf(text)
    expect(keys[0]).toBe('crônicas')
    expect(keys).toContain('Itaguaí')
    expect(keys).toContain('Simão Bacamarte')
    expect(keys.length).toBeLessThanOrEqual(7)
  })

  it('a palavra que abre a frase não gruda no nome: "Quando Dorothy", "Ganhei da Bruxa Má do Leste"', () => {
    expect(keywordsOf('Quando Dorothy parava à porta, via a pradaria.')).toContain('Dorothy')
    expect(keywordsOf('Quando Dorothy parava à porta, via a pradaria.')).not.toContain('Quando Dorothy')
    expect(keywordsOf('— Ganhei da Bruxa Má do Leste, quando a casa caiu.')).toContain('Bruxa Má do Leste')
    // Nomes compostos de verdade, mesmo no começo da frase, continuam inteiros.
    expect(keywordsOf('Simão Bacamarte voltou. Rio de Janeiro era longe.')).toEqual(expect.arrayContaining(['Simão Bacamarte', 'Rio de Janeiro']))
  })

  it('compara a imitação com o original', () => {
    const { shared, score } = compareImitation('O médico estudou em Coimbra e voltou ao Brasil.', 'Um médico que estudou em Pádua voltou.')
    expect(shared.has('medico')).toBe(true)
    expect(shared.has('coimbra')).toBe(false)
    // De "medico", "estudou", "coimbra", "voltou", "brasil": voltaram três.
    expect(score).toBeCloseTo(3 / 5)
    expect(segments('Era noite.', (w) => w === 'noite')).toEqual([
      { text: 'Era', mark: false },
      { text: ' ', mark: false },
      { text: 'noite', mark: true },
      { text: '.', mark: false },
    ])
  })
})

describe('as contas do texto', () => {
  it('acha palavras proibidas pelo começo, a palavra curta inteira e a expressão', () => {
    expect(forbiddenIn('Ela ficou assustada, com pavor.', ['assust', 'pavor', 'medo'])).toEqual(['assustada', 'pavor'])
    expect(forbiddenIn('Oito pessoas disseram oi. Tudo bem?', ['oi', 'tudo bem'])).toEqual(['oi', 'tudo bem'])
  })

  it('mede frases, falas, verbos de fala, advérbios e repetições', () => {
    expect(sentenceLengths('Ele correu. Uma barraca, outra barraca e mais uma! Parou.')).toEqual([2, 7, 1])
    expect(dialogueShare('Ela entrou na sala.\n— Saia daqui — disse ele.')).toBeCloseTo(4 / 8)
    expect(speechVerbs('— Não — disse. — Sim — disse ela. — Talvez — sussurrou.')).toEqual([
      { verb: 'disse', n: 2 },
      { verb: 'sussurrou', n: 1 },
    ])
    expect(menteWords('Lentamente, a mente dele voltou. Felizmente.')).toEqual(['Lentamente', 'Felizmente'])
    expect(nearRepeats('A cadeira estava vazia. Ninguém tocou na cadeira, nem olhou a janela.')).toEqual(['cadeira'])
  })
})

describe('as imitações de "O Mágico de Oz"', () => {
  const COM_OZ = { fantasia: 'lugar', realismo: 'lugar', dialogo: 'dialogo', ritmo: 'ritmo' } as const

  it('quatro trilhas ganham um passo de Oz logo depois do de Machado: lugar, diálogo e ritmo', () => {
    expect(new Set(Object.values(COM_OZ))).toEqual(new Set(['lugar', 'dialogo', 'ritmo']))
    for (const [id, theme] of Object.entries(COM_OZ)) {
      const t = trailOf(id as keyof typeof COM_OZ)
      const ids = t.steps.map((s) => s.id)
      expect(ids.indexOf('imit-oz'), id).toBe(ids.indexOf('imit') + 1)
      const step = t.steps[ids.indexOf('imit-oz')]
      expect(step.kind).toBe('imitacao')
      expect(step.title).toBe(`Imitação: Baum, ${OZ_THEME_LABEL[theme]}`)
      expect(step.passage?.author).toBe('Baum')
      expect(step.passage?.source).toMatch(/^L\. Frank Baum, O Maravilhoso Mágico de Oz \(1900\), “.+”$/)
    }
    // As outras trilhas ficam como estavam.
    expect(trailOf('fundamentos').steps.some((s) => s.id === 'imit-oz')).toBe(false)
    expect(trailOf('mestrar').steps.some((s) => s.kind === 'imitacao')).toBe(false)
  })

  it('os trechos são de Oz mesmo: o lugar descreve, o diálogo tem falas, o ritmo alterna longa e curta', () => {
    const cidade = ozPassageOf('fantasia')!.passage
    expect(cidade.text).toMatch(/^Mesmo com os olhos protegidos pelos óculos verdes/)
    expect(cidade.source).toContain('A maravilhosa Cidade de Oz')
    const kansas = ozPassageOf('realismo')!.passage
    expect(kansas.text).toMatch(/^Quando Dorothy parava à porta/)
    expect(kansas.keys).toContain('Dorothy')

    const conversa = ozPassageOf('dialogo')!.passage
    expect(conversa.text.split('\n')).toHaveLength(6)
    expect(conversa.text.split('\n').filter((l) => l.startsWith('—')).length).toBeGreaterThanOrEqual(3)
    expect(dialogueShare(conversa.text)).toBeGreaterThan(0.6)
    expect(conversa.keys).toContain('Dorothy')

    const vento = ozPassageOf('ritmo')!.passage
    const lengths = sentenceLengths(vento.text)
    expect(vento.text).toContain('Então aconteceu uma coisa estranha.')
    expect(Math.max(...lengths)).toBeGreaterThanOrEqual(20)
    expect(Math.min(...lengths)).toBeLessThanOrEqual(5)
  })

  it('os trechos guardados na Oficina são iguais aos parágrafos do livro de Oz', () => {
    for (const [id, t] of Object.entries(OZ_TRECHOS)) {
      const livro = MAGICO_DE_OZ[t.capitulo]
      expect(livro.titulo, id).toBe(t.titulo)
      expect(livro.paragrafos.slice(t.de, t.de + t.paragrafos.length), id).toEqual(t.paragrafos)
    }
  })

  it('o trecho de mais de um parágrafo entra na comparação sem perder as palavras', () => {
    const { text } = ozPassageOf('dialogo')!.passage
    const { score } = compareImitation(text, text.replaceAll('\n', ' '))
    expect(score).toBe(1)
    expect(compareImitation(text, 'Nada a ver com isso.').score).toBeLessThan(0.1)
  })
})

describe('conferência de todas as trilhas', () => {
  it('cada passo tem título, texto, o que escrever e perguntas; nenhum texto vem vazio ou com "undefined"', () => {
    for (const t of TRAILS) {
      expect(new Set(t.steps.map((s) => s.id)).size, t.id).toBe(t.steps.length)
      for (const s of t.steps) {
        const where = `${t.id}:${s.id}`
        for (const v of [s.title, s.text, s.practice.prompt, ...s.practice.ask]) {
          expect(v.trim().length, where).toBeGreaterThan(3)
          expect(v, where).not.toMatch(/undefined|null|\[object/)
        }
        if (s.kind === 'revisao') expect(t.steps.some((x) => x.id === s.revisits), where).toBe(true)
        expect(Boolean(s.passage), where).toBe(s.kind === 'imitacao')
      }
    }
  })

  it('cada trecho de imitação tem fonte, autor e palavras-chave que estão no texto', () => {
    const vistos = new Set<string>()
    for (const t of TRAILS)
      for (const s of t.steps.filter((x) => x.kind === 'imitacao')) {
        const where = `${t.id}:${s.id}`
        const p = s.passage!
        const n = wordsOf(p.text).length
        expect(n, where).toBeGreaterThanOrEqual(30)
        expect(n, where).toBeLessThanOrEqual(130)
        expect(['Machado', 'Baum'], where).toContain(p.author)
        expect(p.source, where).toContain(p.author === 'Machado' ? 'Machado de Assis' : 'Baum')
        expect(p.keys.length, where).toBeGreaterThanOrEqual(3)
        expect(p.keys.length, where).toBeLessThanOrEqual(7)
        for (const k of p.keys) expect(p.text, `${where}: ${k}`).toContain(k)
        // O alvo é 60% das palavras do trecho e cabe no que dá para escrever de memória.
        expect(s.practice.target, where).toBe(Math.round(n * 0.6))
        expect(vistos.has(p.text), `${where} repete um trecho de outra trilha`).toBe(false)
        vistos.add(p.text)
      }
  })

  it('o progresso: passo a passo chega ao fim, e quem já andava antes dos passos novos continua de onde parou', () => {
    for (const t of TRAILS) {
      const done = t.steps.map((s) => stepKey(t.id, s.id))
      expect(trailComplete(blank({ steps: done }), t), t.id).toBe(true)
      expect(nextStep(blank({ steps: done.slice(0, -1) }), t)?.id, t.id).toBe(t.steps.at(-1)!.id)
    }
    // Quem terminou a revisão e a imitação de Machado (antes do passo de Oz existir) vê o de Oz como o próximo.
    const f = trailOf('fantasia')
    const antes = f.steps.filter((s) => ['l1', 'l2', 'l3', 'rev', 'imit'].includes(s.id)).map((s) => stepKey('fantasia', s.id))
    expect(nextStep(blank({ steps: antes }), f)?.id).toBe('imit-oz')
    expect(doneCount(blank({ steps: antes }), f)).toBe(5)
  })
})
