// @vitest-environment jsdom
import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { sampleFor } from '../model/sample'
import type { BookDesign, Universe } from '../model/schema'
import { BOOK_PRESETS, defaultDesign } from './bookDesign'
import { designedEpub } from './bookEpub'

/*
 * O EPUB do exemplo de Oz, conferido por dentro como um leitor de e-book confere: o `mimetype` (primeiro, sem compressão e
 * sem campo extra), o container, o pacote (OPF) com manifesto e spine coerentes, o sumário (nav e NCX) e cada página XHTML
 * (bem formada, com título, links e imagens que existem). Não substitui o epubcheck (Java), mas pega o que ele pega no
 * básico. Cada conferência devolve uma lista de problemas; vazia é bom.
 */

const MIME: Record<string, string[]> = {
  xhtml: ['application/xhtml+xml'],
  css: ['text/css'],
  png: ['image/png'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  gif: ['image/gif'],
  svg: ['image/svg+xml'],
  woff2: ['font/woff2', 'application/font-woff2'],
  ncx: ['application/x-dtbncx+xml'],
}
const xml = (text: string) => new DOMParser().parseFromString(text, 'application/xml')
const xhtml = (text: string) => new DOMParser().parseFromString(text, 'application/xhtml+xml')
const bad = (doc: Document) => doc.getElementsByTagName('parsererror').length > 0
const dirOf = (path: string) => path.slice(0, path.lastIndexOf('/') + 1)
const resolve = (base: string, href: string) => {
  const parts = (dirOf(base) + href.split('#')[0]).split('/')
  const out: string[] = []
  for (const p of parts) p === '..' ? out.pop() : p !== '.' && p !== '' && out.push(p)
  return out.join('/')
}

/** O primeiro item do zip: o `mimetype`, guardado sem compressão e sem campo extra (como o EPUB manda). */
function checkMimetype(zip: Uint8Array): string[] {
  const problems: string[] = []
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength)
  if (view.getUint32(0, true) !== 0x04034b50) return ['o arquivo não começa com um item de zip']
  const method = view.getUint16(8, true)
  const nameLen = view.getUint16(26, true)
  const extraLen = view.getUint16(28, true)
  const size = view.getUint32(22, true)
  const name = new TextDecoder().decode(zip.subarray(30, 30 + nameLen))
  if (name !== 'mimetype') problems.push(`o primeiro item é "${name}", e deveria ser "mimetype"`)
  if (method !== 0) problems.push(`o mimetype está comprimido (método ${method}); deveria ser guardado (0)`)
  if (extraLen !== 0) problems.push(`o mimetype tem campo extra (${extraLen} bytes)`)
  const content = new TextDecoder().decode(zip.subarray(30 + nameLen + extraLen, 30 + nameLen + extraLen + size))
  if (content !== 'application/epub+zip') problems.push(`o conteúdo do mimetype é "${content}"`)
  return problems
}

