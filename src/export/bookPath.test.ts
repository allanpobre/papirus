import { describe, expect, it } from 'vitest'
import { reviewBook } from '../logic/review'
import { docFromParagraphs } from '../model/sample'
import { addScene, addStory, createUniverse, updateScene } from '../model/universe'
import { defaultDesign } from './bookDesign'
import { listPt, reviewStep, textStep } from './bookPath'
import { bookFromDesign, bookToMarkdown } from './exportBook'

function universeWith(scenes: [string, string[]][]) {
  let u = createUniverse('Teste')
  let story
  ;[u, story] = addStory(u, 'O Sal')
  for (const [title, ps] of scenes) {
    let s
    ;[u, s] = addScene(u, story.id, title)
    u = updateScene(u, s.id, { doc: docFromParagraphs(ps), text: ps.join('\n\n') })
  }
  return u
}

describe('o caminho do livro', () => {
  it('o texto conta capítulos e palavras, e diz o que fica de fora', () => {
    const u = universeWith([
      ['A chegada', ['Kael desceu do navio.']],
      ['', ['Mira esperava no cais.']],
      ['Nada ainda', []],
    ])
    const d = defaultDesign()
    const t = textStep(u, d, reviewBook(u, d))
    expect(t).toEqual({ state: 'olhar', chapters: 2, detail: '2 capítulos · 8 palavras · 1 cena sem título · 1 cena sem texto fica de fora' })
    expect(textStep(createUniverse('Vazio'), d, []).state).toBe('olhar')
  })

  it('o revisar diz o que o Papirus arruma e em quantas cenas vale olhar', () => {
    const u = universeWith([['Um', ['Ele disse "volte"... e saiu.']]])
    const d = defaultDesign()
    expect(reviewStep(reviewBook(u, d))).toMatchObject({ state: 'olhar', detail: 'Aspas e reticências: o Papirus arruma sozinho · 1 cena para olhar' })
    expect(reviewStep([])).toMatchObject({ state: 'ok', detail: 'Nada para apontar.' })
    expect(listPt(['a', 'b', 'c'])).toBe('a, b e c')
  })

  it('uma palavra ignorada deixa de contar como repetição', () => {
    const u = universeWith([['Um', ['Os loucos chegaram cedo, e os loucos não dormiam.']]])
    const d = defaultDesign()
    expect(reviewBook(u, d).filter((i) => i.kind === 'repeticao').map((i) => i.word)).toEqual(['loucos'])
    expect(reviewBook(u, { ...d, reviewIgnore: ['Loucos'] }).filter((i) => i.kind === 'repeticao')).toEqual([])
  })

  it('baixa o livro como ele é: título, autor e as cenas com texto', () => {
    const u = universeWith([
      ['A chegada', ['Kael desceu do navio.']],
      ['Vazia', []],
    ])
    const out = bookFromDesign(u, { ...defaultDesign(), title: 'O Sal', author: 'Ana' })
    expect(out.scenes.map((s) => s.title)).toEqual(['A chegada'])
    expect(bookToMarkdown(out)).toBe('# O Sal\n\n*Ana*\n\n## A chegada\n\nKael desceu do navio.\n')
  })
})
