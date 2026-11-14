// @vitest-environment jsdom
import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { sampleFor } from '../model/sample'
import type { SceneDoc, Universe } from '../model/schema'
import { BOOK_PRESETS, defaultDesign } from './bookDesign'
import { bookFrom, bookFromDesign, bookToDocx } from './exportBook'

/*
 * O .docx de Oz lido de volta, como um leitor de Word lê: um mini leitor (fflate + DOMParser; sem biblioteca nova) tira do
 * `word/document.xml` cada parágrafo, com o estilo, o texto e os trechos em itálico/negrito, e o teste confere os títulos
 * dos capítulos, os parágrafos, o itálico e as quebras de cena contra o que está nas cenas.
 */

interface ReadPara {
  style: string
  text: string
  italic: string[]
  bold: string[]
  pageBreak: boolean
}

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const xml = (text: string) => new DOMParser().parseFromString(text, 'application/xml')

function readDocx(bytes: Uint8Array): { paras: ReadPara[]; files: Record<string, Uint8Array>; problems: string[] } {
  const files = unzipSync(bytes)
  const problems: string[] = []
  for (const [name, data] of Object.entries(files)) {
    if (/\.(xml|rels)$/.test(name) && xml(strFromU8(data)).getElementsByTagName('parsererror').length) problems.push(`${name}: XML mal formado`)
  }
  const doc = xml(strFromU8(files['word/document.xml']))
  const paras: ReadPara[] = []
  for (const p of [...doc.getElementsByTagNameNS(W, 'p')]) {
    const style = p.getElementsByTagNameNS(W, 'pStyle')[0]?.getAttributeNS(W, 'val') ?? 'Normal'
    let text = ''
    const italic: string[] = []
    const bold: string[] = []
    let pageBreak = false
    for (const r of [...p.getElementsByTagNameNS(W, 'r')]) {
      const t = [...r.getElementsByTagNameNS(W, 't')].map((x) => x.textContent ?? '').join('')
      const br = r.getElementsByTagNameNS(W, 'br')[0]
      if (br) {
        if (br.getAttributeNS(W, 'type') === 'page') pageBreak = true
        else text += '\n'
      }
      text += t
      if (r.getElementsByTagNameNS(W, 'i').length) italic.push(t)
      if (r.getElementsByTagNameNS(W, 'b').length) bold.push(t)
    }
    paras.push({ style, text, italic, bold, pageBreak })
  }
  return { paras, files, problems }
}

type Node = { type?: string; text?: string; marks?: { type: string }[]; content?: Node[] }
const blocks = (doc: SceneDoc) => ((doc as Node).content ?? []) as Node[]
const plain = (n: Node): string => (n.type === 'text' ? (n.text ?? '') : n.type === 'hardBreak' ? '\n' : (n.content ?? []).map(plain).join(''))
/** Os trechos em itálico de um texto, como as runs do Word os separam (um por nó de texto). */
const italics = (n: Node): string[] => (n.type === 'text' ? ((n.marks ?? []).some((m) => m.type === 'italic') && n.text ? [n.text] : []) : (n.content ?? []).flatMap(italics))

async function oz(): Promise<{ u: Universe; book: ReturnType<typeof bookFromDesign> }> {
  const u = await sampleFor(null)
  const d = { ...defaultDesign(), ...BOOK_PRESETS.fantasia.design, author: 'L. Frank Baum', title: u.name }
  return { u, book: bookFromDesign(u, d) }
}

