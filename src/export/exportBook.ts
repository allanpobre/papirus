import { strToU8 as encode, zipSync, type Zippable } from 'fflate'
import type { Scene, SceneDoc, Story, Universe } from '../model/schema'
import { scenesOf } from '../model/universe'

/**
 * Exporta uma história como livro: Word (.docx) ou EPUB 3.
 * Só sai o texto: comentários, menções e segredos das fichas ficam no Papirus.
 */

interface DocNode {
  type: string
  text?: string
  attrs?: Record<string, unknown>
  marks?: { type: string }[]
  content?: DocNode[]
}

export interface BookExport {
  title: string
  author: string
  scenes: Scene[]
  /** Título de cada cena como título de capítulo. */
  sceneTitles: boolean
}

export function bookFrom(universe: Universe, story: Story | null, opts: { author?: string; sceneTitles?: boolean } = {}): BookExport {
  return {
    title: story?.title || universe.name || 'Sem título',
    author: opts.author ?? '',
    scenes: scenesOf(universe, story?.id ?? null),
    sceneTitles: opts.sceneTitles ?? true,
  }
}

/** Bytes no Uint8Array deste ambiente (o do TextEncoder pode ser de outro, e o zip os ignoraria). */
const strToU8 = (s: string) => new Uint8Array(encode(s))

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const blocksOf = (doc: SceneDoc) => ((doc as DocNode).content ?? []) as DocNode[]

// ─── Word ────────────────────────────────────────────────────────────

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
const WNS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'

function wRuns(nodes: DocNode[] = []): string {
  return nodes
    .map((n) => {
      if (n.type === 'hardBreak') return '<w:r><w:br/></w:r>'
      if (n.type !== 'text' || !n.text) return ''
      const m = new Set((n.marks ?? []).map((x) => x.type))
      const pr = [m.has('bold') && '<w:b/>', m.has('italic') && '<w:i/>', m.has('strike') && '<w:strike/>'].filter(Boolean).join('')
      return `<w:r>${pr ? `<w:rPr>${pr}</w:rPr>` : ''}<w:t xml:space="preserve">${esc(n.text)}</w:t></w:r>`
    })
    .join('')
}

function wPara(runs: string, style?: string, extra = ''): string {
  const pPr = style || extra ? `<w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}${extra}</w:pPr>` : ''
  return `<w:p>${pPr}${runs}</w:p>`
}

function wBlocks(nodes: DocNode[], first: { value: boolean }): string {
  return nodes
    .map((n) => {
      const firstPara = () => {
        const v = first.value
        first.value = false
        return v ? 'Primeiro' : undefined
      }
      switch (n.type) {
        case 'paragraph':
          return wPara(wRuns(n.content), firstPara())
        case 'horizontalRule':
          first.value = true
          return wPara('<w:r><w:t>* * *</w:t></w:r>', 'Separador')
        case 'blockquote':
          return (n.content ?? []).map((p) => wPara(wRuns(p.content), 'Citacao')).join('')
        case 'bulletList':
        case 'orderedList':
          return (n.content ?? [])
            .map((item, i) => {
              const marker = n.type === 'bulletList' ? '• ' : `${i + 1}. `
              return (item.content ?? []).map((p, j) => wPara((j === 0 ? `<w:r><w:t xml:space="preserve">${marker}</w:t></w:r>` : '') + wRuns(p.content), 'Lista')).join('')
            })
            .join('')
        default:
          return n.content ? wBlocks(n.content, first) : ''
      }
    })
    .join('')
}

