import { describe, expect, it } from 'vitest'
import { createUniverse, draftEntity, insert } from '../model/universe'
import { cleanFirstSteps, newlyReady, waitingViews } from './firstSteps'

describe('primeira vez mais curta', () => {
  const on = { active: true, revealed: [] }
  it('no começo, Ligações, Linha do tempo, Mapas e Quem sabe o quê esperam; com duas fichas, as Ligações aparecem', () => {
    let u = createUniverse('Novo')
    expect(waitingViews(u, on)).toEqual(['relacoes', 'timeline', 'atlas', 'conhecimento'])
    u = insert(u, 'entities', draftEntity('personagem', 'Ana'))[0]
    u = insert(u, 'entities', draftEntity('lugar', 'Porto'))[0]
    expect(newlyReady(u, on)).toEqual(['relacoes', 'atlas'])
    expect(waitingViews(u, on)).toEqual(['timeline', 'conhecimento'])
  })
  it('o que já apareceu não some; desligado ou sem valor (quem já usava), nada espera', () => {
    const u = createUniverse('Novo')
    expect(waitingViews(u, { active: true, revealed: ['relacoes'] })).not.toContain('relacoes')
    expect(waitingViews(u, { active: false, revealed: [] })).toEqual([])
    expect(waitingViews(u, undefined)).toEqual([])
  })
  it('lê o valor guardado sem quebrar (parte desconhecida fica de fora)', () => {
    expect(cleanFirstSteps({ active: true, revealed: ['relacoes', 'mundos'] })).toEqual({ active: true, revealed: ['relacoes'] })
    expect(cleanFirstSteps('lixo')).toBeUndefined()
  })
})
