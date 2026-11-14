import { describe, expect, it } from 'vitest'
import { createUniverse } from '../model/universe'
import { addBook } from './shelf'
import { alsoByTitles, buildBook, defaultDesign } from './bookDesign'
import { BLEED_MM, charsPerLine, coverTemplateSvg, lineComfort, pageThicknessMm, printedPages, spineMm, spineTextFits, wrapBreakdown, wrapSize } from './printCover'

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

describe('capa para gráfica: casos conhecidos', () => {
  const a5 = { ...defaultDesign(), pageSize: 'a5' as const } // 148 × 210 mm

  it('a sangria é 1/8 de polegada (3,175 mm) em cada borda', () => {
    expect(BLEED_MM).toBeCloseTo(0.125 * 25.4, 6)
  })

  it('espessura por página da KDP: papel branco 0,002252" e creme 0,0025" (0,0572 mm e 0,0635 mm)', () => {
    expect(pageThicknessMm('branco')).toBeCloseTo(0.0572, 4)
    expect(pageThicknessMm('creme')).toBeCloseTo(0.0635, 4)
  })

  it('200 páginas em papel creme: lombada de meia polegada (12,7 mm) e capa de 315,05 × 216,35 mm', () => {
    expect(spineMm(200, 'creme')).toBeCloseTo(12.7, 6)
    const size = wrapSize(a5, 200, 'creme')
    expect(size.width).toBeCloseTo(6.35 + 148 + 12.7 + 148, 2)
    expect(size.height).toBeCloseTo(210 + 6.35, 2)
  })

  it('300 páginas em papel branco: 0,6756" de lombada (17,16 mm)', () => {
    expect(spineMm(300, 'branco')).toBeCloseTo(300 * 0.002252 * 25.4, 6)
    expect(spineMm(300, 'branco')).toBeCloseTo(17.16, 2)
  })

  it('o papel sai em folhas de duas páginas: 149 páginas contam como 150 na lombada', () => {
    expect(printedPages(149)).toBe(150)
    expect(printedPages(150)).toBe(150)
    expect(printedPages(1)).toBe(2)
    expect(printedPages(0)).toBe(0)
    expect(spineMm(149, 'creme')).toBeCloseTo(spineMm(150, 'creme'), 9)
    expect(spineMm(149, 'creme')).toBeGreaterThan(spineMm(148, 'creme'))
  })

  it('texto na lombada só a partir de 80 páginas (regra da KDP)', () => {
    expect(spineTextFits(79)).toBe(true) // 79 vira 80
    expect(spineTextFits(78)).toBe(false)
    expect(spineTextFits(24)).toBe(false)
    expect(coverTemplateSvg(a5, 60, 'creme', 'Fino')).not.toContain('>Lombada<')
    expect(coverTemplateSvg(a5, 100, 'creme', 'Grosso')).toContain('>Lombada<')
  })

  it('a conta explicada soma as partes e bate com o tamanho do molde', () => {
    const c = wrapBreakdown(a5, 149, 'creme')
    expect(c).toMatchObject({ pages: 149, even: 150, pageWidth: 148, pageHeight: 210 })
    expect(c.spine).toBeCloseTo(c.even * c.perPage, 9)
    expect(c.width).toBeCloseTo(c.bleed * 2 + c.pageWidth * 2 + c.spine, 9)
    expect(c.height).toBeCloseTo(c.pageHeight + c.bleed * 2, 9)
    const size = wrapSize(a5, 149, 'creme')
    expect(c.width).toBeCloseTo(size.width, 9)
    // O molde em SVG tem exatamente essa largura e altura.
    const svg = coverTemplateSvg(a5, 149, 'creme', 'T')
    expect(svg).toContain(`width="${+c.width.toFixed(2)}mm"`)
    expect(svg).toContain(`height="${+c.height.toFixed(2)}mm"`)
  })

  it('todos os tamanhos de página dão uma capa maior que duas páginas mais a lombada, com a sangria', () => {
    for (const pageSize of ['bolso', 'a5', '14x21', '16x23', 'a4', 'carta'] as const) {
      const d = { ...defaultDesign(), pageSize }
      const c = wrapBreakdown(d, 100, 'branco')
      expect(c.width).toBeGreaterThan(c.pageWidth * 2 + c.spine)
      expect(c.height).toBeCloseTo(c.pageHeight + 2 * BLEED_MM, 9)
    }
  })
})
