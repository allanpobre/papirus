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

  it('o .zip abre só os textos e pula arquivo grande demais', () => {
    const big = new Uint8Array(11_000_000)
    const zip = zipSync({ 'notas/Kael.md': strToU8('# Kael'), 'imagem.png': strToU8('x'), 'enorme.md': big })
    const files = unzipText('mundo.zip', zip)
    expect(files.map((f) => f.path)).toEqual(['mundo/notas/Kael.md'])
  })
})
