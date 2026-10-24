import type { BookDesign, Scene, SceneDoc, Story, Universe } from '../model/schema'
import { bookDesignSchema } from '../model/schema'
import { scenesOf } from '../model/universe'
import type { BookFontKey } from './bookFonts'

/**
 * Diagramação do livro em HTML + CSS de página (Paged Media), para o Paged.js paginar
 * e o navegador imprimir em PDF. A capa é do autor; o Papirus cuida do miolo:
 * fontes, títulos de capítulo, margens, cabeçalhos, sumário, quebras de cena.
 * Só sai o texto: comentários, menções e segredos das fichas ficam no Papirus.
 */

export const defaultDesign = (): BookDesign => bookDesignSchema.parse({})

export interface BookPreset {
  label: string
  hint: string
  design: Partial<BookDesign>
}

export const BOOK_PRESETS: Record<'romance' | 'fantasia' | 'contemporaneo' | 'bolso' | 'manuscrito', BookPreset> = {
  romance: {
    label: 'Romance clássico',
    hint: 'Garamond, capítulos centralizados, capitular e versalete.',
    design: { pageSize: '14x21', bodyFont: 'garamond', titleFont: 'igual', fontSize: 11, lineHeight: 1.45, chapterStyle: 'classico', chapterLabel: 'capitulo-numero', dropCap: true, smallCapsLead: true, sceneBreak: 'asterismo', header: 'titulo-autor', pageNumbers: 'rodape-centro', justify: true, hyphenate: true, paragraph: 'recuo', margins: 'normais', mirrored: true, chapterRecto: false },
  },
  fantasia: {
    label: 'Fantasia',
    hint: 'Títulos em Cinzel, ornamentos, capítulos por extenso, sempre à direita.',
    design: { ornament: '❦', dividerSymbol: '✦', pageSize: '16x23', bodyFont: 'garamond', titleFont: 'cinzel', fontSize: 11.5, lineHeight: 1.5, chapterStyle: 'ornamentado', chapterLabel: 'capitulo-extenso', dropCap: true, smallCapsLead: true, sceneBreak: 'floral', header: 'titulo-capitulo', pageNumbers: 'rodape-centro', justify: true, hyphenate: true, paragraph: 'recuo', margins: 'normais', mirrored: true, chapterRecto: true },
  },
  contemporaneo: {
    label: 'Contemporâneo',
    hint: 'Número grande, título sem serifa, alinhado à esquerda.',
    design: { pageSize: '14x21', bodyFont: 'crimson', titleFont: 'sans', fontSize: 11.5, lineHeight: 1.45, chapterStyle: 'moderno', chapterLabel: 'numero', dropCap: false, smallCapsLead: false, sceneBreak: 'asteriscos', header: 'titulo-capitulo', pageNumbers: 'rodape-externo', justify: true, hyphenate: true, paragraph: 'recuo', margins: 'normais', mirrored: true, chapterRecto: false },
  },
  bolso: {
    label: 'Livro de bolso',
    hint: '11×18 cm, letra menor, margens estreitas.',
    design: { pageSize: 'bolso', bodyFont: 'crimson', titleFont: 'igual', fontSize: 10, lineHeight: 1.35, chapterStyle: 'minimalista', chapterLabel: 'numero', dropCap: false, smallCapsLead: true, sceneBreak: 'asterismo', header: 'titulo-autor', pageNumbers: 'rodape-externo', justify: true, hyphenate: true, paragraph: 'recuo', margins: 'estreitas', mirrored: true, chapterRecto: false },
  },
  manuscrito: {
    label: 'Manuscrito para editora',
    hint: 'A4, fonte de máquina, espaço duplo, sem enfeites: o formato que editoras pedem.',
    design: { pageSize: 'a4', bodyFont: 'mono', titleFont: 'igual', fontSize: 12, lineHeight: 2, chapterStyle: 'manuscrito', chapterLabel: 'capitulo-numero', dropCap: false, smallCapsLead: false, sceneBreak: 'asteriscos', header: 'titulo-autor', pageNumbers: 'topo-externo', justify: false, hyphenate: false, paragraph: 'recuo', margins: 'largas', mirrored: false, chapterRecto: false, toc: false },
  },
}

