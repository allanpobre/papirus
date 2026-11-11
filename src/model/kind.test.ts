import { describe, expect, it } from 'vitest'
import { createUniverse } from './universe'
import { applyTemplate } from './templates'
import { CAMPAIGN_HIDDEN, WORLD_HIDDEN, firstView, hiddenViewsFor, universeKind, worldLevel } from './kind'

describe('setores: escrita ou campanha', () => {
  it('campanha nova é campanha, abre na mesa e esconde a parte do livro', () => {
    const u = applyTemplate(createUniverse('Arton'), 'rpg', { system: 't20' })
    expect(universeKind(u)).toBe('campanha')
    expect(firstView(u)).toBe('rpg')
    // A área Wiki é só dos mundos.
    expect(hiddenViewsFor(u, {})).toEqual([...CAMPAIGN_HIDDEN, 'wiki'])
  })

  it('livro sem mesa esconde o RPG; o que a pessoa escolheu vale para o tipo', () => {
    const u = applyTemplate(createUniverse('Livro'), 'fantasia')
    expect(universeKind(u)).toBe('escrita')
    expect(firstView(u)).toBe('inicio')
    expect(hiddenViewsFor(u, {})).toContain('rpg')
    expect(hiddenViewsFor(u, { escrita: [] })).toEqual(['wiki'])
    // O "Só RPG" de antes dos setores não esconde o livro de quem escreve.
    expect(hiddenViewsFor(u, {}, ['organizar', 'conhecimento', 'livro'])).toEqual(['rpg', 'wiki'])
  })

  it('o tipo escolhido em Ajustes manda', () => {
    const u = applyTemplate(createUniverse('Arton'), 'rpg')
    expect(universeKind({ ...u, settings: { ...u.settings, kind: 'escrita' } })).toBe('escrita')
  })

  it('mundo: só worldbuilding, com Wiki; o Simples esconde também a Trama', () => {
    const base = createUniverse('Ostria')
    const u = { ...base, settings: { ...base.settings, kind: 'mundo' as const } }
    expect(universeKind(u)).toBe('mundo')
    expect(firstView(u)).toBe('inicio')
    expect(worldLevel(u)).toBe('completo')
    expect(hiddenViewsFor(u, {})).toEqual(WORLD_HIDDEN)
    const simple = { ...u, settings: { ...u.settings, worldLevel: 'simples' as const } }
    expect(hiddenViewsFor(simple, {})).toEqual([...WORLD_HIDDEN, 'tramas', 'conhecimento'])
    // O nível só vale num mundo.
    expect(worldLevel({ ...simple, settings: { ...simple.settings, kind: 'escrita' } })).toBe('completo')
  })
})
