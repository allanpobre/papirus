// @vitest-environment jsdom
import { Editor } from '@tiptap/core'
import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { baseExtensions } from '../editor/extensions'
import { addScene, addStory, createUniverse, updateScene } from '../model/universe'
import { bookFrom, bookToDocx, bookToEpub } from './exportBook'
import { blocksToBook, parseDocx, parseInline, parseMarkdown, parsePlainText } from './importBook'

const MD = `# O Sal da Terra

## A chegada

Kael desceu do barco com **muita** pressa e *nenhum* plano.
Linha seguida no mesmo parágrafo.

* * *

> Ninguém volta de Ostria.

## O porto

- corda
- sal
`

describe('importar livro', () => {
  it('lê ênfases e escapes', () => {
    expect(parseInline('a **b** *c* ~~d~~ \\*e\\*')).toEqual([
      { text: 'a ', marks: [] },
      { text: 'b', marks: ['bold'] },
      { text: ' ', marks: [] },
      { text: 'c', marks: ['italic'] },
      { text: ' ', marks: [] },
      { text: 'd', marks: ['strike'] },
      { text: ' *e*', marks: [] },
    ])
    expect(parseInline('nome_com_sublinhado')).toEqual([{ text: 'nome_com_sublinhado', marks: [] }])
  })

  it('divide o Markdown em cenas pelos títulos e usa o título do topo como livro', () => {
    const book = blocksToBook(parseMarkdown(MD), 'arquivo')
    expect(book.title).toBe('O Sal da Terra')
    expect(book.scenes.map((s) => s.title)).toEqual(['A chegada', 'O porto'])
    const [first, second] = book.scenes
    expect(first.text).toContain('Kael desceu do barco com muita pressa e nenhum plano. Linha seguida')
    expect((first.doc.content ?? []).map((n) => n.type)).toEqual(['paragraph', 'horizontalRule', 'blockquote'])
    expect(second.doc.content?.[0].type).toBe('bulletList')
  })

  it('o texto vale para o editor', () => {
    const book = blocksToBook(parseMarkdown(MD), 'arquivo')
    const editor = new Editor({ extensions: baseExtensions, content: book.scenes[0].doc })
    expect(editor.getText()).toContain('nenhum plano')
    editor.destroy()
  })

  it('divide texto puro pelos separadores, se pedido', () => {
    const book = blocksToBook(parsePlainText('Um.\n\nDois.\n\n***\n\nTrês.'), 'Livro', 'separadores')
    expect(book.title).toBe('Livro')
    expect(book.scenes.map((s) => [s.title, s.text])).toEqual([
      ['Cena 1', 'Um.\n\nDois.'],
      ['Cena 2', 'Três.'],
    ])
    expect(blocksToBook(parsePlainText('Um.\n\n***\n\nTrês.'), 'Livro', 'nada').scenes).toHaveLength(1)
  })
})

describe('exportar livro', () => {
  let u = createUniverse('Teste')
  let story
  ;[u, story] = addStory(u, 'O Sal da Terra')
  const editor = new Editor({ extensions: baseExtensions })
  for (const [title, md] of [
    ['A chegada', 'Kael desceu com **pressa** & medo.\n\n* * *\n\nDepois, <silêncio>.'],
    ['O porto', 'Sal *por toda* parte.'],
  ] as const) {
    let scene
    ;[u, scene] = addScene(u, story.id, title)
    const { doc, text } = blocksToBook(parseMarkdown(md), '', 'nada').scenes[0]
    editor.commands.setContent(doc)
    u = updateScene(u, scene.id, { doc: editor.getJSON() as never, text })
  }
  editor.destroy()
  const book = bookFrom(u, story, { author: 'Ana' })

  it('gera um .docx que volta como as mesmas cenas', () => {
    const data = bookToDocx(book)
    const files = unzipSync(data)
    expect(Object.keys(files)).toContain('word/document.xml')
    const xml = strFromU8(files['word/document.xml'])
    expect(xml).toContain('&amp; medo')
    expect(xml).toContain('&lt;silêncio&gt;')
    const back = blocksToBook(parseDocx(data), 'x')
    expect(back.title).toBe('O Sal da Terra')
    expect(back.front).toBe('Ana')
    expect(back.scenes.map((s) => s.title)).toEqual(['A chegada', 'O porto'])
    expect(back.scenes[0].text).toContain('Kael desceu com pressa & medo.')
    const para = back.scenes[0].doc.content?.[0] as unknown as { content: { text: string; marks?: { type: string }[] }[] }
    const bold = para.content.find((n) => n.text === 'pressa')
    expect(bold?.marks).toEqual([{ type: 'bold' }])
    expect(back.scenes[0].doc.content?.some((n) => n.type === 'horizontalRule')).toBe(true)
  })

  it('gera um EPUB com o mimetype primeiro e um capítulo por cena', () => {
    const data = bookToEpub(book, '0-0-0-0-0')
    // O nome do primeiro arquivo começa no byte 30 do zip.
    expect(strFromU8(data.slice(30, 38))).toBe('mimetype')
    const files = unzipSync(data)
    expect(strFromU8(files.mimetype)).toBe('application/epub+zip')
    const opf = strFromU8(files['OEBPS/content.opf'])
    expect(opf).toContain('<dc:creator>Ana</dc:creator>')
    expect(opf.match(/<itemref /g)).toHaveLength(3)
    const cap = strFromU8(files['OEBPS/cap-001.xhtml'])
    expect(cap).toContain('<h1>A chegada</h1>')
    expect(cap).toContain('<strong>pressa</strong> &amp; medo.')
    const parsed = new DOMParser().parseFromString(cap, 'application/xhtml+xml')
    expect(parsed.getElementsByTagName('parsererror')).toHaveLength(0)
  })
})