export const PAGE_SIZES: Record<BookDesign['pageSize'], { label: string; w: number; h: number }> = {
  bolso: { label: 'Bolso (11 × 18 cm)', w: 110, h: 180 },
  a5: { label: 'A5 (14,8 × 21 cm)', w: 148, h: 210 },
  '14x21': { label: '14 × 21 cm (padrão de romance)', w: 140, h: 210 },
  '16x23': { label: '16 × 23 cm', w: 160, h: 230 },
  a4: { label: 'A4 (21 × 29,7 cm)', w: 210, h: 297 },
  carta: { label: 'Carta (21,6 × 27,9 cm)', w: 216, h: 279 },
}

/** Margens em mm: [cima, baixo, dentro (lombada), fora]. */
const MARGINS: Record<BookDesign['margins'], [number, number, number, number]> = {
  estreitas: [14, 17, 16, 12],
  normais: [19, 22, 21, 15],
  largas: [25, 28, 25, 22],
}

export const BODY_FONT_KEY: Record<BookDesign['bodyFont'], BookFontKey> = {
  literata: 'literata',
  garamond: 'garamond',
  crimson: 'crimson',
  lora: 'lora',
  baskerville: 'baskerville',
  mono: 'mono',
}
export const TITLE_FONT_KEY: Record<Exclude<BookDesign['titleFont'], 'igual'>, BookFontKey> = {
  young: 'young',
  cinzel: 'cinzel',
  playfair: 'playfair',
  garamond: 'garamond',
  sans: 'sans',
}

export const fontsOf = (d: BookDesign): BookFontKey[] => [BODY_FONT_KEY[d.bodyFont], ...(d.titleFont === 'igual' ? [] : [TITLE_FONT_KEY[d.titleFont]])]

const SCENE_BREAK: Record<BookDesign['sceneBreak'], string> = {
  asterismo: '⁂',
  asteriscos: '* * *',
  floral: '❦',
  traco: '—',
  linha: '',
  espaco: '',
  simbolo: '',
}

// ─── Números de capítulo ─────────────────────────────────────────────

const UNITS = ['', 'Um', 'Dois', 'Três', 'Quatro', 'Cinco', 'Seis', 'Sete', 'Oito', 'Nove', 'Dez', 'Onze', 'Doze', 'Treze', 'Catorze', 'Quinze', 'Dezesseis', 'Dezessete', 'Dezoito', 'Dezenove']
const TENS = ['', '', 'Vinte', 'Trinta', 'Quarenta', 'Cinquenta', 'Sessenta', 'Setenta', 'Oitenta', 'Noventa']

export function numberWords(n: number): string {
  if (n <= 0) return String(n)
  if (n < 20) return UNITS[n]
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ` e ${UNITS[n % 10].toLowerCase()}` : '')
  if (n === 100) return 'Cem'
  if (n < 200) return `Cento e ${numberWords(n - 100).toLowerCase()}`
  return String(n)
}

export function roman(n: number): string {
  const map: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]
  let out = ''
  for (const [v, s] of map) {
    while (n >= v) {
      out += s
      n -= v
    }
  }
  return out
}

export function chapterLabel(d: BookDesign, n: number): string {
  switch (d.chapterLabel) {
    case 'capitulo-numero':
      return `Capítulo ${n}`
    case 'capitulo-extenso':
      return `Capítulo ${numberWords(n)}`
    case 'numero':
      return String(n)
    case 'romano':
      return roman(n)
    case 'nenhum':
      return ''
  }
}

// ─── Conteúdo ────────────────────────────────────────────────────────