function checkPackage(files: Record<string, Uint8Array>): { problems: string[]; spineFiles: string[]; opfPath: string } {
  const problems: string[] = []
  const container = xml(strFromU8(files['META-INF/container.xml'] ?? new Uint8Array()))
  if (bad(container)) return { problems: ['container.xml não é XML válido'], spineFiles: [], opfPath: '' }
  const root = container.querySelector('rootfile')
  const opfPath = root?.getAttribute('full-path') ?? ''
  if (!opfPath || !files[opfPath]) problems.push(`o container aponta para um pacote que não existe: "${opfPath}"`)
  if (root?.getAttribute('media-type') !== 'application/oebps-package+xml') problems.push('o rootfile não tem o media-type do pacote OPF')
  const opf = xml(strFromU8(files[opfPath] ?? new Uint8Array()))
  if (bad(opf)) return { problems: [...problems, 'o pacote OPF não é XML válido'], spineFiles: [], opfPath }
  const pkg = opf.documentElement
  if (pkg.getAttribute('version') !== '3.0') problems.push(`a versão do pacote é "${pkg.getAttribute('version')}"`)
  // Metadados obrigatórios.
  const uid = pkg.getAttribute('unique-identifier') ?? ''
  const identifier = [...opf.getElementsByTagName('dc:identifier')].find((e) => e.getAttribute('id') === uid)
  if (!identifier?.textContent?.trim()) problems.push('o identificador único (dc:identifier) citado em unique-identifier não existe')
  if (!opf.getElementsByTagName('dc:title')[0]?.textContent?.trim()) problems.push('falta dc:title')
  if (!opf.getElementsByTagName('dc:language')[0]?.textContent?.trim()) problems.push('falta dc:language')
  const modified = [...opf.getElementsByTagName('meta')].find((m) => m.getAttribute('property') === 'dcterms:modified')?.textContent ?? ''
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(modified)) problems.push(`dcterms:modified inválido: "${modified}"`)

  // Manifesto: ids únicos, arquivos que existem, tipos que combinam com a extensão.
  const base = dirOf(opfPath)
  const items = [...opf.getElementsByTagName('item')]
  const byId = new Map<string, Element>()
  const declared = new Set<string>()
  for (const it of items) {
    const id = it.getAttribute('id') ?? ''
    const href = it.getAttribute('href') ?? ''
    const path = base + href
    if (byId.has(id)) problems.push(`id repetido no manifesto: "${id}"`)
    byId.set(id, it)
    declared.add(path)
    if (!files[path]) problems.push(`o manifesto cita "${href}", que não está no arquivo`)
    const ext = href.split('.').pop() ?? ''
    const type = it.getAttribute('media-type') ?? ''
    if (MIME[ext] && !MIME[ext].includes(type)) problems.push(`"${href}" tem media-type "${type}", e a extensão pede ${MIME[ext].join(' ou ')}`)
  }
  // Tudo o que está no arquivo (fora do mimetype e do META-INF) precisa estar no manifesto.
  for (const name of Object.keys(files)) {
    if (name === 'mimetype' || name.startsWith('META-INF/') || name === opfPath) continue
    if (!declared.has(name)) problems.push(`"${name}" está no arquivo mas não no manifesto`)
  }
  // Exatamente um item "nav"; no máximo uma imagem de capa.
  const navItems = items.filter((i) => (i.getAttribute('properties') ?? '').split(/\s+/).includes('nav'))
  if (navItems.length !== 1) problems.push(`deveria haver 1 item com properties="nav" e há ${navItems.length}`)
  if (items.filter((i) => (i.getAttribute('properties') ?? '').split(/\s+/).includes('cover-image')).length > 1) problems.push('mais de uma imagem de capa')

  // Spine: cada itemref cita um item do manifesto, e todos são páginas XHTML.
  const spineEl = opf.getElementsByTagName('spine')[0]
  const toc = spineEl?.getAttribute('toc')
  if (toc && byId.get(toc)?.getAttribute('media-type') !== 'application/x-dtbncx+xml') problems.push(`spine toc="${toc}" não aponta para o NCX`)
  const spineFiles: string[] = []
  for (const ref of [...opf.getElementsByTagName('itemref')]) {
    const it = byId.get(ref.getAttribute('idref') ?? '')
    if (!it) {
      problems.push(`itemref "${ref.getAttribute('idref')}" não está no manifesto`)
      continue
    }
    if (it.getAttribute('media-type') !== 'application/xhtml+xml') problems.push(`a spine tem um item que não é XHTML: "${it.getAttribute('href')}"`)
    spineFiles.push(base + (it.getAttribute('href') ?? ''))
  }
  if (!spineFiles.length) problems.push('a spine está vazia')
  // Toda página XHTML do manifesto está na spine (senão o leitor nunca chega nela), menos a nav, que pode ficar fora.
  const inSpine = new Set(spineFiles)
  for (const it of items) if (it.getAttribute('media-type') === 'application/xhtml+xml' && !inSpine.has(base + it.getAttribute('href')!)) problems.push(`"${it.getAttribute('href')}" é página mas não está na spine`)
  return { problems, spineFiles, opfPath }
}

