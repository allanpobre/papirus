// @vitest-environment jsdom
import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { sampleUniverse } from '../model/sample'
import { BOOK_PRESETS, defaultDesign } from './bookDesign'
import { designedEpub } from './bookEpub'

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAIAAAA2iEnWAAAAEklEQVR4nGNgYGD4z8DAwMAAAA8AAf8k0R0AAAAASUVORK5CYII='

describe('e-book com a cara do livro', () => {
  const u = sampleUniverse()
  const design = { ...defaultDesign(), ...BOOK_PRESETS.fantasia.design, author: 'Ana Souza', dedication: 'Para a maré.', cover: PNG }
  const files = unzipSync(designedEpub(u, design, { id: 'teste', fonts: [{ family: 'EB Garamond Book', weight: '400', style: 'normal', data: new Uint8Array([1, 2, 3]) }] }))

  it('estrutura de EPUB 3 com capa, fontes e capítulos', () => {
    expect(Object.keys(files)[0]).toBe('mimetype')
    const opf = strFromU8(files['OEBPS/content.opf'])
    expect(opf).toContain('properties="cover-image"')
    expect(opf).toContain('<dc:creator>Ana Souza</dc:creator>')
    expect(opf).toContain('media-type="font/woff2"')
    expect(files['OEBPS/imagens/capa.png']).toBeDefined()
    expect(Object.keys(files).filter((f) => /cap-\d+\.xhtml$/.test(f))).toHaveLength(8)
    expect(strFromU8(files['OEBPS/nav.xhtml'])).toContain('Capítulo Um · A chegada')
  })

  it('o estilo do livro vai junto: ornamento, capítulo por extenso, capitular', () => {
    const cap = strFromU8(files['OEBPS/cap-001.xhtml'])
    expect(cap).toContain('<p class="chapter-ornament" aria-hidden="true">❦</p>')
    expect(cap).toContain('Capítulo Um')
    expect(cap).toMatch(/class="first drop"/)
    const css = strFromU8(files['OEBPS/estilo.css'])
    expect(css).toContain('Cinzel Book')
    expect(css).toContain('@font-face')
    expect(strFromU8(files['OEBPS/dedicatoria.xhtml'])).toContain('Para a maré.')
  })

  it('todas as páginas são XHTML válido', () => {
    for (const [name, data] of Object.entries(files)) {
      if (!name.endsWith('.xhtml')) continue
      const doc = new DOMParser().parseFromString(strFromU8(data), 'application/xhtml+xml')
      expect(doc.getElementsByTagName('parsererror'), name).toHaveLength(0)
    }
  })
})