interface DocNode {
  type: string
  text?: string
  marks?: { type: string }[]
  content?: DocNode[]
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
/** Texto para dentro de content: "…" no CSS. */
const cssString = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ')}"`

function inline(nodes: DocNode[] = []): string {
  return nodes
    .map((n) => {
      if (n.type === 'hardBreak') return '<br>'
      if (n.type !== 'text' || !n.text) return n.content ? inline(n.content) : ''
      let html = esc(n.text)
      for (const m of n.marks ?? []) {
        if (m.type === 'bold') html = `<strong>${html}</strong>`
        else if (m.type === 'italic') html = `<em>${html}</em>`
        else if (m.type === 'strike') html = `<s>${html}</s>`
      }
      return html
    })
    .join('')
}

/** Primeiras palavras em versalete e capitular: só faz sentido se o parágrafo começa com letra. */
function opening(html: string, d: BookDesign): { html: string; drop: boolean } {
  const plain = html.replace(/<[^>]+>/g, '')
  const startsWithLetter = /^\p{L}/u.test(plain)
  if (!d.smallCapsLead || !startsWithLetter || /^<(strong|em|s)>/.test(html)) return { html, drop: startsWithLetter }
  const words = html.match(/^(\S+(?:\s+\S+){0,2})/)
  if (!words || /</.test(words[1])) return { html, drop: startsWithLetter }
  return { html: `<span class="lead">${words[1]}</span>${html.slice(words[1].length)}`, drop: startsWithLetter }
}

function body(doc: SceneDoc, d: BookDesign, startOfChapter: boolean): string {
  const out: string[] = []
  let first = startOfChapter
  let afterBreak = false
  const para = (inner: string) => {
    if (first) {
      first = false
      const o = opening(inner, d)
      out.push(`<p class="first${d.dropCap && o.drop ? ' drop' : ''}">${o.html}</p>`)
    } else {
      out.push(`<p${afterBreak ? ' class="after-break"' : ''}>${inner}</p>`)
    }
    afterBreak = false
  }
  for (const n of ((doc as DocNode).content ?? []) as DocNode[]) {
    switch (n.type) {
      case 'paragraph': {
        const inner = inline(n.content)
        if (inner.trim()) para(inner)
        break
      }
      case 'horizontalRule':
        out.push(sceneBreak(d))
        afterBreak = true
        break
      case 'blockquote':
        out.push(`<blockquote>${(n.content ?? []).map((p) => `<p>${inline(p.content)}</p>`).join('')}</blockquote>`)
        afterBreak = true
        break
      case 'bulletList':
      case 'orderedList': {
        const tag = n.type === 'bulletList' ? 'ul' : 'ol'
        out.push(`<${tag}>${(n.content ?? []).map((li) => `<li>${(li.content ?? []).map((p) => inline(p.content)).join(' ')}</li>`).join('')}</${tag}>`)
        afterBreak = true
        break
      }
      default:
        if (n.content) para(inline(n.content))
    }
  }
  return out.join('\n')
}

const sceneBreak = (d: BookDesign) =>
  d.sceneBreak === 'linha'
    ? '<hr class="scene-break line">'
    : d.sceneBreak === 'espaco'
      ? '<div class="scene-break space"></div>'
      : `<p class="scene-break">${esc(d.sceneBreak === 'simbolo' ? d.sceneBreakSymbol.trim() || '✦' : SCENE_BREAK[d.sceneBreak])}</p>`

const paragraphs = (text: string) =>
  text
    .split(/\n{2,}|\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p)}</p>`)
    .join('')

export interface BookChapter {
  id: string
  label: string
  title: string
  html: string
}

/** As histórias que entram, na ordem escolhida (ou todas). */
export function storiesOf(universe: Universe, d: BookDesign): Story[] {
  if (!d.storyIds.length) return universe.stories
  return d.storyIds.map((id) => universe.stories.find((s) => s.id === id)).filter((s): s is Story => Boolean(s))
}

/** O miolo: partes e capítulos já montados. */
export function bookContent(universe: Universe, d: BookDesign): { parts: { story: Story | null; chapters: BookChapter[] }[]; words: number } {
  const stories = storiesOf(universe, d)
  const groups: { story: Story | null; scenes: Scene[] }[] = stories.map((s) => ({ story: s, scenes: scenesOf(universe, s.id) }))
  if (!stories.length) groups.push({ story: null, scenes: scenesOf(universe, null) })
  let n = 0
  let words = 0
  const parts = groups.map(({ story, scenes }) => {
    const chapters: BookChapter[] = []
    const withText = scenes.filter((s) => s.text.trim())
    for (const s of withText) words += s.text.match(/\S+/g)?.length ?? 0
    if (d.chapterUnit === 'historia') {
      if (withText.length) {
        n++
        const html = withText.map((s, i) => (i ? sceneBreak(d) : '') + body(s.doc, d, i === 0)).join('\n')
        chapters.push({ id: `cap-${n}`, label: chapterLabel(d, n), title: story?.title ?? '', html })
      }
    } else {
      for (const s of withText) {
        n++
        chapters.push({ id: `cap-${n}`, label: chapterLabel(d, n), title: s.title, html: body(s.doc, d, true) })
      }
    }
    return { story, chapters }
  })
  return { parts: parts.filter((p) => p.chapters.length), words }
}

// ─── Documento ───────────────────────────────────────────────────────

export function bookTitle(universe: Universe, d: BookDesign): string {
  return d.title.trim() || (storiesOf(universe, d).length === 1 ? storiesOf(universe, d)[0].title : '') || universe.name || 'Sem título'
}

/** O livro inteiro (HTML do corpo) e a folha de estilo de página. */
export function buildBook(universe: Universe, design: BookDesign): { title: string; html: string; css: string; chapters: number; words: number } {
  const d = design
  const title = bookTitle(universe, d)
  const { parts, words } = bookContent(universe, d)
  const useParts = d.parts && parts.length > 1 && d.chapterUnit === 'cena'
  const year = d.year.trim() || String(new Date().getFullYear())
  const sections: string[] = []

  if (d.cover) sections.push(`<section class="cover"><img src="${esc(d.cover)}" alt=""></section>`)
  sections.push(
    `<section class="title-page"><h1 class="book-title">${esc(title)}</h1>${d.subtitle.trim() ? `<p class="subtitle">${esc(d.subtitle)}</p>` : ''}${
      d.author.trim() ? `<p class="author">${esc(d.author)}</p>` : ''
    }${d.publisher.trim() ? `<p class="publisher">${esc(d.publisher)}</p>` : ''}</section>`,
  )
  const rights = d.copyright.trim() || (d.author.trim() ? `© ${year} ${d.author.trim()}. Todos os direitos reservados.` : '')
  sections.push(`<section class="copyright">${rights ? paragraphs(rights) : ''}<p class="made">Diagramado no Papirus.</p></section>`)
  if (d.dedication.trim()) sections.push(`<section class="dedication">${paragraphs(d.dedication)}</section>`)
  if (d.epigraph.trim())
    sections.push(`<section class="epigraph"><blockquote>${paragraphs(d.epigraph)}${d.epigraphSource.trim() ? `<p class="source">— ${esc(d.epigraphSource)}</p>` : ''}</blockquote></section>`)

  const all = parts.flatMap((p) => p.chapters)
  if (d.toc && all.length > 1) {
    const items = parts
      .flatMap((p, pi) => [
        ...(useParts ? [`<li class="toc-part">${esc(p.story?.title || `Parte ${pi + 1}`)}</li>`] : []),
        ...p.chapters.map((c) => `<li><a href="#${c.id}"><span class="toc-text">${esc([c.label, d.chapterTitles ? c.title : ''].filter(Boolean).join(' · ') || c.title)}</span><span class="toc-dots"></span></a></li>`),
      ])
      .join('')
    sections.push(`<section class="toc"><h2>Sumário</h2><ol>${items}</ol></section>`)
  }

  let firstChapter = true
  parts.forEach((p, pi) => {
    if (useParts) sections.push(`<section class="part"><p class="part-label">Parte ${numberWords(pi + 1)}</p><h2 class="part-title">${esc(p.story?.title ?? '')}</h2></section>`)
    for (const c of p.chapters) {
      const showTitle = d.chapterTitles && c.title.trim()
      const running = (showTitle ? c.title : c.label) || title
      sections.push(
        `<section class="chapter${firstChapter ? ' first-chapter' : ''}" id="${c.id}"><header class="chapter-head"><span class="running">${esc(running)}</span>${
          d.ornament.trim() ? `<p class="chapter-ornament" aria-hidden="true">${esc(d.ornament.trim())}</p>` : ''
        }${
          c.label ? `<p class="chapter-label">${esc(c.label)}</p>` : ''
        }${showTitle ? `<h2 class="chapter-title">${esc(c.title)}</h2>` : ''}<div class="chapter-orn" aria-hidden="true"></div></header><div class="chapter-body">${c.html}</div></section>`,
      )
      firstChapter = false
    }
  })

  if (d.acknowledgments.trim()) sections.push(`<section class="back-matter"><h2>Agradecimentos</h2>${paragraphs(d.acknowledgments)}</section>`)
  if (d.aboutAuthor.trim()) sections.push(`<section class="back-matter"><h2>${d.author.trim() ? `Sobre ${esc(d.author.trim())}` : 'Sobre o autor'}</h2>${paragraphs(d.aboutAuthor)}</section>`)
  if (d.backCover) sections.push(`<section class="cover back-cover"><img src="${esc(d.backCover)}" alt=""></section>`)

  return { title, html: sections.join('\n'), css: bookCss(d, title), chapters: all.length, words }
}

/** A folha de estilo de página do livro. */
export function bookCss(d: BookDesign, title: string): string {
  const size = PAGE_SIZES[d.pageSize]
  const [top, bottom, inner0, outer0] = MARGINS[d.margins]
  const inner = d.mirrored ? inner0 : (inner0 + outer0) / 2
  const outer = d.mirrored ? outer0 : (inner0 + outer0) / 2
  const bodyStack = `"${fontFamily(d.bodyFont)}"`
  const titleStack = d.titleFont === 'igual' ? bodyStack : `"${fontFamily(d.titleFont)}"`
  const author = d.author.trim()
  const headerFont = `font-family:${bodyStack};font-size:${Math.max(7, d.fontSize - 2.5)}pt;letter-spacing:.08em;font-variant:small-caps;color:#444;`
  const numFont = `font-family:${bodyStack};font-size:${Math.max(7, d.fontSize - 2)}pt;color:#333;`

  // Cabeçalho: página da esquerda (verso) e da direita (recto).
  const headLeft = d.header === 'nada' ? 'none' : d.header === 'titulo-autor' ? cssString(author || title) : cssString(title)
  const headRight = d.header === 'nada' ? 'none' : d.header === 'titulo-autor' ? cssString(title) : 'string(chapter)'
  const num = 'counter(page)'
  const marginBoxes = (side: 'left' | 'right') => {
    const outerBox = side === 'left' ? 'left' : 'right'
    const rules: string[] = []
    const head = side === 'left' ? headLeft : headRight
    if (d.pageNumbers === 'topo-externo') {
      rules.push(`@top-${outerBox}{content:${num};${numFont}}`)
      rules.push(`@top-center{content:${head};${headerFont}}`)
    } else {
      rules.push(`@top-center{content:${head};${headerFont}}`)
      if (d.pageNumbers === 'rodape-centro') rules.push(`@bottom-center{content:${num};${numFont}}`)
      if (d.pageNumbers === 'rodape-externo') rules.push(`@bottom-${outerBox}{content:${num};${numFont}}`)
    }
    return rules.join('')
  }
  const none = '@top-left{content:none}@top-center{content:none}@top-right{content:none}@bottom-left{content:none}@bottom-center{content:none}@bottom-right{content:none}'
  const chapterBreak = d.chapterRecto ? 'right' : 'page'
  const sink = d.chapterStyle === 'minimalista' ? '12%' : d.chapterStyle === 'manuscrito' ? '30%' : '22%'

  return `
@page{size:${size.w}mm ${size.h}mm;margin:${top}mm ${outer}mm ${bottom}mm ${inner}mm}
@page :left{margin-left:${outer}mm;margin-right:${inner}mm;${marginBoxes('left')}}
@page :right{margin-left:${inner}mm;margin-right:${outer}mm;${marginBoxes('right')}}
@page front{${none}}
@page :blank{${none}}
@page cover{margin:0;${none}}
@page chapter:first{${none}${d.pageNumbers === 'rodape-centro' ? `@bottom-center{content:${num};${numFont}}` : ''}}
html{font-family:${bodyStack};font-size:${d.fontSize}pt;line-height:${d.lineHeight};color:#111;-webkit-font-smoothing:antialiased;font-kerning:normal;font-variant-ligatures:common-ligatures}
body{margin:0}
p{margin:0;orphans:2;widows:2;${d.justify ? 'text-align:justify;' : 'text-align:left;'}${d.hyphenate ? 'hyphens:auto;-webkit-hyphens:auto;' : 'hyphens:manual;'}}
${d.paragraph === 'recuo' ? `.chapter-body p + p{text-indent:${d.bodyFont === 'mono' ? '3em' : '1.5em'}}.chapter-body p.after-break{text-indent:0}` : `.chapter-body p{margin-bottom:${(d.lineHeight * 0.6).toFixed(2)}em}`}
em{font-style:italic}strong{font-weight:600}
blockquote{margin:1em 1.5em;font-style:italic}
blockquote p{text-indent:0!important}
section{break-before:page}
section:first-child{break-before:auto}
.cover{page:cover;height:${size.h}mm;width:${size.w}mm;overflow:hidden}
.cover img{display:block;width:100%;height:100%;object-fit:cover}
.title-page,.copyright,.dedication,.epigraph,.toc,.part{page:front}
.title-page{text-align:center;padding-top:28%}
.book-title{font-family:${titleStack};font-weight:400;font-size:2.4em;line-height:1.15;margin:0 0 .5em;hyphens:none}
.subtitle{text-align:center;font-style:italic;font-size:1.15em;margin:0 0 3em}
.author{text-align:center;font-variant:small-caps;letter-spacing:.12em;font-size:1.2em;margin-top:4em}
.publisher{text-align:center;position:absolute;bottom:0;left:0;right:0;font-variant:small-caps;letter-spacing:.1em;font-size:.85em}
.title-page{position:relative;height:100%}
.copyright{display:flex;flex-direction:column;justify-content:flex-end;font-size:.8em;line-height:1.5}
.copyright p{text-align:left;margin-bottom:.6em}
.copyright .made{color:#666}
.dedication{text-align:center;font-style:italic;padding-top:30%}
.dedication p{text-align:center}
.epigraph{padding-top:28%}
.epigraph blockquote{margin:0 8% 0 18%;font-style:italic}
.epigraph .source{text-align:right;font-style:normal;font-variant:small-caps;margin-top:.6em}
.toc h2,.back-matter h2{font-family:${titleStack};font-weight:400;font-size:1.5em;text-align:center;margin:12% 0 1.5em}
.toc ol{list-style:none;padding:0;margin:0}
.toc li{margin:.35em 0}
.toc .toc-part{font-variant:small-caps;letter-spacing:.1em;margin-top:1em}
.toc a{display:flex;align-items:baseline;color:inherit;text-decoration:none}
.toc .toc-dots{flex:1;border-bottom:1px dotted #999;margin:0 .4em .25em}
.toc a::after{content:target-counter(attr(href url),page)}
.part{text-align:center;padding-top:35%;break-before:right}
.part-label{text-align:center;font-variant:small-caps;letter-spacing:.2em;font-size:.95em}
.part-title{font-family:${titleStack};font-weight:400;font-size:2em;margin:.4em 0 0}
.chapter{page:chapter;break-before:${chapterBreak}}
.first-chapter{counter-reset:page 1}
.chapter-head{padding-top:${sink};margin-bottom:2.6em;hyphens:none}
.running{string-set:chapter content(text);display:none}
.chapter-label{margin:0}
.chapter-head p,.title-page p,.part p{text-align:inherit;hyphens:none}
.chapter-title{font-family:${titleStack};font-weight:400;margin:0}
${CHAPTER_CSS[d.chapterStyle](titleStack, d)}
.chapter-ornament{text-align:center!important;font-size:1.6em;line-height:1;margin:0 0 .5em;color:#555;text-indent:0}
.chapter-body p.first{text-indent:0}
.chapter-body p.first .lead{font-variant:small-caps;letter-spacing:.05em}
.chapter-body p.drop::first-letter{float:left;font-family:${titleStack};font-size:3.6em;line-height:.82;padding:.06em .08em 0 0;margin-top:.04em}
.scene-break{text-align:center!important;text-indent:0!important;margin:1em 0;letter-spacing:.2em;break-after:avoid}
hr.scene-break.line{border:0;border-top:.6pt solid #888;width:22%;margin:1.3em auto}
.scene-break.space{height:1.4em}
.back-matter{page:front}
.back-matter p{margin-bottom:.7em}
ul,ol{margin:.6em 0 .6em 1.4em;padding:0}
`
}

