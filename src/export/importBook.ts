import { unzipSync, strFromU8 } from 'fflate'
import type { SceneDoc } from '../model/schema'

/**
 * Importação de livros escritos fora do Papirus (.md, .txt, .docx).
 * Tudo vira um formato intermediário de blocos e depois cenas com documento do editor.
 * Nada é detectado nem vira ficha: o texto entra como texto.
 */

type Mark = 'bold' | 'italic' | 'strike'

export interface Inline {
  text: string
  marks: Mark[]
  /** Quebra de linha dentro do parágrafo. */
  br?: boolean
}

export type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; inlines: Inline[] }
  | { type: 'quote'; inlines: Inline[] }
  | { type: 'list'; ordered: boolean; items: Inline[][] }
  | { type: 'break' }

export interface ImportedScene {
  title: string
  doc: SceneDoc
  text: string
}

export interface ImportedBook {
  title: string
  scenes: ImportedScene[]
  /** Texto curto antes da primeira cena (autor, dedicatória). Vai para a sinopse da história. */
  front: string
}

/** Como dividir o texto em cenas. */
export type SplitMode = 'titulos' | 'separadores' | 'nada'

const BREAK_LINE = /^\s*(?:\*\s*\*\s*\*[\s*]*|-{3,}|_{3,}|#|⁂|~{3,})\s*$/

// ─── Markdown e texto ────────────────────────────────────────────────

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks: Block[] = []
  let para: string[] = []

  const flush = () => {
    if (para.length) blocks.push({ type: 'paragraph', inlines: parseInline(para.join('\n')) })
    para = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/)
    if (heading) {
      flush()
      blocks.push({ type: 'heading', level: heading[1].length, text: unescape(heading[2]) })
    } else if (BREAK_LINE.test(line)) {
      flush()
      blocks.push({ type: 'break' })
    } else if (/^\s*>/.test(line)) {
      flush()
      const quoted: string[] = []
      while (i < lines.length && /^\s*>/.test(lines[i])) quoted.push(lines[i++].replace(/^\s*>\s?/, ''))
      i--
      for (const p of quoted.join('\n').split(/\n\s*\n/)) if (p.trim()) blocks.push({ type: 'quote', inlines: parseInline(p) })
    } else if (/^\s*(?:[-*+]|\d+[.)])\s+/.test(line)) {
      flush()
      const ordered = /^\s*\d/.test(line)
      const items: Inline[][] = []
      while (i < lines.length && /^\s*(?:[-*+]|\d+[.)])\s+/.test(lines[i])) items.push(parseInline(lines[i++].replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '')))
      i--
      blocks.push({ type: 'list', ordered, items })
    } else if (!line.trim()) {
      flush()
    } else {
      para.push(line)
    }
  }
  flush()
  return blocks
}

/** Texto puro: cada linha em branco separa parágrafos; linhas de “***” separam cenas. */
export function parsePlainText(source: string): Block[] {
  return source
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .flatMap((p): Block[] => {
      if (!p.trim()) return []
      if (BREAK_LINE.test(p)) return [{ type: 'break' }]
      return [{ type: 'paragraph', inlines: [{ text: p.trim().replace(/\s*\n\s*/g, ' '), marks: [] }] }]
    })
}