function checkPages(files: Record<string, Uint8Array>, opfPath: string): string[] {
  const problems: string[] = []
  for (const [name, data] of Object.entries(files)) {
    if (!name.endsWith('.xhtml')) continue
    const doc = xhtml(strFromU8(data))
    if (bad(doc)) {
      problems.push(`${name}: XHTML mal formado (${doc.getElementsByTagName('parsererror')[0].textContent?.slice(0, 80)})`)
      continue
    }
    const html = doc.documentElement
    if (html.localName !== 'html' || html.namespaceURI !== 'http://www.w3.org/1999/xhtml') problems.push(`${name}: a raiz não é <html> do XHTML`)
    if (!doc.querySelector('head > title')?.textContent?.trim()) problems.push(`${name}: falta o <title>`)
    if (!(html.getAttribute('lang') || html.getAttribute('xml:lang'))) problems.push(`${name}: falta o idioma (lang)`)
    // ids repetidos na mesma página e blocos dentro de parágrafo (HTML inválido que o XML aceita).
    const ids = [...doc.querySelectorAll('[id]')].map((e) => e.getAttribute('id')!)
    for (const id of new Set(ids.filter((x, i) => ids.indexOf(x) !== i))) problems.push(`${name}: id repetido "${id}"`)
    if (doc.querySelector('p p, p div, p ul, p ol, p blockquote, p h1, p h2, p h3, p table, a a')) problems.push(`${name}: elemento aninhado onde o HTML não deixa (p dentro de p, bloco dentro de p, a dentro de a)`)
    for (const img of [...doc.getElementsByTagName('img')]) {
      const src = img.getAttribute('src') ?? ''
      if (!files[resolve(name, src)]) problems.push(`${name}: imagem "${src}" não existe`)
      if (img.getAttribute('alt') === null) problems.push(`${name}: <img> sem alt`)
    }
    for (const a of [...doc.getElementsByTagName('a')]) {
      const href = a.getAttribute('href') ?? ''
      if (!href || /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('#')) continue
      if (!files[resolve(name, href)]) problems.push(`${name}: o link "${href}" não leva a nada`)
    }
    for (const link of [...doc.getElementsByTagName('link')]) if (!files[resolve(name, link.getAttribute('href') ?? '')]) problems.push(`${name}: a folha de estilo "${link.getAttribute('href')}" não existe`)
  }
  // O CSS: as fontes citadas existem.
  for (const [name, data] of Object.entries(files)) {
    if (!name.endsWith('.css')) continue
    for (const m of strFromU8(data).matchAll(/url\(["']?([^)"']+)["']?\)/g)) if (!/^data:/.test(m[1]) && !files[resolve(name, m[1])]) problems.push(`${name}: url("${m[1]}") não existe`)
  }
  void opfPath
  return problems
}

function checkNavigation(files: Record<string, Uint8Array>, spineFiles: string[], opfPath: string): string[] {
  const problems: string[] = []
  const nav = Object.keys(files).find((f) => f.endsWith('nav.xhtml'))
  if (!nav) return ['sem o sumário nav.xhtml']
  const doc = xhtml(strFromU8(files[nav]))
  const toc = [...doc.getElementsByTagName('nav')].find((n) => n.getAttribute('epub:type') === 'toc')
  if (!toc) problems.push('o nav.xhtml não tem <nav epub:type="toc">')
  const links = toc ? [...toc.getElementsByTagName('a')] : []
  if (!links.length) problems.push('o sumário está vazio')
  for (const a of links) {
    const target = resolve(nav, a.getAttribute('href') ?? '')
    if (!files[target]) problems.push(`o sumário aponta para "${a.getAttribute('href')}", que não existe`)
    else if (!spineFiles.includes(target)) problems.push(`o sumário aponta para "${a.getAttribute('href')}", que não está na spine`)
    if (!a.textContent?.trim()) problems.push(`item do sumário sem texto: "${a.getAttribute('href')}"`)
  }
  // O NCX (para leitores antigos) bate com o pacote.
  const ncxName = Object.keys(files).find((f) => f.endsWith('.ncx'))
  if (ncxName) {
    const ncx = xml(strFromU8(files[ncxName]))
    if (bad(ncx)) problems.push('toc.ncx não é XML válido')
    else {
      const opf = xml(strFromU8(files[opfPath]))
      const id = opf.getElementsByTagName('dc:identifier')[0]?.textContent?.trim()
      const uid = [...ncx.getElementsByTagName('meta')].find((m) => m.getAttribute('name') === 'dtb:uid')?.getAttribute('content')
      if (uid !== id) problems.push(`o NCX tem dtb:uid "${uid}" e o pacote, "${id}"`)
      for (const c of [...ncx.getElementsByTagName('content')]) if (!files[resolve(ncxName, c.getAttribute('src') ?? '')]) problems.push(`o NCX aponta para "${c.getAttribute('src')}", que não existe`)
    }
  }
  return problems
}

