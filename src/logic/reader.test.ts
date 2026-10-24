import { describe, expect, it } from 'vitest'
import { ostriaUniverse as sampleUniverse } from '../model/sampleOstria'
import { discoveries, readerBook, readerEntities, readerText } from './reader'
import { unmarkReveals, wrapReveal } from './reveals'

const u = sampleUniverse()
const book = readerBook(u)
const at = (title: string) => book.scenes.findIndex((s) => s.title === title)
const card = (upto: number, name: string) => readerEntities(book, upto).find((e) => e.entity.name === name)

describe('caderno do leitor', () => {
  it('fichas entram na primeira cena em que aparecem; secretas nunca', () => {
    const c1 = readerEntities(book, at('A chegada')).map((e) => e.entity.name)
    expect(c1).toContain('Kael')
    expect(c1).toContain('Mira')
    expect(c1).not.toContain('Ilsa')
    expect(c1).not.toContain('Vaelor')
    expect(readerEntities(book, at('A Torre fechada')).map((e) => e.entity.name)).toContain('Ilsa')
  })

  it('trechos marcados esperam a cena; [segredo] nunca aparece', () => {
    expect(card(at('A chegada'), 'Mira')?.description).toBe('')
    expect(card(at('A Torre fechada'), 'Mira')?.description).toBe('Foi criada por Ilsa, que a tirou da corte depois da Queda.')
    expect(card(at('A chegada'), 'Kael')?.description).toBe('Conhece cada beco das docas.')
    expect(card(at('Nas brumas'), 'Kael')?.description).toContain('alguém fez outra lâmina')
  })

  it('cada cena traz suas descobertas', () => {
    const d = discoveries(book, at('A Torre fechada'))
    expect(d.entities.map((e) => e.name)).toContain('Ilsa')
    expect(d.items.some((i) => i.kind === 'trecho' && i.tag === 'Mira')).toBe(true)
    expect(d.items.some((i) => i.text.includes('viva na Torre'))).toBe(true)
    // Relação com ficha secreta não chega.
    expect(book.relations.some((r) => r.text.includes('Vaelor'))).toBe(false)
  })

  it('linha do tempo: eventos entram quando quem participou já apareceu; secretos nunca', () => {
    expect(book.events.some((e) => e.title === 'Retorno do Homem Pálido')).toBe(false)
    for (const ev of book.events) for (const id of ev.entityIds) expect(book.first.get(id)).toBeLessThanOrEqual(ev.at)
  })

  it('marcar e desmarcar', () => {
    const scene = book.scenes[2]
    const { text } = wrapReveal('Ela mente.', 0, 10, scene)
    expect(text).toMatch(/^\[a partir de "Nas brumas" #[0-9a-f]{6}\]Ela mente\.\[\/a partir\]$/)
    expect(unmarkReveals(text)).toBe('Ela mente.')
    expect(readerText(text, 1, book.scenes)).toBe('')
    expect(readerText(text, 2, book.scenes)).toBe('Ela mente.')
    // Escrito à mão, só com o nome da cena.
    expect(readerText('[a partir de "a torre fechada"]x[/a partir]', 1, book.scenes)).toBe('x')
  })
})
