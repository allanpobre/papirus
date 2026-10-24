import { describe, expect, it } from 'vitest'
import { defaultDesign } from '../export/bookDesign'
import { docFromParagraphs } from '../model/sample'
import { addScene, addStory, createUniverse, updateScene } from '../model/universe'
import { applyFix, reviewBook } from './review'

function book(paragraphs: string[][]) {
  let u = createUniverse('Teste')
  let story
  ;[u, story] = addStory(u, 'Livro')
  for (const [i, ps] of paragraphs.entries()) {
    let s
    ;[u, s] = addScene(u, story.id, `Cena ${i + 1}`)
    u = updateScene(u, s.id, { doc: docFromParagraphs(ps), text: ps.join('\n\n') })
  }
  return u
}

const LONG = Array.from({ length: 50 }, (_, i) => `palavra${i}`).join(' ') + '.'

describe('revisão antes de publicar', () => {
  it('aponta tipografia, repetição, frases longas, cenas vazias e grafias diferentes', () => {
    const u = book([
      ['- Quem está aí? - perguntou Kael.', 'Ele disse "volte"... e  saiu , sem olhar. A espada brilhava; a espada era antiga.', 'A cidade de Ostria dormia.'],
      [],
      [LONG, 'Em Óstria, ninguém dormia.'],
    ])
    const kinds = new Set(reviewBook(u, defaultDesign()).map((i) => i.kind))
    for (const k of ['travessao', 'aspas', 'reticencias', 'espacos', 'repeticao', 'cena-vazia', 'frase-longa', 'grafia', 'cena-curta'] as const) expect(kinds.has(k), k).toBe(true)
  })

  it('corrige a tipografia no livro todo, sem mexer no resto', () => {
    let u = book([['- Quem está aí? - perguntou Kael.', 'Ele disse "volte"... e  saiu , sem olhar.']])
    const d = defaultDesign()
    for (const k of ['travessao', 'aspas', 'reticencias', 'espacos'] as const) u = applyFix(u, d, k).universe
    expect(u.scenes[0].text).toBe('— Quem está aí? — perguntou Kael.\n\nEle disse “volte”… e saiu, sem olhar.')
    expect(reviewBook(u, d).filter((i) => ['travessao', 'aspas', 'reticencias', 'espacos'].includes(i.kind))).toEqual([])
  })
})