const STYLES = `${XML}<w:styles ${WNS}>
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia" w:cs="Georgia"/><w:sz w:val="24"/><w:lang w:val="pt-BR"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="360" w:lineRule="auto"/><w:ind w:firstLine="425"/><w:jc w:val="both"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Primeiro"><w:name w:val="Primeiro parágrafo"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:firstLine="0"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="2400" w:after="480"/><w:ind w:firstLine="0"/><w:jc w:val="center"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:sz w:val="56"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Autor"><w:name w:val="Autor"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:firstLine="0"/><w:jc w:val="center"/></w:pPr><w:rPr><w:i/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Primeiro"/><w:pPr><w:keepNext/><w:pageBreakBefore/><w:spacing w:before="1200" w:after="480"/><w:ind w:firstLine="0"/><w:jc w:val="center"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:sz w:val="36"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Separador"><w:name w:val="Separador de cena"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="240" w:after="240"/><w:ind w:firstLine="0"/><w:jc w:val="center"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Citacao"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="720" w:right="720" w:firstLine="0"/></w:pPr><w:rPr><w:i/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Lista"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="720" w:hanging="360"/><w:jc w:val="left"/></w:pPr></w:style>
</w:styles>`

export function bookToDocx(book: BookExport): Uint8Array {
  const parts: string[] = [wPara(`<w:r><w:t>${esc(book.title)}</w:t></w:r>`, 'Title')]
  if (book.author) parts.push(wPara(`<w:r><w:t>${esc(book.author)}</w:t></w:r>`, 'Autor'))
  book.scenes.forEach((s, i) => {
    if (book.sceneTitles) parts.push(wPara(`<w:r><w:t>${esc(s.title || `Cena ${i + 1}`)}</w:t></w:r>`, 'Heading1'))
    else if (i === 0) parts.push(wPara('<w:r><w:br w:type="page"/></w:r>'))
    else parts.push(wPara('<w:r><w:t>* * *</w:t></w:r>', 'Separador'))
    parts.push(wBlocks(blocksOf(s.doc), { value: true }))
  })
  const document = `${XML}<w:document ${WNS}><w:body>${parts.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1418" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr></w:body></w:document>`
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z')

  const files: Zippable = {
    '[Content_Types].xml': strToU8(
      `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`,
    ),
    '_rels/.rels': strToU8(
      `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`,
    ),
    'word/_rels/document.xml.rels': strToU8(
      `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ),
    'word/document.xml': strToU8(document),
    'word/styles.xml': strToU8(STYLES),
    'docProps/core.xml': strToU8(
      `${XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(book.title)}</dc:title><dc:creator>${esc(book.author)}</dc:creator><dc:language>pt-BR</dc:language><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created></cp:coreProperties>`,
    ),
  }
  return zipSync(files)
}

// ─── EPUB ────────────────────────────────────────────────────────────

function xInline(nodes: DocNode[] = []): string {
  return nodes
    .map((n) => {
      if (n.type === 'hardBreak') return '<br/>'
      if (n.type !== 'text' || !n.text) return ''
      let t = esc(n.text)
      const m = new Set((n.marks ?? []).map((x) => x.type))
      if (m.has('strike')) t = `<del>${t}</del>`
      if (m.has('italic')) t = `<em>${t}</em>`
      if (m.has('bold')) t = `<strong>${t}</strong>`
      return t
    })
    .join('')
}

function xBlocks(nodes: DocNode[]): string {
  return nodes
    .map((n) => {
      switch (n.type) {
        case 'paragraph':
          return `<p>${xInline(n.content)}</p>`
        case 'horizontalRule':
          return '<hr class="quebra"/>'
        case 'blockquote':
          return `<blockquote>${xBlocks(n.content ?? [])}</blockquote>`
        case 'bulletList':
          return `<ul>${(n.content ?? []).map((i) => `<li>${xBlocks(i.content ?? [])}</li>`).join('')}</ul>`
        case 'orderedList':
          return `<ol>${(n.content ?? []).map((i) => `<li>${xBlocks(i.content ?? [])}</li>`).join('')}</ol>`
        default:
          return n.content ? xBlocks(n.content) : ''
      }
    })
    .join('\n')
}

const xhtml = (title: string, body: string, extraNs = '') =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml"${extraNs} xml:lang="pt-BR" lang="pt-BR"><head><meta charset="UTF-8"/><title>${esc(title)}</title><link rel="stylesheet" type="text/css" href="estilo.css"/></head><body>${body}</body></html>`

const EPUB_CSS = `body{font-family:Georgia,serif;line-height:1.55;margin:0 5%}
h1{font-weight:normal;text-align:center;margin:3em 0 1.5em;page-break-before:always}
p{margin:0;text-indent:1.4em;text-align:justify}
h1+p,hr+p,.capa+p{text-indent:0}
hr.quebra{border:0;text-align:center;margin:1.2em 0}
hr.quebra::after{content:"* * *"}
blockquote{margin:1em 2em;font-style:italic}
.capa{text-align:center;margin-top:30%}
.capa h1{font-size:2em;page-break-before:auto}
.autor{text-align:center;font-style:italic;text-indent:0}`

export function bookToEpub(book: BookExport, id = crypto.randomUUID()): Uint8Array {
  const chapters = book.scenes.map((s, i) => ({ file: `cap-${String(i + 1).padStart(3, '0')}.xhtml`, title: s.title || `Cena ${i + 1}`, scene: s }))
  const modified = new Date().toISOString().replace(/\.\d+Z$/, 'Z')

  const files: Zippable = {
    'META-INF/container.xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
    ),
    'OEBPS/estilo.css': strToU8(EPUB_CSS),
    'OEBPS/capa.xhtml': strToU8(xhtml(book.title, `<section class="capa"><h1>${esc(book.title)}</h1>${book.author ? `<p class="autor">${esc(book.author)}</p>` : ''}</section>`)),
    'OEBPS/nav.xhtml': strToU8(
      xhtml(
        'Sumário',
        `<nav epub:type="toc" id="toc"><h1>Sumário</h1><ol>${chapters.map((c) => `<li><a href="${c.file}">${esc(c.title)}</a></li>`).join('')}</ol></nav>`,
        ' xmlns:epub="http://www.idpf.org/2007/ops"',
      ),
    ),
    'OEBPS/toc.ncx': strToU8(
      `<?xml version="1.0" encoding="UTF-8"?>\n<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="urn:uuid:${id}"/></head><docTitle><text>${esc(book.title)}</text></docTitle><navMap>${chapters
        .map((c, i) => `<navPoint id="n${i + 1}" playOrder="${i + 1}"><navLabel><text>${esc(c.title)}</text></navLabel><content src="${c.file}"/></navPoint>`)
        .join('')}</navMap></ncx>`,
    ),
  }
  for (const c of chapters) {
    files[`OEBPS/${c.file}`] = strToU8(xhtml(c.title, `${book.sceneTitles ? `<h1>${esc(c.title)}</h1>` : '<hr class="quebra"/>'}\n${xBlocks(blocksOf(c.scene.doc))}`))
  }
  files['OEBPS/content.opf'] = strToU8(
    `<?xml version="1.0" encoding="UTF-8"?>\n<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid" xml:lang="pt-BR"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="uid">urn:uuid:${id}</dc:identifier><dc:title>${esc(book.title)}</dc:title>${book.author ? `<dc:creator>${esc(book.author)}</dc:creator>` : ''}<dc:language>pt-BR</dc:language><meta property="dcterms:modified">${modified}</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/><item id="css" href="estilo.css" media-type="text/css"/><item id="capa" href="capa.xhtml" media-type="application/xhtml+xml"/>${chapters
      .map((c, i) => `<item id="c${i + 1}" href="${c.file}" media-type="application/xhtml+xml"/>`)
      .join('')}</manifest><spine toc="ncx"><itemref idref="capa"/>${chapters.map((_, i) => `<itemref idref="c${i + 1}"/>`).join('')}</spine></package>`,
  )

  // O mimetype tem de ser o primeiro arquivo, sem compressão.
  return zipSync({ mimetype: [strToU8('application/epub+zip'), { level: 0 }], ...files })
}

/** Oferece bytes para salvar. */
export function downloadBytes(filename: string, data: Uint8Array, type: string) {
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
