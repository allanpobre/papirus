import { describe, expect, it } from 'vitest'
import { bestStreak, DAILY_PROMPTS, levelFor, MEDALS, promptOfTheDay, WORLD_LEVELS, worldLevelFor, worldPoints } from './play'

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

describe('nível do mundo', () => {
  it('conta o que se constrói, com resumo, ligações, datas, lugares, cenas e sessões encerradas', () => {
    const u = {
      entities: [{ summary: 'Capital.' }, { summary: '  ' }, { summary: 'Rei.' }],
      relations: [{}, {}, {}],
      events: [{}],
      maps: [{ pins: [{}, {}] }, { pins: [{}] }],
      scenes: [{ text: 'Era uma vez.' }, { text: '' }],
      sessions: [{ status: 'encerrada' }, { status: 'aberta' }],
    }
    const { total, parts } = worldPoints(u)
    expect(parts).toEqual({ fichas: 20, ligacoes: 15, datas: 5, lugares: 15, cenas: 10, sessoes: 25 })
    expect(total).toBe(90)
  })

  it('um mundo vazio é uma Semente; os níveis sobem nos limites e a Lenda é o último', () => {
    expect(worldLevelFor(0)).toMatchObject({ n: 1, name: 'Semente', from: 0, to: 60 })
    expect(worldLevelFor(59).name).toBe('Semente')
    expect(worldLevelFor(60).name).toBe('Vilarejo')
    expect(worldLevelFor(499).name).toBe('Cidade')
    expect(worldLevelFor(4_000)).toMatchObject({ n: WORLD_LEVELS.length, name: 'Lenda', to: null })
    expect(worldLevelFor(99_999).name).toBe('Lenda')
  })
})
