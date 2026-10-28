import { strToU8 as encode, zipSync, type Zippable } from 'fflate'
import type { BookDesign, Universe } from '../model/schema'
import { BOOK_FONTS, type BookFontKey } from './bookFonts'
import { dataUrlBytes, epubImageFiles } from './epubImages'
import { CHAPTER_CSS, bookContent, bookTitle, esc, fontFamily, fontsOf, numberWords, paragraphs } from './bookDesign'

/**
 * E-book (EPUB 3) com a mesma cara do livro impresso: a capa do autor, as fontes
 * (embutidas), o estilo dos capítulos, os símbolos e o sumário. Abre no Kindle
 * (enviando o EPUB), Kobo, Apple Livros, Google Play Livros e afins.
 */

/** Bytes no Uint8Array deste ambiente (o do TextEncoder pode ser de outro, e o zip os ignoraria). */
const strToU8 = (s: string) => new Uint8Array(encode(s))

export interface EpubFont {
  family: string
  weight: string
  style: string
  data: Uint8Array
}

/** Busca os arquivos das fontes do livro (no app são endereços; no arquivo único, data URLs). */
export async function loadEpubFonts(d: BookDesign): Promise<EpubFont[]> {
  const keys = [...new Set(fontsOf(d))] as BookFontKey[]
  const out: EpubFont[] = []
  for (const k of keys) {
    for (const f of BOOK_FONTS[k].faces) {
      try {
        const res = await fetch(f.url)
        out.push({ family: BOOK_FONTS[k].family, weight: f.weight, style: f.style, data: new Uint8Array(await res.arrayBuffer()) })
      } catch {
        // Sem a fonte, o leitor usa a dele: o livro continua legível.
      }
    }
  }
  return out
}

/** Imagem em data URL → bytes e tipo. */
const image = dataUrlBytes

const xhtml = (title: string, body: string, cls = '') =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="pt-BR" lang="pt-BR"><head><meta charset="UTF-8"/><title>${esc(title)}</title><link rel="stylesheet" type="text/css" href="estilo.css"/></head><body${cls ? ` class="${cls}"` : ''}>${body}</body></html>`

/** CSS do e-book: sem página fixa (o leitor escolhe o tamanho da letra), com o estilo do livro. */
export function epubCss(d: BookDesign, fonts: EpubFont[]): string {
  const body = `"${fontFamily(d.bodyFont)}", serif`
  const title = d.titleFont === 'igual' ? body : `"${fontFamily(d.titleFont)}", serif`
  const faces = fonts.map((f, i) => `@font-face{font-family:"${f.family}";src:url(fontes/f${i}.woff2);font-weight:${f.weight};font-style:${f.style}}`).join('\n')
  return `${faces}
