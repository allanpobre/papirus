import { bookTitle } from '../export/bookDesign'
import { designedEpub, loadEpubFonts } from '../export/bookEpub'
import { fileNameFor } from '../export/download'
import { downloadBytes } from '../export/exportBook'
import type { BookDesign, Universe } from '../model/schema'
import { prepareBookImages } from '../images/bookImages'

/** Gera e baixa o e-book (EPUB) de um livro da estante, com as fontes embutidas. */
export async function downloadEpub(universe: Universe, design: BookDesign) {
  const fonts = await loadEpubFonts(design)
  await prepareBookImages(universe)
  downloadBytes(fileNameFor(bookTitle(universe, design), 'epub'), designedEpub(universe, design, { fonts }), 'application/epub+zip')
}
