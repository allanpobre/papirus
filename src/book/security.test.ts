import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { buildBook, defaultDesign } from '../export/bookDesign'
import { unzipText } from '../import/foreignWorld'
import { ostriaUniverse } from '../model/sampleOstria'
import { pagedDocument } from './pagedDocument'

const EVIL = '</style><script>alert(1)</script>'

describe('segurança: o que vem do universo não vira código', () => {
  it('título, autor e ornamento com "</style>" não fecham o estilo do livro', () => {
    const u = ostriaUniverse()
    const design = { ...defaultDesign(), title: EVIL, author: EVIL, dividerSymbol: EVIL, runningHead: 'titulo-autor' as const }
    const book = buildBook(u, design)
    const doc = pagedDocument(book.title, book.html, book.css, '', '', false)
    // Só os três </style> do próprio documento (fontes, livro e tela).
    expect(doc.match(/<\/style/gi)?.length).toBe(3)
    expect(doc).not.toContain('<script>alert(1)')
  })

  it('o .zip abre só textos e imagens (como bytes, nunca como código) e pula arquivo grande demais ou de outro tipo', () => {
    const big = new Uint8Array(11_000_000)
    const zip = zipSync({ 'notas/Kael.md': strToU8('# Kael'), 'imagem.png': strToU8('x'), 'script.js': strToU8('alert(1)'), 'enorme.md': big, 'enorme.png': big, '.obsidian/app.json': strToU8('{}') })
    const files = unzipText('mundo.zip', zip)
    expect(files.map((f) => f.path).sort()).toEqual(['mundo/imagem.png', 'mundo/notas/Kael.md'])
    // A imagem vem só como bytes (sem texto): quem a usa a decodifica como imagem.
    expect(files.find((f) => f.path.endsWith('.png'))).toMatchObject({ text: '' })
  })
})