body{font-family:${body};line-height:${d.lineHeight};margin:0 4%;${d.hyphenate ? 'hyphens:auto;-webkit-hyphens:auto;-epub-hyphens:auto;' : ''}}
p{margin:0;${d.justify ? 'text-align:justify;' : 'text-align:left;'}orphans:2;widows:2}
${d.paragraph === 'recuo' ? '.chapter-body p + p{text-indent:1.5em}.chapter-body p.after-break{text-indent:0}' : '.chapter-body p{margin-bottom:.7em}'}
em{font-style:italic}strong{font-weight:600}
blockquote{margin:1em 1.5em;font-style:italic}
.scene-figure{margin:1.2em 0;text-align:center;page-break-inside:avoid}.scene-figure img{max-width:100%;height:auto}
.cover-page{margin:0;padding:0;text-align:center}
.cover-page img{max-width:100%;max-height:100%;height:auto}
.title-page{text-align:center;margin-top:25%}
.book-title{font-family:${title};font-weight:400;font-size:2em;line-height:1.15;margin:0 0 .5em}
.subtitle{text-align:center;font-style:italic;margin-bottom:2em}
.author{text-align:center;font-variant:small-caps;letter-spacing:.1em;font-size:1.15em;margin-top:3em}
.publisher{text-align:center;font-variant:small-caps;margin-top:4em;font-size:.85em}
.copyright{font-size:.8em;margin-top:40%}
.copyright p{text-align:left;margin-bottom:.6em}
.dedication,.epigraph{margin-top:30%}
.dedication p{text-align:center;font-style:italic}
.epigraph blockquote{margin:0 8% 0 18%}
.epigraph .source{text-align:right;font-style:normal;font-variant:small-caps}
nav h1,.back-matter h2{font-family:${title};font-weight:400;text-align:center;font-size:1.5em;margin:2em 0 1em}
nav ol{list-style:none;padding:0}
nav li{margin:.4em 0}
nav a{text-decoration:none;color:inherit}
.part{text-align:center;margin-top:35%}
.part-label{text-align:center;font-variant:small-caps;letter-spacing:.2em}
.part-title{font-family:${title};font-weight:400;font-size:1.8em}
.chapter-head{margin:3em 0 2.4em}
.chapter-head p{text-align:inherit}
.chapter-label{margin:0}
.chapter-title{font-family:${title};font-weight:400;margin:0}
.chapter-ornament{text-align:center;font-size:1.6em;line-height:1;margin:0 0 .5em;color:#555}
.running{display:none}
${CHAPTER_CSS[d.chapterStyle](title, d)}
.chapter-body p.first{text-indent:0}
.chapter-body p.first .lead{font-variant:small-caps;letter-spacing:.05em}
.chapter-body p.drop::first-letter{float:left;font-family:${title};font-size:2.9em;line-height:.86;padding:.04em .07em 0 0}
.chapter-body p.first+*{clear:left}
.scene-break{text-align:center;text-indent:0;margin:1em 0;letter-spacing:.2em}
hr.scene-break.line{border:0;border-top:1px solid #888;width:22%;margin:1.3em auto}
.scene-break.space{height:1.4em}
.back-matter p{margin-bottom:.7em}
`
}

/** O EPUB do livro da estante. */
export function designedEpub(universe: Universe, d: BookDesign, opts: { fonts?: EpubFont[]; id?: string } = {}): Uint8Array {
  const id = opts.id ?? crypto.randomUUID()
  const fonts = opts.fonts ?? []
  const title = bookTitle(universe, d)
  const author = d.author.trim()
  const year = d.year.trim() || String(new Date().getFullYear())
  const { parts } = bookContent(universe, d)
  const useParts = d.parts && parts.length > 1 && d.chapterUnit === 'cena'
  const modified = new Date().toISOString().replace(/\.\d+Z$/, 'Z')

  // Páginas, na ordem da leitura.
  const pages: { id: string; file: string; title: string; body: string; cls?: string; nav?: string; props?: string }[] = []
  const cover = image(d.cover)
  if (cover) pages.push({ id: 'capa', file: 'capa.xhtml', title, body: `<div class="cover-page"><img src="imagens/capa.${cover.ext}" alt="${esc(title)}"/></div>`, cls: 'cover-page' })
  pages.push({
    id: 'rosto',
    file: 'rosto.xhtml',
    title,
    body: `<section class="title-page" epub:type="titlepage"><h1 class="book-title">${esc(title)}</h1>${d.subtitle.trim() ? `<p class="subtitle">${esc(d.subtitle)}</p>` : ''}${author ? `<p class="author">${esc(author)}</p>` : ''}${d.publisher.trim() ? `<p class="publisher">${esc(d.publisher)}</p>` : ''}</section>`,
  })
  const rights = d.copyright.trim() || (author ? `© ${year} ${author}. Todos os direitos reservados.` : '')
  if (rights) pages.push({ id: 'direitos', file: 'direitos.xhtml', title: 'Direitos', body: `<section class="copyright" epub:type="copyright-page">${paragraphs(rights)}</section>` })
  if (d.dedication.trim()) pages.push({ id: 'dedicatoria', file: 'dedicatoria.xhtml', title: 'Dedicatória', body: `<section class="dedication" epub:type="dedication">${paragraphs(d.dedication)}</section>` })
  if (d.epigraph.trim())
    pages.push({
      id: 'epigrafe',
      file: 'epigrafe.xhtml',
      title: 'Epígrafe',
      body: `<section class="epigraph" epub:type="epigraph"><blockquote>${paragraphs(d.epigraph)}${d.epigraphSource.trim() ? `<p class="source">— ${esc(d.epigraphSource)}</p>` : ''}</blockquote></section>`,
    })

  const toc: { file: string; label: string; part?: boolean }[] = []
  let n = 0
  parts.forEach((p, pi) => {
    if (useParts) {
      const file = `parte-${pi + 1}.xhtml`
      pages.push({ id: `parte${pi + 1}`, file, title: p.story?.title ?? '', body: `<section class="part" epub:type="part"><p class="part-label">Parte ${numberWords(pi + 1)}</p><h1 class="part-title">${esc(p.story?.title ?? '')}</h1></section>` })
      toc.push({ file, label: p.story?.title || `Parte ${pi + 1}`, part: true })
    }
    for (const c of p.chapters) {
      n++
      const file = `cap-${String(n).padStart(3, '0')}.xhtml`
      const showTitle = d.chapterTitles && c.title.trim()
      const head = `<header class="chapter-head">${d.ornament.trim() ? `<p class="chapter-ornament" aria-hidden="true">${esc(d.ornament.trim())}</p>` : ''}${c.label ? `<p class="chapter-label">${esc(c.label)}</p>` : ''}${
        showTitle ? `<h1 class="chapter-title">${esc(c.title)}</h1>` : ''
      }<div class="chapter-orn" aria-hidden="true"></div></header>`
      const label = [c.label, showTitle ? c.title : ''].filter(Boolean).join(' · ') || c.title || `Capítulo ${n}`
      pages.push({ id: `c${n}`, file, title: label, body: `<section class="chapter" epub:type="chapter">${head}<div class="chapter-body">${c.html}</div></section>` })
      toc.push({ file, label })
    }
  })
  if (d.acknowledgments.trim()) pages.push({ id: 'agradecimentos', file: 'agradecimentos.xhtml', title: 'Agradecimentos', body: `<section class="back-matter" epub:type="acknowledgments"><h2>Agradecimentos</h2>${paragraphs(d.acknowledgments)}</section>` })
  if (d.aboutAuthor.trim())
    pages.push({ id: 'autoria', file: 'autoria.xhtml', title: 'Sobre a autoria', body: `<section class="back-matter"><h2>${author ? `Sobre ${esc(author)}` : 'Sobre o autor'}</h2>${paragraphs(d.aboutAuthor)}</section>` })

  const navItems = toc.map((t) => `<li${t.part ? ' class="part"' : ''}><a href="${t.file}">${esc(t.label)}</a></li>`).join('')
  const files: Zippable = {
    'META-INF/container.xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
    ),
    'OEBPS/estilo.css': strToU8(epubCss(d, fonts)),
    'OEBPS/nav.xhtml': strToU8(xhtml('Sumário', `<nav epub:type="toc" id="toc"><h1>Sumário</h1><ol>${navItems}</ol></nav><nav epub:type="landmarks" hidden=""><ol>${toc[0] ? `<li><a epub:type="bodymatter" href="${toc[0].file}">Início</a></li>` : ''}</ol></nav>`)),
    'OEBPS/toc.ncx': strToU8(
      `<?xml version="1.0" encoding="UTF-8"?>\n<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="urn:uuid:${id}"/></head><docTitle><text>${esc(title)}</text></docTitle><navMap>${toc
        .map((t, i) => `<navPoint id="n${i + 1}" playOrder="${i + 1}"><navLabel><text>${esc(t.label)}</text></navLabel><content src="${t.file}"/></navPoint>`)
        .join('')}</navMap></ncx>`,
    ),
  }
  const pics = epubImageFiles()
  for (const p of pages) files[`OEBPS/${p.file}`] = strToU8(xhtml(p.title, pics.take(p.body), p.cls))
  Object.assign(files, pics.files)
  if (cover) files[`OEBPS/imagens/capa.${cover.ext}`] = cover.data
  fonts.forEach((f, i) => (files[`OEBPS/fontes/f${i}.woff2`] = f.data))

  const manifest = [
    '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
    '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
    '<item id="css" href="estilo.css" media-type="text/css"/>',
    ...(cover ? [`<item id="capa-img" href="imagens/capa.${cover.ext}" media-type="${cover.type}" properties="cover-image"/>`] : []),
    ...fonts.map((_, i) => `<item id="f${i}" href="fontes/f${i}.woff2" media-type="font/woff2"/>`),
    ...pics.items,
    ...pages.map((p) => `<item id="${p.id}" href="${p.file}" media-type="application/xhtml+xml"/>`),
  ].join('')
  const navIndex = pages.findIndex((p) => p.id.startsWith('c') || p.id.startsWith('parte'))
  const spine = [...pages.slice(0, navIndex < 0 ? pages.length : navIndex).map((p) => p.id), 'nav', ...(navIndex < 0 ? [] : pages.slice(navIndex).map((p) => p.id))]
    .map((ref) => `<itemref idref="${ref}"${ref === 'capa' ? ' linear="yes"' : ''}/>`)
    .join('')
  files['OEBPS/content.opf'] = strToU8(
    `<?xml version="1.0" encoding="UTF-8"?>\n<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid" xml:lang="pt-BR"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="uid">urn:uuid:${id}</dc:identifier><dc:title>${esc(title)}</dc:title>${
      author ? `<dc:creator>${esc(author)}</dc:creator>` : ''
    }${d.publisher.trim() ? `<dc:publisher>${esc(d.publisher)}</dc:publisher>` : ''}<dc:language>pt-BR</dc:language><dc:date>${esc(year)}</dc:date>${
      cover ? '<meta name="cover" content="capa-img"/>' : ''
    }<meta property="dcterms:modified">${modified}</meta></metadata><manifest>${manifest}</manifest><spine toc="ncx">${spine}</spine></package>`,
  )

  // O mimetype tem de ser o primeiro arquivo, sem compressão.
  return zipSync({ mimetype: [strToU8('application/epub+zip'), { level: 0 }], ...files })
}
