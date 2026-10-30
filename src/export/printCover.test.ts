import { describe, expect, it } from 'vitest'
import { createUniverse } from '../model/universe'
import { addBook } from './shelf'
import { alsoByTitles, buildBook, defaultDesign } from './bookDesign'
import { charsPerLine, coverTemplateSvg, lineComfort, spineMm, wrapSize } from './printCover'

describe('capa para gráfica', () => {
  it('a lombada é páginas vezes a espessura do papel, e a capa inteira soma a sangria', () => {
    expect(spineMm(68, 'creme')).toBeCloseTo(4.318, 2)
    expect(spineMm(68, 'branco')).toBeCloseTo(3.89, 2)
    const size = wrapSize(defaultDesign(), 68, 'creme')
    // 14 × 21 cm: 3,175 + 140 + 4,3 + 140 + 3,175 por 210 + 2 × 3,175.
    expect(size.width).toBeCloseTo(290.67, 1)
    expect(size.height).toBeCloseTo(216.35, 1)
  })

  it('o molde tem o tamanho certo, em milímetros, com as partes marcadas', () => {
    const svg = coverTemplateSvg(defaultDesign(), 120, 'creme', 'O Sal & o Mar')
    expect(svg).toMatch(/^<svg [^>]*width="293\.97mm" height="216\.35mm"/)
    expect(svg).toContain('Contracapa')
    expect(svg).toContain('Lombada')
    expect(svg).toContain('O Sal &amp; o Mar')
  })

  it('conta os caracteres por linha e diz se é confortável', () => {
    expect(charsPerLine(defaultDesign())).toBeGreaterThanOrEqual(45)
    expect(charsPerLine(defaultDesign())).toBeLessThanOrEqual(75)
    expect(charsPerLine({ ...defaultDesign(), pageSize: 'a4', margins: 'estreitas', fontSize: 9 })).toBeGreaterThan(75)
    expect(lineComfort(30)).toMatch(/curta/)
    expect(lineComfort(90)).toMatch(/longa/)
  })
})

describe('também de', () => {
  it('lista os outros livros da estante no fim, e some quando desligada', () => {
    let u = createUniverse('Saga')
    let a
    ;[u, a] = addBook(u, { title: 'Livro I' })
    ;[u] = addBook(u, { title: 'Livro II' })
    expect(alsoByTitles(u, a)).toEqual(['Livro II'])
    expect(buildBook(u, { ...a, author: 'Ana' }).html).toContain('<h2>Também de Ana</h2><ul><li>Livro II</li></ul>')
    expect(alsoByTitles(u, { ...a, alsoBy: false })).toEqual([])
  })
})
