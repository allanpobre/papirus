import { describe, expect, it } from 'vitest'
import { createUniverse } from './universe'
import { applyTemplate } from './templates'
import { CAMPAIGN_HIDDEN, firstView, hiddenViewsFor, universeKind } from './kind'

describe('setores: escrita ou campanha', () => {
  it('campanha nova é campanha, abre na mesa e esconde a parte do livro', () => {
    const u = applyTemplate(createUniverse('Arton'), 'rpg', { system: 't20' })
    expect(universeKind(u)).toBe('campanha')
    expect(firstView(u)).toBe('rpg')
    expect(hiddenViewsFor(u, {})).toEqual(CAMPAIGN_HIDDEN)
  })

  it('livro sem mesa esconde o RPG; o que a pessoa escolheu vale para o tipo', () => {
    const u = applyTemplate(createUniverse('Livro'), 'fantasia')
    expect(universeKind(u)).toBe('escrita')
    expect(firstView(u)).toBe('inicio')
    expect(hiddenViewsFor(u, {})).toContain('rpg')
    expect(hiddenViewsFor(u, { escrita: [] })).toEqual([])
    // O "Só RPG" de antes dos setores não esconde o livro de quem escreve.
    expect(hiddenViewsFor(u, {}, ['organizar', 'conhecimento', 'livro'])).toEqual(['rpg'])
  })

  it('o tipo escolhido em Ajustes manda', () => {
    const u = applyTemplate(createUniverse('Arton'), 'rpg')
    expect(universeKind({ ...u, settings: { ...u.settings, kind: 'escrita' } })).toBe('escrita')
  })
})
