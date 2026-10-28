import { BookOpen, Columns2, Download, FileText, ImagePlus, Minus, Plus, Printer, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import polyfill from '../../node_modules/pagedjs/dist/paged.polyfill.min.js?raw'
import { downloadText, fileNameFor } from '../export/download'
import { BOOK_PRESETS, PAGE_SIZES, bookTitle, buildBook, defaultDesign, fontsOf, previewCss } from '../export/bookDesign'
import { BOOK_FONTS, fontFaces } from '../export/bookFonts'
import { shelf, styleOf, updateBook } from '../export/shelf'
import { downloadEpub } from './epubDownload'
import { prepareBookImages } from '../images/bookImages'
import { useBackLayer } from '../ui/useBackLayer'
import type { BookDesign } from '../model/schema'
import { useWorkspace } from '../state/workspace'
import { Field, Select } from '../ui/bits'

type Key = keyof BookDesign

const CHAPTER_STYLES: { value: BookDesign['chapterStyle']; label: string; hint: string }[] = [
  { value: 'classico', label: 'Clássico', hint: 'Centralizado, rótulo em versalete, filete fino.' },
  { value: 'moderno', label: 'Moderno', hint: 'Número grande à esquerda, linha abaixo.' },
  { value: 'minimalista', label: 'Minimalista', hint: 'Só o essencial, título em itálico.' },
  { value: 'ornamentado', label: 'Ornamentado', hint: 'Ornamento ❦ e floreio sob o título.' },
  { value: 'manuscrito', label: 'Manuscrito', hint: 'Sem enfeites, em maiúsculas.' },
]
const LABELS: { value: BookDesign['chapterLabel']; label: string }[] = [
  { value: 'capitulo-numero', label: 'Capítulo 1' },
  { value: 'capitulo-extenso', label: 'Capítulo Um' },
  { value: 'numero', label: '1' },
  { value: 'romano', label: 'I' },
  { value: 'nenhum', label: 'Sem número' },
]
const BREAKS: { value: BookDesign['sceneBreak']; label: string }[] = [
  { value: 'asterismo', label: '⁂' },
  { value: 'asteriscos', label: '* * *' },
  { value: 'floral', label: '❦' },
  { value: 'traco', label: '—' },
  { value: 'linha', label: 'Linha' },
  { value: 'espaco', label: 'Espaço' },
  { value: 'simbolo', label: 'Outro símbolo…' },
]

/** Símbolos para ornamentos e quebras de cena. Dá para digitar qualquer outro. */
const SYMBOLS = ['❦', '❧', '☙', '⁂', '✦', '✧', '❖', '◆', '◇', '✶', '✷', '✺', '❂', '❁', '✿', '❀', '⚜', '✠', '☽', '☾', '★', '☆', '✥', '※', '⁕', '§', '⸙', '•', '• • •', '~ ~ ~', '— ✦ —', '❧ ❦ ☙']
const BODY: { value: BookDesign['bodyFont']; key: keyof typeof BOOK_FONTS }[] = [
  { value: 'garamond', key: 'garamond' },
  { value: 'crimson', key: 'crimson' },
  { value: 'lora', key: 'lora' },
  { value: 'baskerville', key: 'baskerville' },
  { value: 'literata', key: 'literata' },
  { value: 'mono', key: 'mono' },
]
const TITLE: { value: BookDesign['titleFont']; label: string }[] = [
  { value: 'igual', label: 'A mesma do texto' },
  { value: 'cinzel', label: 'Cinzel (épica, em capitais)' },
  { value: 'playfair', label: 'Playfair Display (elegante)' },
  { value: 'young', label: 'Young Serif (marcante)' },
  { value: 'garamond', label: 'EB Garamond' },
  { value: 'sans', label: 'Instrument Sans (sem serifa)' },
]

/** Diminui a imagem da capa (fotos de celular são enormes) e devolve como data URL. */
async function readCover(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const max = 2400
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * k)
    canvas.height = Math.round(img.naturalHeight * k)
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.9)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** O documento que o Paged.js pagina: na prévia e no arquivo para imprimir. */
function bookDocument(title: string, html: string, css: string, fonts: string, preview: string, spreads: boolean): string {
  const script = polyfill.replace(/<\/script/gi, '<\\/script')
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${title.replace(/</g, '&lt;')}</title>
<style data-pagedjs-ignore>${fonts}</style>
<style>${css}</style>
<style data-pagedjs-ignore>${preview}</style>
<script>window.PagedConfig={auto:true,after:function(flow){try{parent.postMessage({papirusPaged:flow.total},'*')}catch(e){}}}</script>
<script>${script}</script>
</head><body class="${spreads ? 'spreads' : ''}">${html}</body></html>`
}

/**
 * Diagramar o livro: o autor escolhe a capa, o Papirus monta o miolo. Prévia página
 * por página, e o PDF sai pela impressão do navegador ("Salvar como PDF").
 */
export default function BookDesigner({ bookId, onClose }: { bookId: string; onClose: () => void }) {
  const { universe, update, toast } = useWorkspace()
  useBackLayer(onClose)
  // O livro da estante (um objeto estável, para não paginar de novo a cada desenho).
  const books = useMemo(() => shelf(universe), [universe.books, universe.book]) // eslint-disable-line react-hooks/exhaustive-deps
  const record = books.find((b) => b.id === bookId)
  const design = useMemo(() => record ?? defaultDesign(), [record])
  const others = books.filter((b) => b.id !== bookId)
  const set = (changes: Partial<BookDesign>) => update((u) => updateBook(u, bookId, changes))
  // O livro foi apagado (por aqui ou por outra pessoa): fecha.
  useEffect(() => {
    if (!record) onClose()
  }, [record, onClose])

  // Imagens das cenas: preparadas antes de montar (o livro é montado de uma vez).
  const [imagesReady, setImagesReady] = useState(0)
  useEffect(() => {
    let off = false
    void prepareBookImages(universe).then(() => !off && setImagesReady((n) => n + 1))
    return () => {
      off = true
    }
  }, [universe])
  const book = useMemo(() => buildBook(universe, design), [universe, design, imagesReady]) // eslint-disable-line react-hooks/exhaustive-deps
  const fonts = useMemo(() => fontFaces(fontsOf(design)), [design])
  const [spreads, setSpreads] = useState(() => !matchMedia('(max-width: 900px)').matches)
  const [zoom, setZoom] = useState(() => (matchMedia('(max-width: 900px)').matches ? 0.6 : 0.8))
  const [pages, setPages] = useState<number | null>(null)
  const [doc, setDoc] = useState('')
  const frame = useRef<HTMLIFrameElement>(null)
  const coverInput = useRef<HTMLInputElement>(null)
  const backInput = useRef<HTMLInputElement>(null)
  const [panelOpen, setPanelOpen] = useState(true)
  const [thisYear] = useState(() => String(new Date().getFullYear()))

  // Pagina de novo com uma pausa depois de cada mudança (paginar um livro leva um instante).
  useEffect(() => {
    const t = setTimeout(() => {
      setPages(null)
      setDoc(bookDocument(book.title, book.html, book.css, fonts, previewCss(design), spreads))
    }, 500)
    return () => clearTimeout(t)
  }, [book, fonts, spreads, design])

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source === frame.current?.contentWindow && typeof e.data?.papirusPaged === 'number') setPages(e.data.papirusPaged)
    }
    addEventListener('message', onMessage)
    return () => removeEventListener('message', onMessage)
  }, [])

  // Cabe na tela: depois de paginar, ajusta o zoom para mostrar a página (ou o par) inteiro.
  const [autoFit, setAutoFit] = useState(true)
  const pageWidthPx = PAGE_SIZES[design.pageSize].w * 3.7795
  useEffect(() => {
    if (!autoFit || pages === null || !frame.current) return
    const room = frame.current.clientWidth - 56
    setZoom(Math.max(0.3, Math.min(1.2, +(room / (pageWidthPx * (spreads ? 2 : 1))).toFixed(2))))
  }, [autoFit, pages, spreads, pageWidthPx])
  useEffect(() => {
    frame.current?.contentDocument?.body?.style.setProperty('zoom', String(zoom))
  }, [zoom, pages])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [onClose])

  const print = () => {
    const w = frame.current?.contentWindow
    try {
      if (!w || pages === null) throw new Error('ainda paginando')
      w.focus()
      w.print()
    } catch {
      toast('Não deu para abrir a impressão aqui. Use “Baixar para imprimir” e abra o arquivo no navegador.', { tone: 'erro' })
    }
  }

  const download = () => {
    downloadText(fileNameFor(book.title, 'html'), bookDocument(book.title, book.html, book.css, fonts, previewCss(design), false), 'text/html')
    toast('Abra o arquivo no navegador (Chrome ou Edge) e use Imprimir → Salvar como PDF.')
  }

  const cover = (which: 'cover' | 'backCover') => async (file: File | undefined) => {
    if (!file) return
    try {
      set({ [which]: await readCover(file) })
    } catch {
      toast('Não foi possível abrir essa imagem.', { tone: 'erro' })
    }
  }

  const text = (k: Key, label: string, opts: { area?: boolean; placeholder?: string; hint?: string } = {}) => (
    <Field label={label} hint={opts.hint} wide={opts.area}>
      {(id) =>
        opts.area ? (
          <textarea id={id} className="input textarea" rows={3} value={design[k] as string} placeholder={opts.placeholder} onChange={(e) => set({ [k]: e.target.value })} />
        ) : (
          <input id={id} className="input" value={design[k] as string} placeholder={opts.placeholder} onChange={(e) => set({ [k]: e.target.value })} />
        )
      }
    </Field>
  )
  const toggle = (k: Key, label: string) => (
    <label className="toggle">
      <input type="checkbox" role="switch" checked={design[k] as boolean} onChange={(e) => set({ [k]: e.target.checked })} />
      <span className="toggle-track" aria-hidden="true" />
      <span>{label}</span>
    </label>
  )
  const choices = <K extends Key>(k: K, label: string, options: { value: BookDesign[K]; label: string; hint?: string }[], cls = '') => (
    <div className={`book-choices ${cls}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={design[k] === o.value} title={o.hint} onClick={() => set({ [k]: o.value } as Partial<BookDesign>)}>
          <span>{o.label}</span>
          {o.hint && <span className="muted tiny">{o.hint}</span>}
        </button>
      ))}
    </div>
  )

  const allStories = universe.stories
  const chosen = design.storyIds.length ? design.storyIds : allStories.map((s) => s.id)

  return (
    <div className="book-designer" role="dialog" aria-modal="true" aria-label="Diagramar o livro">
      <header className="book-top">
        <button type="button" className="btn-icon" aria-label="Fechar" title="Fechar" onClick={onClose}>
          <X size={18} />
        </button>
        <div className="book-top-title">
          <strong>Diagramar: {book.title}</strong>
          <span className="muted tiny">
            {book.chapters} {book.chapters === 1 ? 'capítulo' : 'capítulos'} · {book.words.toLocaleString('pt-BR')} palavras ·{' '}
            {pages === null ? 'paginando…' : `${pages} páginas`}
          </span>
        </div>
        <button type="button" className="btn btn-sm btn-ghost book-panel-toggle" aria-expanded={panelOpen} onClick={() => setPanelOpen(!panelOpen)}>
          {panelOpen ? 'Ver páginas' : 'Opções'}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          title="E-book com a mesma capa, fontes e estilo (Kindle, Kobo, Apple Livros, Google Play Livros)"
          onClick={() => void downloadEpub(universe, design).then(() => toast('E-book baixado. No Kindle, use “Enviar para o Kindle” com o arquivo EPUB.'))}
        >
          <BookOpen size={15} /> E-book (EPUB)
        </button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={download} title="Arquivo com o livro pronto: abra no navegador e imprima em PDF">
          <Download size={15} /> Baixar para imprimir
        </button>
        <button type="button" className="btn btn-sm btn-primary" disabled={pages === null} onClick={print}>
          <Printer size={15} /> Imprimir ou salvar PDF
        </button>
      </header>

      <div className={`book-body${panelOpen ? ' panel-open' : ''}`}>
        <aside className="book-panel" aria-label="Opções do livro">
          <Section title="Modelo" open>
            <p className="muted tiny">Um ponto de partida. Depois, mude o que quiser.</p>
            {others.length > 0 && (
              <div className="book-presets">
                {others.map((o) => (
                  <button key={o.id} type="button" className="book-preset book-preset-series" onClick={() => set(styleOf(o))}>
                    <strong>Mesmo estilo de “{bookTitle(universe, o)}”</strong>
                    <span className="muted tiny">Fontes, capítulos, margens e símbolos iguais; título, capa e histórias ficam.</span>
                  </button>
                ))}
              </div>
            )}
            <div className="book-presets">
              {Object.entries(BOOK_PRESETS).map(([k, p]) => (
                <button key={k} type="button" className="book-preset" onClick={() => set(p.design)}>
                  <strong>{p.label}</strong>
                  <span className="muted tiny">{p.hint}</span>
                </button>
              ))}
            </div>
          </Section>

          <Section title="Capa" open>
            <p className="muted tiny">
              A capa é sua: envie a imagem pronta ({PAGE_SIZES[design.pageSize].label.replace(/ \(.*/, '')}, em pé). Ela ocupa a página inteira, sem margens.
            </p>
            <div className="book-covers">
              {(['cover', 'backCover'] as const).map((which) => (
                <div key={which} className="book-cover-slot">
                  <span className="field-label">{which === 'cover' ? 'Capa' : 'Contracapa (opcional)'}</span>
                  {design[which] ? (
                    <>
                      <img src={design[which]!} alt={which === 'cover' ? 'Capa escolhida' : 'Contracapa escolhida'} />
                      <button type="button" className="btn btn-ghost btn-xs" onClick={() => set({ [which]: null })}>
                        <Trash2 size={13} /> Tirar
                      </button>
                    </>
                  ) : (
                    <button type="button" className="book-cover-empty" onClick={() => (which === 'cover' ? coverInput : backInput).current?.click()}>
                      <ImagePlus size={20} aria-hidden="true" />
                      <span>Escolher imagem</span>
                    </button>
                  )}
                </div>
              ))}
              <input ref={coverInput} type="file" accept="image/*" hidden aria-label="Imagem da capa" onChange={(e) => void cover('cover')(e.target.files?.[0]).then(() => (e.target.value = ''))} />
              <input ref={backInput} type="file" accept="image/*" hidden aria-label="Imagem da contracapa" onChange={(e) => void cover('backCover')(e.target.files?.[0]).then(() => (e.target.value = ''))} />
            </div>
          </Section>

          <Section title="O que entra">
            {allStories.length > 0 && (
              <div className="book-stories">
                {allStories.map((s) => (
                  <label key={s.id} className="check">
                    <input
                      type="checkbox"
                      checked={chosen.includes(s.id)}
                      onChange={(e) => {
                        const next = e.target.checked ? allStories.filter((x) => chosen.includes(x.id) || x.id === s.id).map((x) => x.id) : chosen.filter((x) => x !== s.id)
                        set({ storyIds: next.length === allStories.length ? [] : next })
                      }}
                    />{' '}
                    {s.title || 'Sem título'}
                  </label>
                ))}
              </div>
            )}
            <Field label="Capítulos">
              {(id) => (
                <Select
                  id={id}
                  value={design.chapterUnit}
                  onChange={(v) => set({ chapterUnit: v })}
                  options={[
                    { value: 'cena', label: 'Cada cena é um capítulo' },
                    { value: 'historia', label: 'Cada história é um capítulo (cenas separadas por quebra)' },
                  ]}
                />
              )}
            </Field>
            {toggle('toc', 'Sumário com números de página')}
            {toggle('parts', 'Com mais de uma história: cada uma abre uma "Parte"')}
          </Section>

          <Section title="Folha de rosto e textos">
            {text('title', 'Título', { placeholder: book.title })}
            {text('subtitle', 'Subtítulo')}
            {text('author', 'Autoria', { placeholder: 'Seu nome ou pseudônimo' })}
            {text('publisher', 'Editora ou selo', { placeholder: 'Opcional' })}
            {text('year', 'Ano', { placeholder: thisYear })}
            {text('dedication', 'Dedicatória', { area: true, placeholder: 'Para…' })}
            {text('epigraph', 'Epígrafe', { area: true })}
            {text('epigraphSource', 'Autor da epígrafe')}
            {text('copyright', 'Direitos autorais', { area: true, placeholder: '© ano Autoria. Todos os direitos reservados.', hint: 'Vazio = texto padrão com o seu nome.' })}
            {text('acknowledgments', 'Agradecimentos (no fim)', { area: true })}
            {text('aboutAuthor', 'Sobre a autoria (no fim)', { area: true })}
          </Section>

          <Section title="Página">
            <Field label="Tamanho">
              {(id) => <Select id={id} value={design.pageSize} onChange={(v) => set({ pageSize: v })} options={Object.entries(PAGE_SIZES).map(([v, s]) => ({ value: v as BookDesign['pageSize'], label: s.label }))} />}
            </Field>
            {choices('margins', 'Margens', [
              { value: 'estreitas', label: 'Estreitas' },
              { value: 'normais', label: 'Normais' },
              { value: 'largas', label: 'Largas' },
            ])}
            {toggle('mirrored', 'Margens espelhadas (mais espaço do lado da lombada)')}
          </Section>

          <Section title="Texto">
            <div className="book-choices book-fonts" role="radiogroup" aria-label="Fonte do texto">
              {BODY.map((f) => (
                <button key={f.value} type="button" role="radio" aria-checked={design.bodyFont === f.value} style={{ fontFamily: `"${BOOK_FONTS[f.key].family}", serif` }} onClick={() => set({ bodyFont: f.value })}>
                  {BOOK_FONTS[f.key].label}
                </button>
              ))}
            </div>
            <Range label="Tamanho da letra" min={9} max={13} step={0.5} value={design.fontSize} unit=" pt" onChange={(v) => set({ fontSize: v })} />
            <Range label="Entrelinha" min={1.2} max={2} step={0.05} value={design.lineHeight} onChange={(v) => set({ lineHeight: v })} />
            {choices('paragraph', 'Parágrafos', [
              { value: 'recuo', label: 'Com recuo (livro)' },
              { value: 'espaco', label: 'Com espaço entre eles' },
            ])}
            {toggle('justify', 'Justificar')}
            {toggle('hyphenate', 'Hifenizar (separar sílabas no fim da linha)')}
          </Section>

          <Section title="Capítulos">
            {choices('chapterStyle', 'Estilo do início de capítulo', CHAPTER_STYLES, 'book-choices-wide')}
            {choices('chapterLabel', 'Número', LABELS)}
            {toggle('chapterTitles', 'Mostrar o título da cena')}
            <Field label="Fonte dos títulos">{(id) => <Select id={id} value={design.titleFont} onChange={(v) => set({ titleFont: v })} options={TITLE} />}</Field>
            <SymbolPicker label="Ornamento acima do capítulo" value={design.ornament} allowNone onChange={(v) => set({ ornament: v })} />
            {design.chapterStyle === 'ornamentado' && (
              <SymbolPicker label="Símbolo no floreio sob o título" value={design.dividerSymbol} allowNone onChange={(v) => set({ dividerSymbol: v })} />
            )}
            {toggle('chapterRecto', 'Todo capítulo começa numa página da direita')}
            {toggle('dropCap', 'Letra capitular (primeira letra grande)')}
            {toggle('smallCapsLead', 'Primeiras palavras em versalete')}
          </Section>

          <Section title="Quebra de cena">
            {choices('sceneBreak', 'Quebra de cena', BREAKS)}
            {design.sceneBreak === 'simbolo' && <SymbolPicker label="Símbolo da quebra de cena" value={design.sceneBreakSymbol} onChange={(v) => set({ sceneBreakSymbol: v })} />}
          </Section>

          <Section title="Cabeçalho e números">
            {choices('header', 'Cabeçalho', [
              { value: 'titulo-autor', label: 'Autoria / título' },
              { value: 'titulo-capitulo', label: 'Título / capítulo' },
              { value: 'nada', label: 'Nenhum' },
            ])}
            {choices('pageNumbers', 'Número da página', [
              { value: 'rodape-centro', label: 'Embaixo, no meio' },
              { value: 'rodape-externo', label: 'Embaixo, no canto' },
              { value: 'topo-externo', label: 'Em cima, no canto' },
              { value: 'nenhum', label: 'Sem número' },
            ])}
          </Section>
          <p className="muted tiny book-note">
            <FileText size={12} aria-hidden="true" /> Só o texto das cenas entra: comentários, notas e segredos das fichas ficam no Papirus.
          </p>
        </aside>

        <main className="book-preview">
          <div className="book-preview-bar">
            <button type="button" className="btn-icon btn-sm" aria-label="Diminuir" onClick={() => {
                setAutoFit(false)
                setZoom((z) => Math.max(0.3, +(z - 0.1).toFixed(2)))
              }}>
              <Minus size={14} />
            </button>
            <span className="tabular small">{Math.round(zoom * 100)}%</span>
            <button type="button" className="btn-icon btn-sm" aria-label="Aumentar" onClick={() => {
                setAutoFit(false)
                setZoom((z) => Math.min(1.6, +(z + 0.1).toFixed(2)))
              }}>
              <Plus size={14} />
            </button>
            <button type="button" className="btn btn-xs btn-ghost" aria-pressed={autoFit} onClick={() => setAutoFit(true)}>
              Caber na tela
            </button>
            <button type="button" className="btn btn-xs btn-ghost" aria-pressed={spreads} onClick={() => setSpreads(!spreads)}>
              {spreads ? <Columns2 size={14} /> : <BookOpen size={14} />} {spreads ? 'Lado a lado' : 'Uma por vez'}
            </button>
          </div>
          {book.chapters === 0 ? (
            <p className="muted book-empty">Ainda não há cenas com texto para diagramar.</p>
          ) : (
            <iframe ref={frame} title="Prévia do livro" className="book-frame" srcDoc={doc} />
          )}
        </main>
      </div>
    </div>
  )
}