describe('o .docx de Oz, lido de volta', () => {
  it('o pacote tem as partes que o Word exige e todo XML é bem formado', async () => {
    const { book } = await oz()
    const { files, problems } = readDocx(bookToDocx(book))
    expect(problems).toEqual([])
    for (const parte of ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/styles.xml', 'word/_rels/document.xml.rels']) expect(files[parte], parte).toBeDefined()
    const tipos = strFromU8(files['[Content_Types].xml'])
    expect(tipos).toContain('/word/document.xml')
    expect(tipos).toContain('wordprocessingml.document.main+xml')
    // A relação do documento principal aponta para uma parte que existe.
    const rels = xml(strFromU8(files['_rels/.rels']))
    const alvo = [...rels.getElementsByTagName('Relationship')].find((r) => (r.getAttribute('Type') ?? '').endsWith('/officeDocument'))?.getAttribute('Target')
    expect(files[alvo ?? '']).toBeDefined()
  })

  it('título, autor e um título de capítulo (Título 1) para cada cena, na ordem do livro', async () => {
    const { book } = await oz()
    const { paras } = readDocx(bookToDocx(book))
    expect(paras[0]).toMatchObject({ style: 'Title', text: book.title })
    expect(paras[1]).toMatchObject({ style: 'Autor', text: 'L. Frank Baum' })
    const capitulos = paras.filter((p) => p.style === 'Heading1').map((p) => p.text)
    expect(capitulos).toEqual(book.scenes.map((s, i) => s.title || `Cena ${i + 1}`))
    expect(capitulos.length).toBeGreaterThan(20)
    expect(capitulos[0]).toBe('O ciclone')
  })

  it('cada parágrafo de cada cena aparece, na ordem e sem perder nenhuma palavra', async () => {
    const { book } = await oz()
    const { paras } = readDocx(bookToDocx(book))
    const esperado: string[] = []
    for (const s of book.scenes) for (const b of blocks(s.doc)) if (b.type === 'paragraph') esperado.push(plain(b))
    const lidos = paras.filter((p) => p.style === 'Normal' || p.style === 'Primeiro').map((p) => p.text)
    expect(lidos).toEqual(esperado)
    // Nenhuma palavra do manuscrito se perde.
    const palavras = (t: string) => (t.match(/\S+/g) ?? []).length
    expect(lidos.reduce((n, t) => n + palavras(t), 0)).toBe(esperado.reduce((n, t) => n + palavras(t), 0))
    // O primeiro parágrafo depois de cada título e de cada quebra de cena não tem recuo ("Primeiro").
    paras.forEach((p, i) => {
      if (p.style === 'Heading1' || p.style === 'Separador') expect(['Primeiro', 'Heading1', 'Separador']).toContain(paras[i + 1]?.style ?? 'Primeiro')
    })
  })

  it('o itálico do manuscrito vira itálico no Word (um trecho por nó de texto)', async () => {
    const { book } = await oz()
    const { paras } = readDocx(bookToDocx(book))
    const esperado = book.scenes.flatMap((s) => blocks(s.doc).flatMap(italics))
    const lidos = paras.flatMap((p) => p.italic).filter((t) => t !== '')
    // Autor e citação são itálico pelo estilo, não pela run: não entram aqui.
    expect(lidos).toEqual(esperado)
  })

  it('as quebras de cena dentro de uma cena viram "* * *" no estilo de separador', async () => {
    const { book } = await oz()
    const { paras } = readDocx(bookToDocx(book))
    const esperado = book.scenes.reduce((n, s) => n + blocks(s.doc).filter((b) => b.type === 'horizontalRule').length, 0)
    const separadores = paras.filter((p) => p.style === 'Separador')
    expect(separadores).toHaveLength(esperado)
    for (const s of separadores) expect(s.text).toBe('* * *')
  })

  it('sem títulos de capítulo, as cenas se separam por quebra de página e "* * *"', async () => {
    const u = await sampleFor(null)
    const livro = bookFrom(u, u.stories[0], { author: 'L. Frank Baum', sceneTitles: false })
    const { paras } = readDocx(bookToDocx(livro))
    expect(paras.filter((p) => p.style === 'Heading1')).toHaveLength(0)
    expect(paras.some((p) => p.pageBreak)).toBe(true)
    const entreCenas = paras.filter((p) => p.style === 'Separador').length
    const dentro = livro.scenes.reduce((n, s) => n + blocks(s.doc).filter((b) => b.type === 'horizontalRule').length, 0)
    expect(entreCenas).toBe(livro.scenes.length - 1 + dentro)
  })

  it('o negrito, o itálico e os caracteres especiais (&, <, aspas) chegam inteiros', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Dorothy & Toto <voltam> — “juntos”, ' },
            { type: 'text', text: 'devagar', marks: [{ type: 'italic' }] },
            { type: 'text', text: ' e ' },
            { type: 'text', text: 'firmes', marks: [{ type: 'bold' }] },
          ],
        },
      ],
    } as unknown as SceneDoc
    const scene = { id: 's', title: 'Teste & “cia”', doc, text: '' } as never
    const { paras } = readDocx(bookToDocx({ title: 'T', author: '', scenes: [scene], sceneTitles: true }))
    expect(paras.find((p) => p.style === 'Heading1')?.text).toBe('Teste & “cia”')
    const corpo = paras.find((p) => p.style === 'Primeiro')!
    expect(corpo.text).toBe('Dorothy & Toto <voltam> — “juntos”, devagar e firmes')
    expect(corpo.italic).toEqual(['devagar'])
    expect(corpo.bold).toEqual(['firmes'])
  })
})
