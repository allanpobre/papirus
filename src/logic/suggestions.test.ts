import { describe, expect, it } from 'vitest'
import { ostriaUniverse } from '../model/sampleOstria'
import { choose } from './definers'
import { aliasSuggestions, sceneSuggestions, whoIsSuggestions } from './suggestions'

describe('sugestões do texto (só regras, sempre propostas)', () => {
  const base = ostriaUniverse()
  const modelo = base.entities.find((e) => e.kind === 'personagem')!
  const ilvani = { ...modelo, id: 'ilvani', name: 'Ilvani Saren', aliases: [] }
  const dunmer = { ...modelo, id: 'dunmer', name: 'Dunmer', kind: 'especie', aliases: [] }
  const especie = { id: 'def-esp', name: 'Espécie', kind: 'especie', appliesTo: ['personagem'] }
  const u = { ...base, entities: [...base.entities, ilvani, dunmer], settings: { ...base.settings, definers: [...(base.settings.definers ?? []), especie] } }
  const texto = 'Ilvani Saren chegou cedo. Ilvani, uma dunmer de olhos vermelhos, olhou o porto. Depois Ilvani dormiu.'

  it('o primeiro nome sozinho vira proposta de apelido (sem contar o nome inteiro)', () => {
    const s = aliasSuggestions(u, texto).find((x) => x.kind === 'apelido' && x.entityId === 'ilvani')
    expect(s).toMatchObject({ alias: 'Ilvani', count: 2 })
    // Já é apelido: não propõe de novo.
    const comApelido = { ...u, entities: u.entities.map((e) => (e.id === 'ilvani' ? { ...e, aliases: ['Ilvani'] } : e)) }
    expect(aliasSuggestions(comApelido, texto).some((x) => x.kind === 'apelido' && x.entityId === 'ilvani')).toBe(false)
  })

  it('"Fulano, uma X" propõe o Quem é, só se ainda não escolheu', () => {
    const s = whoIsSuggestions(u, texto)
    expect(s).toEqual([expect.objectContaining({ kind: 'quem-e', entityId: 'ilvani', optionId: 'dunmer', definerName: 'Espécie' })])
    const escolhido = choose(u, 'ilvani', especie, 'dunmer')
    expect(whoIsSuggestions(escolhido, texto)).toEqual([])
  })

  it('o que a pessoa recusou não volta', () => {
    const keys = sceneSuggestions(u, texto).map((s) => s.key)
    expect(sceneSuggestions(u, texto, keys)).toEqual([])
  })
})