function fontFamily(key: BookDesign['bodyFont'] | Exclude<BookDesign['titleFont'], 'igual'>): string {
  const map: Record<string, string> = {
    literata: 'Literata Book',
    garamond: 'EB Garamond Book',
    crimson: 'Crimson Pro Book',
    lora: 'Lora Book',
    baskerville: 'Libre Baskerville Book',
    mono: 'IBM Plex Mono Book',
    young: 'Young Serif Book',
    cinzel: 'Cinzel Book',
    playfair: 'Playfair Display Book',
    sans: 'Instrument Sans Book',
  }
  return map[key]
}

const CHAPTER_CSS: Record<BookDesign['chapterStyle'], (titleStack: string, d: BookDesign) => string> = {
  classico: () => `
.chapter-head{text-align:center}
.chapter-label{font-variant:small-caps;letter-spacing:.18em;font-size:.95em;margin-bottom:.8em}
.chapter-title{font-size:1.7em;line-height:1.2}
.chapter-orn{width:2.2em;border-top:.6pt solid #777;margin:1.2em auto 0}`,
  moderno: () => `
.chapter-head{text-align:left}
.chapter-label{font-size:3.4em;line-height:1;font-weight:300;margin-bottom:.15em}
.chapter-title{font-size:1.45em;line-height:1.2}
.chapter-orn{width:100%;border-top:.6pt solid #222;margin-top:1em}`,
  minimalista: () => `
.chapter-head{text-align:center}
.chapter-label{font-size:1em;letter-spacing:.1em;margin-bottom:.4em}
.chapter-title{font-size:1.3em;font-style:italic}
.chapter-orn{display:none}`,
  ornamentado: (_t, d) => `
.chapter-head{text-align:center}
.chapter-label{font-variant:small-caps;letter-spacing:.22em;font-size:.95em;margin-bottom:.6em}
.chapter-title{font-size:1.8em;line-height:1.2;letter-spacing:.03em}
.chapter-orn{margin:1em auto 0;width:60%;height:.8em;border-bottom:.6pt solid #888;position:relative}
.chapter-orn::after{content:${d.dividerSymbol.trim() ? cssString(d.dividerSymbol.trim()) : 'none'};position:absolute;left:50%;bottom:-.62em;transform:translateX(-50%);background:#fff;padding:0 .4em;font-size:.8em;color:#666}`,
  manuscrito: () => `
.chapter-head{text-align:center}
.chapter-label{text-transform:uppercase;letter-spacing:.05em;margin-bottom:1em}
.chapter-title{font-size:1em;text-transform:uppercase}
.chapter-orn{display:none}`,
}

/** Estilo de tela da prévia (não sai na impressão): páginas como folhas sobre a mesa. */
export const previewCss = (d: BookDesign) => {
  const w = PAGE_SIZES[d.pageSize].w
  return `
@media screen{
  html,body{background:#d9ddd6}
  body{padding:24px 0}
  .pagedjs_pages{display:flex;flex-wrap:wrap;justify-content:center;gap:28px 0;margin:0 auto}
  .pagedjs_page{background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.18),0 10px 28px -12px rgba(0,0,0,.35)}
  body.spreads .pagedjs_pages{width:calc(${w * 2}mm + 2px);justify-content:flex-start}
  body.spreads .pagedjs_first_page{margin-left:calc(${w}mm + 2px)}
  body.spreads .pagedjs_left_page{box-shadow:inset -10px 0 14px -12px rgba(0,0,0,.35),0 10px 28px -12px rgba(0,0,0,.35)}
  body.spreads .pagedjs_right_page{box-shadow:inset 10px 0 14px -12px rgba(0,0,0,.35),0 10px 28px -12px rgba(0,0,0,.35)}
  body:not(.spreads) .pagedjs_pages{flex-direction:column;align-items:center;gap:22px}
}
@media print{html,body{background:none}}
`
}