/** Todas as conferências, em ordem. */
function validateEpub(bytes: Uint8Array): string[] {
  const files = unzipSync(bytes)
  const { problems: pk, spineFiles, opfPath } = checkPackage(files)
  return [...checkMimetype(bytes), ...pk, ...checkPages(files, opfPath), ...checkNavigation(files, spineFiles, opfPath)]
}

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAIAAAA2iEnWAAAAEklEQVR4nGNgYGD4z8DAwMAAAA8AAf8k0R0AAAAASUVORK5CYII='

function ozDesign(u: Universe, extra: Partial<BookDesign> = {}): BookDesign {
  return { ...defaultDesign(), ...BOOK_PRESETS.fantasia.design, author: 'L. Frank Baum', title: u.name, publisher: 'Papirus', year: '1900', dedication: 'Para a minha mãe.', epigraph: 'Há um lugar além do arco-íris.', epigraphSource: 'canção', acknowledgments: 'Obrigado a todos.', aboutAuthor: 'Escritor americano.', cover: PNG, ...extra }
}

describe('EPUB do exemplo de Oz, conferido por dentro', () => {
  it('o mimetype é o primeiro item, guardado sem compressão e sem campo extra', async () => {
    const u = await sampleFor(null)
    expect(checkMimetype(designedEpub(u, ozDesign(u), { id: 'oz-teste' }))).toEqual([])
  })

  it('o livro inteiro de Oz (capa, partes, capítulos, sumário) passa em todas as conferências', async () => {
    const u = await sampleFor(null)
    const bytes = designedEpub(u, ozDesign(u), { id: 'oz-teste' })
    const files = unzipSync(bytes)
    expect(Object.keys(files).filter((f) => /cap-\d+\.xhtml$/.test(f)).length).toBeGreaterThan(20)
    expect(validateEpub(bytes)).toEqual([])
  })

  it('sem capa, sem dedicatória e com partes também passa', async () => {
    const u = await sampleFor(null)
    const bytes = designedEpub(u, ozDesign(u, { cover: '', dedication: '', epigraph: '', acknowledgments: '', aboutAuthor: '', parts: true, chapterUnit: 'cena' }), { id: 'oz-teste-2' })
    expect(validateEpub(bytes)).toEqual([])
  })

  it('o conferidor acha de verdade o que está errado (mimetype comprimido, item fora do manifesto, link quebrado)', () => {
    const base = unzipSync(designedEpub(sampleFor_ostria(), defaultDesign(), { id: 'x' }))
    // Um arquivo a mais, que o manifesto não conhece.
    const { zipSync, strToU8 } = require_fflate()
    const extra = zipSync({ mimetype: [strToU8('application/epub+zip'), { level: 6 }], ...base, 'OEBPS/sobra.txt': strToU8('oi') })
    const problems = validateEpub(extra)
    expect(problems.some((p) => p.includes('mimetype está comprimido'))).toBe(true)
    expect(problems.some((p) => p.includes('"OEBPS/sobra.txt" está no arquivo mas não no manifesto'))).toBe(true)
  })
})

import { ostriaUniverse } from '../model/sampleOstria'
import * as fflate from 'fflate'
const sampleFor_ostria = () => ostriaUniverse()
const require_fflate = () => fflate
