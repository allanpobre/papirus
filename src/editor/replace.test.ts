import { describe, expect, it } from 'vitest'
import { docFromParagraphs } from '../model/doc'
import type { SceneDoc } from '../model/schema'
import { addScene, addStory, createUniverse, manuscriptOrder, updateScene } from '../model/universe'
import { findInBook, findRanges, followCase, replaceInBook, replaceInDoc } from './replace'

const loose = { wholeWord: false, matchCase: false }
const word = { wholeWord: true, matchCase: false }

describe('procurar', () => {
  it('acha sem ligar para maiúsculas, ou só a palavra inteira', () => {
    expect(findRanges('O mar e o Mar. Amar.', 'mar', loose)).toHaveLength(3)
    expect(findRanges('O mar e o Mar. Amar.', 'mar', word)).toHaveLength(2)
    expect(findRanges('O mar e o Mar. Amar.', 'Mar', { wholeWord: true, matchCase: true })).toHaveLength(1)
    // Letras acentuadas contam como parte da palavra.
    expect(findRanges('amará', 'amar', word)).toHaveLength(0)
    // Pontos e parênteses são procurados como texto.
    expect(findRanges('Fim (?). Fim.', '(?)', loose)).toHaveLength(1)
    expect(findRanges('qualquer coisa', '', loose)).toHaveLength(0)
  })

  it('o que entra segue as maiúsculas do que estava', () => {
    expect(followCase('Espada', 'lâmina', loose)).toBe('Lâmina')
    expect(followCase('ESPADA', 'lâmina', loose)).toBe('LÂMINA')
    expect(followCase('espada', 'Lâmina', loose)).toBe('Lâmina')
    expect(followCase('Espada', 'lâmina', { wholeWord: false, matchCase: true })).toBe('lâmina')
  })
})

describe('trocar no texto da cena', () => {
  it('troca sem perder itálico nem a menção a uma ficha', () => {
    const doc: SceneDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Kael', marks: [{ type: 'mention', attrs: { entityId: 'e1' } }] },
            { type: 'text', text: ' olhou o ' },
            { type: 'text', text: 'mar', marks: [{ type: 'italic' }] },
            { type: 'text', text: '. Kael sorriu.' },
          ],
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'Fim.' }] },
      ],
    }
    const out = replaceInDoc(doc, 'Kael', 'Kiel', loose)!
    expect(out.count).toBe(2)
    expect(out.text).toBe('Kiel olhou o mar. Kiel sorriu.\n\nFim.')
    const first = (out.doc.content![0] as unknown as { content: { text: string; marks?: { type: string; attrs?: { entityId?: string } }[] }[] }).content
    expect(first[0]).toMatchObject({ text: 'Kiel', marks: [{ type: 'mention', attrs: { entityId: 'e1' } }] })
    expect(first.find((n) => n.text === 'mar')?.marks?.[0].type).toBe('italic')
  })

  it('troca só os escolhidos e nada quando não acha', () => {
    const doc = docFromParagraphs(['um mar, dois mares, três mar'])
    const out = replaceInDoc(doc, 'mar', 'rio', word, (i) => i === 1)!
    expect(out.text).toBe('um mar, dois mares, três rio')
    expect(replaceInDoc(doc, 'lago', 'rio', loose)).toBeNull()
  })
})

describe('trocar no livro todo', () => {
  it('acha nos títulos e nos textos, na ordem do livro, e troca só os marcados', () => {
    let u = createUniverse('T')
    let st, a, b
    ;[u, st] = addStory(u, 'Livro I')
    ;[u, a] = addScene(u, st.id, 'A chegada de Kael')
    ;[u, b] = addScene(u, st.id, 'Depois')
    u = updateScene(u, a.id, { doc: docFromParagraphs(['Kael desceu.', 'Era _Kael_ mesmo.']), text: 'Kael desceu.\n\nEra Kael mesmo.' })
    u = updateScene(u, b.id, { doc: docFromParagraphs(['Ninguém viu Kael.']), text: 'Ninguém viu Kael.' })

    const hits = findInBook(u, 'kael', word)
    expect(hits.map((h) => `${h.where}:${h.match}`)).toEqual(['titulo:Kael', 'texto:Kael', 'texto:Kael', 'texto:Kael'])
    expect(hits[3]).toMatchObject({ before: 'Ninguém viu ', after: '.' })

    const chosen = new Set(hits.filter((h) => h.key !== `${a.id}:texto:1`).map((h) => h.key))
    const { universe, count, sceneIds } = replaceInBook(u, 'kael', 'kiel', word, chosen)
    expect(count).toBe(3)
    expect(sceneIds).toEqual([a.id, b.id])
    const [sa, sb] = manuscriptOrder(universe)
    expect(sa.title).toBe('A chegada de Kiel')
    expect(sa.text).toBe('Kiel desceu.\n\nEra Kael mesmo.')
    expect(sb.text).toBe('Ninguém viu Kiel.')
    // Nada marcado: nada muda.
    expect(replaceInBook(u, 'kael', 'kiel', word, new Set()).universe).toBe(u)
  })
})