/** Ênfases de Markdown: **negrito**, *itálico* ou _itálico_, ~~tachado~~, \escapes e quebras com “\”. */
export function parseInline(source: string): Inline[] {
  const out: Inline[] = []
  const open = new Set<Mark>()
  let buf = ''
  const push = () => {
    if (buf) out.push({ text: buf, marks: [...open] })
    buf = ''
  }
  const toggle = (m: Mark) => {
    push()
    if (open.has(m)) open.delete(m)
    else open.add(m)
  }
  for (let i = 0; i < source.length; i++) {
    const c = source[i]
    const next = source[i + 1]
    if (c === '\\' && next === '\n') {
      push()
      out.push({ text: '', marks: [], br: true })
      i++
    } else if (c === '\\' && next && /[\\`*_~[\]#>+\-.!()]/.test(next)) {
      buf += next
      i++
    } else if ((c === '*' && next === '*') || (c === '_' && next === '_')) {
      toggle('bold')
      i++
    } else if (c === '~' && next === '~') {
      toggle('strike')
      i++
    } else if (c === '*' || (c === '_' && !/\w/.test(source[i - 1] ?? '') )) {
      toggle('italic')
    } else if (c === '\n') {
      buf += ' '
    } else {
      buf += c
    }
  }
  push()
  return out.filter((x) => x.br || x.text)
}

function unescape(s: string): string {
  return s.replace(/\\(.)/g, '$1').replace(/[*_~]{1,2}/g, '')
}

// ─── Word (.docx) ────────────────────────────────────────────────────

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

export function parseDocx(data: Uint8Array): Block[] {
  const files = unzipSync(data, { filter: (f) => f.name === 'word/document.xml' || f.name === 'word/styles.xml' || f.name === 'word/numbering.xml' })
  const docXml = files['word/document.xml']
  if (!docXml) throw new Error('Este arquivo não parece um .docx (falta word/document.xml).')
  const parser = new DOMParser()
  const doc = parser.parseFromString(strFromU8(docXml), 'application/xml')
  const headingStyles = files['word/styles.xml'] ? headingStyleLevels(parser.parseFromString(strFromU8(files['word/styles.xml']), 'application/xml')) : new Map<string, number>()

  const blocks: Block[] = []
  let list: { ordered: boolean; items: Inline[][] } | null = null
  const flushList = () => {
    if (list) blocks.push({ type: 'list', ...list })
    list = null
  }

  for (const p of Array.from(doc.getElementsByTagNameNS(W, 'p'))) {
    const pPr = child(p, 'pPr')
    const styleId = attr(child(pPr, 'pStyle'), 'val') ?? ''
    const outline = attr(child(pPr, 'outlineLvl'), 'val')
    const level = headingStyles.get(styleId) ?? headingLevelFromName(styleId) ?? (outline !== null ? Number(outline) + 1 : null)
    const inlines = runsOf(p)
    const text = inlines.map((x) => (x.br ? '\n' : x.text)).join('')

    if (child(pPr, 'numPr')) {
      const ordered = /number|lista ?num|listnumber/i.test(styleId)
      if (!list || list.ordered !== ordered) {
        flushList()
        list = { ordered, items: [] }
      }
      if (text.trim()) list.items.push(inlines)
      continue
    }
    flushList()

    if (level !== null && level >= 0 && level <= 6 && text.trim()) blocks.push({ type: 'heading', level, text: text.trim() })
    else if (BREAK_LINE.test(text) && text.trim()) blocks.push({ type: 'break' })
    else if (/quote|cita/i.test(styleId) && text.trim()) blocks.push({ type: 'quote', inlines })
    else if (text.trim()) blocks.push({ type: 'paragraph', inlines: trimInlines(inlines) })
    else if (p.getElementsByTagNameNS(W, 'br').length && Array.from(p.getElementsByTagNameNS(W, 'br')).some((b) => attr(b, 'type') === 'page')) blocks.push({ type: 'break' })
  }
  flushList()
  return blocks
}

/** Estilos de título definidos no documento: “Heading 1”, “Título 1”, “Title”, ou com nível de tópico. */
function headingStyleLevels(styles: Document): Map<string, number> {
  const map = new Map<string, number>()
  for (const s of Array.from(styles.getElementsByTagNameNS(W, 'style'))) {
    const id = attr(s, 'styleId')
    if (!id) continue
    const name = attr(child(s, 'name'), 'val') ?? ''
    const outline = attr(child(child(s, 'pPr'), 'outlineLvl'), 'val')
    const level = headingLevelFromName(name) ?? headingLevelFromName(id) ?? (outline !== null ? Number(outline) + 1 : null)
    if (level !== null) map.set(id, level)
  }
  return map
}

function headingLevelFromName(name: string): number | null {
  // O estilo “Título” do Word fica acima de todos os títulos: costuma ser o nome do livro.
  if (/^(title|t[ií]tulo)$/i.test(name.trim())) return 0
  const m = name.match(/^(?:heading|t[ií]tulo|ttulo|überschrift|titre)\s*(\d)$/i)
  return m ? Number(m[1]) : null
}

function runsOf(p: Element): Inline[] {
  const out: Inline[] = []
  for (const r of Array.from(p.getElementsByTagNameNS(W, 'r'))) {
    const rPr = child(r, 'rPr')
    const marks: Mark[] = []
    if (on(child(rPr, 'b'))) marks.push('bold')
    if (on(child(rPr, 'i'))) marks.push('italic')
    if (on(child(rPr, 'strike'))) marks.push('strike')
    for (const n of Array.from(r.childNodes)) {
      if (!(n instanceof Element) || n.namespaceURI !== W) continue
      if (n.localName === 't') out.push({ text: n.textContent ?? '', marks })
      else if (n.localName === 'tab') out.push({ text: '\t', marks })
      else if (n.localName === 'br' && attr(n, 'type') !== 'page') out.push({ text: '', marks: [], br: true })
    }
  }
  return mergeInlines(out)
}

function on(el: Element | null): boolean {
  if (!el) return false
  const v = attr(el, 'val')
  return v === null || !['0', 'false', 'none'].includes(v)
}

function child(el: Element | null, name: string): Element | null {
  if (!el) return null
  for (const n of Array.from(el.children)) if (n.namespaceURI === W && n.localName === name) return n
  return null
}

function attr(el: Element | null, name: string): string | null {
  return el ? el.getAttributeNS(W, name) ?? el.getAttribute(`w:${name}`) : null
}

function mergeInlines(list: Inline[]): Inline[] {
  const out: Inline[] = []
  for (const x of list) {
    const last = out.at(-1)
    if (last && !last.br && !x.br && last.marks.join() === x.marks.join()) last.text += x.text
    else out.push({ ...x, marks: [...x.marks] })
  }
  return out
}

function trimInlines(list: Inline[]): Inline[] {
  const out = list.map((x) => ({ ...x }))
  if (out[0] && !out[0].br) out[0].text = out[0].text.replace(/^\s+/, '')
  const last = out.at(-1)
  if (last && !last.br) last.text = last.text.replace(/\s+$/, '')
  return out.filter((x) => x.br || x.text)
}

// ─── Blocos → cenas ──────────────────────────────────────────────────

/**
 * Divide em cenas. Com “titulos”, o título mais alto que aparece uma vez só no topo vira
 * o nome do livro e o nível seguinte divide as cenas. Com “separadores”, cada *** abre
 * uma cena nova. Com “nada”, tudo vira uma cena (os *** ficam como separadores).
 */
export function blocksToBook(blocks: Block[], fallbackTitle: string, mode: SplitMode = 'titulos'): ImportedBook {
  let title = fallbackTitle
  let body = blocks
  const headings = blocks.filter((b): b is Extract<Block, { type: 'heading' }> => b.type === 'heading')
  const levels = [...new Set(headings.map((h) => h.level))].sort((a, b) => a - b)

  const top = blocks[0]
  if (top?.type === 'heading' && headings.filter((h) => h.level === top.level).length === 1 && (levels.length > 1 || mode !== 'titulos')) {
    title = top.text
    body = blocks.slice(1)
  }
  const splitLevel = mode === 'titulos' ? levels.find((l) => body.some((b) => b.type === 'heading' && b.level === l)) : undefined

  const scenes: { title: string; blocks: Block[] }[] = []
  let current: { title: string; blocks: Block[] } | null = null
  const start = (t: string) => {
    current = { title: t, blocks: [] }
    scenes.push(current)
  }

  for (const b of body) {
    if (mode === 'titulos' && splitLevel !== undefined && b.type === 'heading' && b.level <= splitLevel) {
      start(b.text)
    } else if (mode === 'separadores' && b.type === 'break') {
      start('')
    } else {
      if (!current) start('')
      // Títulos de nível mais baixo dentro de uma cena viram parágrafos em negrito.
      current!.blocks.push(b.type === 'heading' ? { type: 'paragraph', inlines: [{ text: b.text, marks: ['bold'] }] } : b)
    }
  }

  // Pouco texto antes do primeiro título (autor, dedicatória) não vira cena.
  let front = ''
  const lead = scenes[0]
  if (splitLevel !== undefined && lead && !lead.title && scenes.length > 1) {
    const t = blocksToDoc(lead.blocks).text.trim()
    if (t.length < 200) {
      front = t
      scenes.shift()
    }
  }

  const named = scenes
    .filter((s) => s.title || s.blocks.some((b) => b.type !== 'break'))
    .map((s, i) => ({ ...s, title: s.title || `Cena ${i + 1}`, blocks: trimBreaks(s.blocks) }))
  return { title, front, scenes: named.map((s) => ({ title: s.title, ...blocksToDoc(s.blocks) })) }
}

function trimBreaks(blocks: Block[]): Block[] {
  let a = 0
  let b = blocks.length
  while (a < b && blocks[a].type === 'break') a++
  while (b > a && blocks[b - 1].type === 'break') b--
  return blocks.slice(a, b)
}

interface DocNode {
  type: string
  text?: string
  marks?: { type: string }[]
  attrs?: Record<string, unknown>
  content?: DocNode[]
}

function inlineNodes(list: Inline[]): DocNode[] {
  return list.map((x) => (x.br ? { type: 'hardBreak' } : { type: 'text', text: x.text, ...(x.marks.length ? { marks: x.marks.map((m) => ({ type: m })) } : {}) }))
}

const paragraph = (list: Inline[]): DocNode => {
  const content = inlineNodes(list)
  return content.length ? { type: 'paragraph', content } : { type: 'paragraph' }
}

export function blocksToDoc(blocks: Block[]): { doc: SceneDoc; text: string } {
  const content: DocNode[] = blocks.map((b) => {
    switch (b.type) {
      case 'break':
        return { type: 'horizontalRule' }
      case 'quote':
        return { type: 'blockquote', content: [paragraph(b.inlines)] }
      case 'list':
        return { type: b.ordered ? 'orderedList' : 'bulletList', ...(b.ordered ? { attrs: { start: 1 } } : {}), content: b.items.map((it) => ({ type: 'listItem', content: [paragraph(it)] })) }
      case 'heading':
        return paragraph([{ text: b.text, marks: ['bold'] }])
      default:
        return paragraph(b.inlines)
    }
  })
  const text = blocks
    .map((b) => {
      const t = (l: Inline[]) => l.map((x) => (x.br ? '\n' : x.text)).join('')
      if (b.type === 'break') return ''
      if (b.type === 'heading') return b.text
      if (b.type === 'list') return b.items.map(t).join('\n\n')
      return t(b.inlines)
    })
    .join('\n\n')
  return { doc: { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] } as SceneDoc, text }
}

/** Lê um arquivo (.md, .markdown, .txt ou .docx) e devolve as cenas. */
export async function importBookFile(file: File, mode: SplitMode): Promise<ImportedBook> {
  const name = file.name.replace(/\.[^.]+$/, '')
  if (/\.docx$/i.test(file.name)) return blocksToBook(parseDocx(new Uint8Array(await file.arrayBuffer())), name, mode)
  const text = await file.text()
  const blocks = /\.(md|markdown)$/i.test(file.name) || /^#{1,6}\s/m.test(text) ? parseMarkdown(text) : parsePlainText(text)
  return blocksToBook(blocks, name, mode)
}