function Section({ title, open, children }: { title: string; open?: boolean; children: ReactNode }) {
  return (
    <details className="book-section" open={open}>
      <summary>{title}</summary>
      <div className="book-section-body">{children}</div>
    </details>
  )
}

function Range({ label, min, max, step, value, unit = '', onChange }: { label: string; min: number; max: number; step: number; value: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <label className="book-range">
      <span className="field-label">
        {label} <span className="tabular muted">{value.toLocaleString('pt-BR')}{unit}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

/** Escolher um símbolo da galeria, ou digitar outro (qualquer caractere, até emoji). */
function SymbolPicker({ label, value, onChange, allowNone }: { label: string; value: string; onChange: (v: string) => void; allowNone?: boolean }) {
  const custom = value && !SYMBOLS.includes(value)
  return (
    <div className="book-symbols" role="group" aria-label={label}>
      <span className="field-label">{label}</span>
      <div className="book-symbol-grid" role="radiogroup" aria-label={label}>
        {allowNone && (
          <button type="button" role="radio" aria-checked={!value} className="book-symbol-none" onClick={() => onChange('')}>
            Nenhum
          </button>
        )}
        {SYMBOLS.map((s) => (
          <button key={s} type="button" role="radio" aria-checked={value === s} aria-label={s} className={[...s].length > 2 ? 'book-symbol-wide' : undefined} onClick={() => onChange(s)}>
            {s}
          </button>
        ))}
      </div>
      <label className="book-symbol-custom">
        <span className="muted tiny">Outro:</span>
        <input className="input input-sm" maxLength={12} value={custom ? value : ''} placeholder="digite ou cole" aria-label={`${label}: outro símbolo`} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  )
}
