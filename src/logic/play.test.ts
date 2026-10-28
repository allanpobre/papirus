import { describe, expect, it } from 'vitest'
import { bestStreak, DAILY_PROMPTS, levelFor, MEDALS, promptOfTheDay } from './play'

describe('jogo da escrita', () => {
  it('o desafio muda a cada dia e repete o mesmo no mesmo dia', () => {
    expect(promptOfTheDay('2026-10-28')).toBe(promptOfTheDay('2026-10-28'))
    expect(promptOfTheDay('2026-10-28')).not.toBe(promptOfTheDay('2026-10-29'))
    expect(new Set(DAILY_PROMPTS).size).toBe(DAILY_PROMPTS.length)
  })
  it('nível pelas palavras escritas', () => {
    expect(levelFor(0)).toMatchObject({ n: 1, name: 'Aprendiz', to: 1000 })
    expect(levelFor(5_000)).toMatchObject({ n: 3, name: 'Escriba' })
    expect(levelFor(1_000_000)).toMatchObject({ name: 'Lenda', to: null })
  })
  it('maior sequência de dias seguidos', () => {
    expect(bestStreak({ '2026-10-01': 10, '2026-10-02': 5, '2026-10-03': 0, '2026-10-04': 9, '2026-10-05': 1, '2026-10-06': 3 })).toBe(3)
    expect(bestStreak({})).toBe(0)
  })
  it('medalhas pelas conquistas', () => {
    const stats = { totalWords: 12_000, history: { '2026-10-01': 1200, '2026-10-02': 300, '2026-10-03': 400 }, goal: 500, challengesDone: 1, entities: 3 }
    const got = MEDALS.filter((m) => m.got(stats)).map((m) => m.id)
    expect(got).toEqual(['primeira-pagina', 'meta-batida', 'mil-num-dia', 'tres-dias', 'dez-mil', 'desafio'])
  })
})
