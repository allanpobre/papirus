import { describe, expect, it } from 'vitest'
import { GUIDES, sectionOf } from './guides'
import { PRACTICE } from './practice'
import type { OficinaProgress } from './progress'
import { compareImitation, doneCount, isStepDone, keywordsOf, nextStep, segments, stepKey, todayStep, trailOf, TRAILS } from './trails'
import { dialogueShare, forbiddenIn, menteWords, nearRepeats, sentenceLengths, speechVerbs } from './textCounts'

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
