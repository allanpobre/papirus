import { describe, expect, it } from 'vitest'
import { createUniverse, draftEntity, draftEvent, insert } from '../model/universe'
import { suggestDates } from './suggestDates'

function mundo(description: string) {
  let u = createUniverse('Teste')
  const [n, e] = insert(u, 'entities', { ...draftEntity('personagem', 'Kael'), description })
  u = n
  return { u, e }
}

describe('suggestDates', () => {
  it('acha o ano e tira o título das palavras antes dele', () => {
    const { u, e } = mundo('Tem medo do mar desde a tempestade de 340. Nasceu em 322, no porto.')
    expect(suggestDates(u).map((s) => [s.entityId, s.year, s.title])).toEqual([
      [e.id, 322, 'Nasceu'],
      [e.id, 340, 'A tempestade'],
    ])
  })
  it('não confunde quantidades, idades nem números de dois algarismos', () => {
    const { u } = mundo('Comandou 300 soldados em 120 dias. Tinha 40 anos. Viveu em 12 cidades.')
    expect(suggestDates(u)).toEqual([])
  })
  it('não propõe o que já está na linha do tempo ligado à ficha', () => {
    let { u, e } = mundo('Nasceu em 322.')
    ;[u] = insert(u, 'events', { ...draftEvent('Nascimento', 322), entityIds: [e.id] })
    expect(suggestDates(u)).toEqual([])
  })
})
