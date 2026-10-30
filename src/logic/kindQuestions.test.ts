import { describe, expect, it } from 'vitest'
import { ENTITY_KINDS } from '../model/schema'
import { draftEntity } from '../model/universe'
import { answer, answerOf, askedKey, isBlank, questionsFor } from './kindQuestions'

describe('as perguntas da ficha vazia', () => {
  it('todo tipo tem perguntas, e um tipo próprio também', () => {
    for (const k of ENTITY_KINDS) expect(questionsFor(k).length, k).toBeGreaterThanOrEqual(2)
    expect(questionsFor('navio').map((q) => q.key)).toEqual(['O que é', 'Na história'])
    // Magia começa pelo custo e pelo limite.
    expect(questionsFor('magia').slice(0, 2).map((q) => q.key)).toEqual(['Custo', 'Limites'])
  })

  it('vazia é sem resumo, sem descrição e sem campo preenchido', () => {
    const e = { ...draftEntity('personagem', 'Kael'), fields: [{ key: 'Medo', value: '' }] }
    expect(isBlank(e)).toBe(true)
    expect(isBlank({ ...e, summary: 'Contrabandista' })).toBe(false)
    expect(isBlank({ ...e, fields: [{ key: 'Medo', value: 'do mar' }] })).toBe(false)
  })

  it('a resposta preenche o campo do modelo com o mesmo nome, ou cria um', () => {
    const fields = [
      { key: 'Idade', value: '' },
      { key: 'medo', value: '' },
    ]
    const withFear = answer(fields, 'Medo', 'do mar')
    expect(withFear).toEqual([
      { key: 'Idade', value: '' },
      { key: 'medo', value: 'do mar' },
    ])
    expect(answerOf(withFear, 'Medo')).toBe('do mar')
    expect(answer(withFear, 'Como fala', 'baixo').at(-1)).toEqual({ key: 'Como fala', value: 'baixo' })
    expect(askedKey('personagem', 'segredo')).toBe(true)
    expect(askedKey('personagem', 'Idade')).toBe(false)
  })
})
