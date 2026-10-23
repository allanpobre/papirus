// @vitest-environment jsdom
import { Editor } from '@tiptap/core'
import { describe, expect, it } from 'vitest'
import { baseExtensions as sceneExtensions } from '../editor/extensions'
import { addScene, addStory, createUniverse, updateScene } from '../model/universe'
import type { SceneDoc } from '../model/schema'
import { docToMarkdown, sceneToMarkdown, universeToMarkdown } from './markdown'

/** Gera o JSON exatamente como o editor real produz. */
function docFromHtml(html: string): SceneDoc {
  const editor = new Editor({ extensions: sceneExtensions, content: html })
  const json = editor.getJSON() as SceneDoc
  editor.destroy()
  return json
}

const md = (html: string) => docToMarkdown(docFromHtml(html))

describe('docToMarkdown', () => {
  it('exporta parágrafos separados por linha em branco', () => {
    expect(md('<p>Primeiro.</p><p>Segundo.</p>')).toBe('Primeiro.\n\nSegundo.')
  })

  it('ignora parágrafos vazios', () => {
    expect(md('<p>A</p><p></p><p>B</p>')).toBe('A\n\nB')
  })

  it('exporta negrito, itálico e tachado', () => {
    expect(md('<p><strong>forte</strong> <em>leve</em> <s>riscado</s></p>')).toBe(
      '**forte** *leve* ~~riscado~~',
    )
  })

  it('agrupa marcas sobrepostas sem fechar e reabrir à toa', () => {
    expect(md('<p><strong>um <em>dois</em> três</strong></p>')).toBe('**um *dois* três**')
  })

  it('mantém espaços fora das marcas', () => {
    expect(md('<p>a<strong> b </strong>c</p>')).toBe('a **b** c')
  })

  it('exporta o separador de cena', () => {
    expect(md('<p>Antes.</p><hr><p>Depois.</p>')).toBe('Antes.\n\n* * *\n\nDepois.')
  })

  it('exporta quebra de linha', () => {
    expect(md('<p>linha um<br>linha dois</p>')).toBe('linha um\\\nlinha dois')
  })

  it('exporta citações e listas', () => {
    expect(md('<blockquote><p>dito</p><p>e mais</p></blockquote>')).toBe('> dito\n>\n> e mais')
    expect(md('<ul><li><p>a</p></li><li><p>b</p></li></ul>')).toBe('- a\n- b')
    expect(md('<ol start="3"><li><p>a</p></li><li><p>b</p></li></ol>')).toBe('3. a\n4. b')
  })

  it('escapa caracteres que mudariam o significado do texto', () => {
    expect(md('<p>2*3 e _nome_ [nota]</p>')).toBe('2\\*3 e \\_nome\\_ \\[nota\\]')
    expect(md('<p># não é título</p>')).toBe('\\# não é título')
    expect(md('<p>- não é lista</p>')).toBe('\\- não é lista')
    expect(md('<p>1984. Um ano.</p>')).toBe('1984\\. Um ano.')
    expect(md('<p>&gt;não é citação</p>')).toBe('\\>não é citação')
  })

  it('preserva diálogo com travessão', () => {
    expect(md('<p>— Quem está aí?</p>')).toBe('— Quem está aí?')
  })
})

describe('exportação de cenas e universo', () => {
  it('usa o título da cena como cabeçalho', () => {
    let [u, scene] = addScene(createUniverse('Mundo'), null, 'A chegada')
    u = updateScene(u, scene.id, { doc: docFromHtml('<p>Era noite.</p>') })
    expect(sceneToMarkdown(u.scenes[0])).toBe('# A chegada\n\nEra noite.\n')
  })

  it('exporta histórias em ordem e depois as cenas soltas', () => {
    let u = createUniverse('Mundo')
    const [u1, story] = addStory(u, 'Livro um')
    const [u2, s1] = addScene(u1, story.id, 'Cena 1')
    const [u3, s2] = addScene(u2, null, 'Rascunho')
    u = updateScene(updateScene(u3, s1.id, { doc: docFromHtml('<p>A</p>') }), s2.id, {
      doc: docFromHtml('<p>B</p>'),
    })

    expect(universeToMarkdown(u)).toBe(
      '# Mundo\n\n## Livro um\n\n### Cena 1\n\nA\n\n## Cenas soltas\n\n### Rascunho\n\nB\n',
    )
  })
})
