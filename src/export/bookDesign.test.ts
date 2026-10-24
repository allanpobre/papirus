import { describe, expect, it } from 'vitest'
import { ostriaUniverse as sampleUniverse } from '../model/sampleOstria'
import { bookDesignSchema } from '../model/schema'
import { BOOK_PRESETS, buildBook, chapterLabel, defaultDesign, numberWords, roman } from './bookDesign'

const u = sampleUniverse()

describe('diagramação do livro', () => {
  it('números de capítulo', () => {
    expect(numberWords(1)).toBe('Um')
    expect(numberWords(21)).toBe('Vinte e um')
    expect(numberWords(40)).toBe('Quarenta')
    expect(roman(14)).toBe('XIV')
    expect(chapterLabel({ ...defaultDesign(), chapterLabel: 'capitulo-extenso' }, 3)).toBe('Capítulo Três')
    expect(chapterLabel({ ...defaultDesign(), chapterLabel: 'nenhum' }, 3)).toBe('')
  })

  it('cada cena com texto vira capítulo, com sumário, folha de rosto e capitular', () => {
    const book = buildBook(u, { ...defaultDesign(), author: 'Ana Souza' })
    // As 8 cenas do Livro I; a cena solta (fora de qualquer história) não entra.
    expect(book.chapters).toBe(8)
    expect(book.title).toBe('Livro I — A Maré Volta')
    expect(book.html).toContain('<h2 class="chapter-title">A chegada</h2>')
    expect(book.html).toContain('class="toc"')
    expect(book.html).toContain('© ')
    expect(book.html).toMatch(/<p class="first drop"><span class="lead">Era noite em<\/span> Ostria/)
    // Parágrafo que começa com travessão não ganha capitular.
    expect(book.html).not.toMatch(/<p class="first drop">—/)
    expect(book.css).toContain('size:140mm 210mm')
  })

  it('uma história escolhida, cenas juntas num capítulo, quebra floral', () => {
    const story = u.stories[0]
    const book = buildBook(u, { ...defaultDesign(), storyIds: [story.id], chapterUnit: 'historia', sceneBreak: 'floral', toc: false })
    expect(book.chapters).toBe(1)
    expect(book.title).toBe(story.title)
    expect(book.html).toContain('<p class="scene-break">❦</p>')
    expect(book.html).not.toContain('class="toc"')
  })

  it('segredos e notas não saem; capa do autor entra', () => {
    const book = buildBook(u, { ...defaultDesign(), cover: 'data:image/png;base64,AAAA' })
    expect(book.html).toContain('<section class="cover"><img src="data:image/png;base64,AAAA"')
    expect(book.html).not.toContain('[segredo]')
    expect(book.html).not.toContain('Herdeira escondida')
  })

  it('modelos são válidos', () => {
    for (const p of Object.values(BOOK_PRESETS)) expect(() => bookDesignSchema.parse({ ...defaultDesign(), ...p.design })).not.toThrow()
    const ms = buildBook(u, { ...defaultDesign(), ...BOOK_PRESETS.manuscrito.design })
    expect(ms.css).toContain('size:210mm 297mm')
    expect(ms.css).toContain('IBM Plex Mono Book')
  })
})
