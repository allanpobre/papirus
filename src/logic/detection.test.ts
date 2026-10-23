import { describe, expect, it } from 'vitest'
import { draftEntity } from '../model/universe'
import type { Entity } from '../model/schema'
import { findCandidates, MentionMatcher } from './detection'
import { fold } from './text'

const entity = (id: string, name: string, aliases: string[] = []): Entity => ({
  ...draftEntity('personagem', name),
  aliases,
  id,
  createdAt: '',
  updatedAt: '',
})

describe('fold', () => {
  it('remove acentos sem mudar o comprimento', () => {
    expect(fold('Ação Ünïcode')).toBe('acao unicode')
    expect(fold('Ação').length).toBe(4)
  })
})

describe('MentionMatcher', () => {
  const matcher = new MentionMatcher([
    entity('v', 'Vaelor', ['The Pale Man']),
    entity('c', 'Casa de Vaelor'),
    entity('o', 'Ostria'),
  ])

  it('encontra nomes e apelidos ignorando acentos e maiúsculas', () => {
    const text = 'Em OSTRIA, the pale man chegou.'
    expect(matcher.find(text)).toEqual([
      { entityId: 'o', from: 3, to: 9, name: 'Ostria' },
      { entityId: 'v', from: 11, to: 23, name: 'The Pale Man' },
    ])
  })

  it('prefere o nome mais longo', () => {
    const found = matcher.find('A Casa de Vaelor caiu; Vaelor sobreviveu.')
    expect(found.map((m) => m.entityId)).toEqual(['c', 'v'])
  })

  it('respeita limites de palavra', () => {
    expect(matcher.find('Ostrianos e Vaelorinos')).toEqual([])
  })

  it('não quebra com texto acentuado antes do nome', () => {
    const text = 'Lá, à noite, Ostria dormia.'
    const [m] = matcher.find(text)
    expect(text.slice(m.from, m.to)).toBe('Ostria')
  })

  it('fica vazio sem fichas', () => {
    expect(new MentionMatcher([]).find('Qualquer coisa')).toEqual([])
  })
})

describe('findCandidates', () => {
  it('encontra nomes no meio da frase, inclusive compostos', () => {
    const text = 'Ela viu Kael perto da Torre de Marfim. Depois, Kael sumiu.'
    expect(findCandidates(text, [])).toEqual([
      { text: 'Kael', count: 2, index: 8 },
      { text: 'Torre de Marfim', count: 1, index: 22 },
    ])
  })

  it('ignora palavras só capitalizadas por início de frase ou de fala', () => {
    const text = '— Quem está aí? — perguntou Kael. Era noite. Ninguém respondeu.'
    expect(findCandidates(text, []).map((c) => c.text)).toEqual(['Kael'])
  })

  it('ignora fichas conhecidas e nomes ignorados pelo autor', () => {
    const text = 'Viu Kael e Vaelor e Mira.'
    const found = findCandidates(text, [entity('v', 'Vaelor')], ['mira'])
    expect(found.map((c) => c.text)).toEqual(['Kael'])
  })

  it('aceita um nome que só aparece no início de frase se ele se repetir', () => {
    const text = 'Lyra correu. Lyra parou. Lyra riu.'
    expect(findCandidates(text, []).map((c) => c.text)).toEqual(['Lyra'])
  })
})
