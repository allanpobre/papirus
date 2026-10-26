import { ArrowLeft, ArrowRight, BookOpen, NotebookPen, RotateCcw, SlidersHorizontal, Sparkles, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { MentionMatcher } from '../logic/detection'
import { discoveries, readerBook, readerEntities, readerText, type ReaderEntity, type ReaderItem } from '../logic/reader'
import { kindLabel, kindPlural } from '../model/labels'
import type { Universe } from '../model/schema'
import { byId } from '../model/universe'
import { recall, remember } from '../state/prefs'
import { MiniGraph } from '../ui/MiniGraph'
import { ChapterReactions, type ReactionsApi } from './ChapterReactions'
import { ReadAloudBar, ReadAloudButton, useReadAloud } from './ReadAloud'
import { CommentFab, CommentSheet, useSelectedQuote, type SendComment } from './ReaderComment'

interface DocNode {
  type: string
  text?: string
  marks?: { type: string }[]
  content?: DocNode[]
}

interface Progress {
  current: number
  /** A cena mais longe já lida: o caderno mostra tudo até ela. */
  furthest: number
  /** Onde estava a rolagem dentro da cena atual (px). */
  top?: number
}

/** Aparência da página: só deste aparelho. */
interface Look {
  /** Tamanho da letra, em px. */
  size: number
  tema: 'app' | 'papel' | 'sepia' | 'noite'
  fonte: 'serifa' | 'sem-serifa'
}
const DEFAULT_LOOK: Look = { size: 18, tema: 'app', fonte: 'serifa' }
const TEMA_LABEL: Record<Look['tema'], string> = { app: 'Igual ao app', papel: 'Papel', sepia: 'Sépia', noite: 'Noite' }

function loadLook(): Look {
  try {
    const saved = JSON.parse(recall('leitor-aparencia') ?? 'null') as Partial<Look> | null
    if (saved) return { ...DEFAULT_LOOK, ...saved, size: Math.min(28, Math.max(14, Number(saved.size) || DEFAULT_LOOK.size)) }
  } catch {
    // Preferência ilegível: usa o padrão.
  }
  return DEFAULT_LOOK
}

type Tab = 'quem' | 'descobertas' | 'relacoes' | 'linha'

/** Ajudas de leitura: o leitor escolhe quanto o Papirus aparece. Nada é obrigatório. */
interface Aids {
  /** Nomes no texto abrem a ficha no caderno. */
  nomes: boolean
  /** Ao fim da cena, um quadro com o que entrou no caderno. */
  resumo: boolean
  /** Aviso discreto (+3) quando o caderno ganha algo. */
  novidades: boolean
  /** O caderno existe. Desligado: só o texto. */
  caderno: boolean
}
const PRESETS = {
  texto: { nomes: false, resumo: false, novidades: false, caderno: false },
  discreto: { nomes: true, resumo: false, novidades: true, caderno: true },
  tudo: { nomes: true, resumo: true, novidades: true, caderno: true },
} satisfies Record<string, Aids>
type Preset = keyof typeof PRESETS
const PRESET_LABEL: Record<Preset, string> = { texto: 'Só o texto', discreto: 'Discreto', tudo: 'Com tudo' }
const presetOf = (a: Aids): Preset | null =>
  (Object.keys(PRESETS) as Preset[]).find((k) => (Object.keys(a) as (keyof Aids)[]).every((x) => PRESETS[k][x] === a[x])) ?? null

function loadAids(): Aids {
  try {
    const saved = JSON.parse(recall('leitor-ajudas') ?? 'null') as Partial<Aids> | null
    if (saved) return { ...PRESETS.discreto, ...saved }
  } catch {
    // Preferência ilegível: usa o padrão.
  }
  return PRESETS.discreto
}

/**
 * Modo leitor: o livro cena a cena e, ao lado, o caderno do leitor, que se preenche
 * conforme a leitura (quem apareceu, o que se descobriu), sem spoiler.
 * O progresso fica salvo neste navegador.
 */
export function ReaderView({
  universe,
  storageKey,
  onClose,
  closeLabel = 'Fechar o modo leitor',
  footer,
  onComment,
  commenterName,
  reactions,
}: {
  universe: Universe
  storageKey: string
  onClose?: () => void
  closeLabel?: string
  footer?: ReactNode
  /** Leitor beta: mandar comentários para quem escreveu. */
  onComment?: SendComment
  /** Nome de quem está com conta (sem perguntar). */
  commenterName?: string
  /** Lendo pela estante: reações no fim de cada capítulo. */
  reactions?: ReactionsApi
}) {
  const book = useMemo(() => readerBook(universe), [universe])
  const total = book.scenes.length
  const [progress, setProgress] = useState<Progress>(() => {
    try {
      const saved = JSON.parse(recall(storageKey) ?? 'null') as Progress | null
      if (saved && Number.isInteger(saved.current) && Number.isInteger(saved.furthest)) {
        const last = Math.max(0, total - 1)
        const current = Math.min(saved.current, last)
        return { current, furthest: Math.min(Math.max(saved.furthest, current), last), top: current === saved.current ? Math.max(0, Number(saved.top) || 0) : 0 }
      }
    } catch {
      // Progresso ilegível: começa do início.
    }
    return { current: 0, furthest: 0 }
  })
  const { current, furthest } = progress
  const [tab, setTab] = useState<Tab>('quem')
  const [selected, setSelected] = useState<string | null>(null)
  const [aids, setAidsState] = useState<Aids>(loadAids)
  const setAids = (a: Aids) => {
    setAidsState(a)
    remember('leitor-ajudas', JSON.stringify(a))
    if (!a.caderno) setNotebookOpen(false)
  }
  const [aidsOpen, setAidsOpen] = useState(false)
  // O caderno começa aberto só para quem quer tudo (e tem tela larga); nos outros casos, abre quando pedir.
  const [notebookOpen, setNotebookOpen] = useState(() => presetOf(loadAids()) === 'tudo' && !matchMedia('(max-width: 900px)').matches)
  const [fresh, setFresh] = useState(0)
  const pageRef = useRef<HTMLDivElement>(null)
  const selectedQuote = useSelectedQuote(pageRef, Boolean(onComment))
  const [commenting, setCommenting] = useState<{ quote: string } | null>(null)
  const [look, setLookState] = useState<Look>(loadLook)
  const setLook = (l: Look) => {
    setLookState(l)
    remember('leitor-aparencia', JSON.stringify(l))
  }
  // Voltou no meio de uma cena: leva para onde parou e avisa (some sozinho).
  const [resumed, setResumed] = useState(() => (progress.top ?? 0) > 120)
  useEffect(() => {
    const top = progress.top ?? 0
    if (top > 0) requestAnimationFrame(() => pageRef.current?.scrollTo({ top }))
    const t = setTimeout(() => setResumed(false), 4000)
    return () => clearTimeout(t)
    // Só ao abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const saveScroll = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onScroll = () => {
    if (saveScroll.current) clearTimeout(saveScroll.current)
    saveScroll.current = setTimeout(() => {
      const top = Math.round(pageRef.current?.scrollTop ?? 0)
      setProgress((p) => (p.top === top ? p : { ...p, top }))
    }, 400)
  }

  useEffect(() => {
    remember(storageKey, JSON.stringify(progress))
  }, [storageKey, progress])

  const known = useMemo(() => readerEntities(book, furthest), [book, furthest])
  const knownIds = useMemo(() => new Set(known.map((e) => e.entity.id)), [known])
  const matcher = useMemo(
    () => new MentionMatcher(aids.nomes && aids.caderno ? [...book.entities.values()].filter((e) => knownIds.has(e.id)) : []),
    [book, knownIds, aids.nomes, aids.caderno],
  )
  const found = useMemo(() => discoveries(book, current), [book, current])

  const go = (i: number) => {
    if (i < 0 || i >= total) return
    setProgress((p) => {
      if (i > p.furthest) {
        const d = discoveries(book, i)
        const n = d.entities.length + d.items.length
        if (n) setFresh(n)
      }
      return { current: i, furthest: Math.max(p.furthest, i), top: 0 }
    })
    pageRef.current?.scrollTo({ top: 0 })
  }

  // Ouvir: no fim do capítulo, vai para o próximo (e continua lendo).
  const voice = useReadAloud(pageRef, String(current), () => {
    if (current >= total - 1) return false
    go(current + 1)
    return true
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select, [contenteditable="true"]')) return
      if (e.key === 'ArrowRight') go(current + 1)
      else if (e.key === 'ArrowLeft') go(current - 1)
      else if (e.key === 'Escape' && onClose) onClose()
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  })

  const openCard = (id: string) => {
    setSelected(id)
    setTab('quem')
    setNotebookOpen(true)
    setFresh(0)
    requestAnimationFrame(() => document.getElementById(`leitor-ficha-${id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
  }

  if (!total) {
    return (
      <div className="leitor leitor-empty">
        <BookOpen size={28} aria-hidden="true" />
        <p>Ainda não há cenas para ler em “{universe.name}”.</p>
        {onClose && (
          <button type="button" className="btn" onClick={onClose}>
            {closeLabel}
          </button>
        )}
      </div>
    )
  }

  const scene = book.scenes[current]
  const story = scene.storyId ? byId(universe, 'stories', scene.storyId) : null
  const pct = Math.round(((furthest + 1) / total) * 100)

  return (
    <div
      className={`leitor${notebookOpen ? ' leitor-com-caderno' : ''}`}
      data-tema={look.tema}
      data-fonte={look.fonte}
      style={{ '--leitor-size': `${look.size}px` } as React.CSSProperties}
    >
      <header className="leitor-top">
        {onClose && (
          <button type="button" className="btn-icon" aria-label={closeLabel} title={closeLabel} onClick={onClose}>
            <X size={18} />
          </button>
        )}
        <div className="leitor-where">
          <span className="leitor-book">{universe.name}</span>
          <label className="sr-only" htmlFor="leitor-cena">
            Ir para a cena
          </label>
          <select id="leitor-cena" className="input input-sm leitor-jump" value={current} onChange={(e) => go(Number(e.target.value))}>
            {book.scenes.map((s, i) => (
              <option key={s.id} value={i} disabled={i > furthest + 1}>
                {i + 1}. {i > furthest + 1 ? 'Ainda não lida' : s.title || 'Sem título'}
              </option>
            ))}
          </select>
        </div>
        <div className="leitor-progress" role="progressbar" aria-label="Quanto já leu" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <span style={{ width: `${pct}%` }} />
        </div>
        <ReadAloudButton onStart={voice.start} />
        <div className="leitor-aids-wrap">
          <button type="button" className="btn btn-sm btn-ghost" aria-expanded={aidsOpen} aria-controls="leitor-ajudas" onClick={() => setAidsOpen(!aidsOpen)}>
            <SlidersHorizontal size={15} /> Como ler
          </button>
          {aidsOpen && <AidsPanel aids={aids} onChange={setAids} look={look} onLook={setLook} onClose={() => setAidsOpen(false)} />}
        </div>
        {aids.caderno && (
        <button
          type="button"
          className={`btn btn-sm leitor-caderno-btn${fresh && aids.novidades ? ' has-new' : ''}`}
          aria-expanded={notebookOpen}
          aria-controls="leitor-caderno"
          onClick={() => {
            setNotebookOpen(!notebookOpen)
            setFresh(0)
          }}
        >
          <NotebookPen size={15} /> Caderno
          {fresh > 0 && aids.novidades && (
            <span className="leitor-new-count" aria-label={`${fresh} novidades`}>
              +{fresh}
            </span>
          )}
        </button>
        )}
      </header>

      <div className="leitor-body">
        <div className="leitor-page-wrap" ref={pageRef} onScroll={onScroll}>
          {resumed && (
            <p className="leitor-resumed" role="status">
              Você voltou para onde parou.{' '}
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  pageRef.current?.scrollTo({ top: 0 })
                  setResumed(false)
                }}
              >
                Ir para o começo da cena
              </button>
            </p>
          )}
          <article className="leitor-page" key={scene.id}>
            {story && <p className="leitor-story">{story.title}</p>}
            <h1 className="leitor-title">{scene.title || 'Sem título'}</h1>
            <SceneText doc={scene.doc as DocNode} matcher={matcher} onName={openCard} />

            {aids.caderno && !aids.resumo && aids.novidades && found.entities.length + found.items.length > 0 && (
              <button type="button" className="leitor-found-quiet" onClick={() => { setNotebookOpen(true); setFresh(0) }}>
                <NotebookPen size={13} aria-hidden="true" /> {found.entities.length + found.items.length} {found.entities.length + found.items.length === 1 ? 'anotação nova' : 'anotações novas'} no caderno
              </button>
            )}
            {aids.caderno && aids.resumo && (found.entities.length > 0 || found.items.length > 0) && (
              <section className="leitor-found" aria-label="Novo no caderno">
                <h2>
                  <Sparkles size={15} aria-hidden="true" /> Novo no caderno
                </h2>
                <div className="leitor-found-list">
                  {found.entities.map((e, i) => (
                    <button key={e.id} type="button" className="leitor-found-card is-person" style={{ animationDelay: `${i * 90}ms` }} onClick={() => openCard(e.id)}>
                      <span className="leitor-found-kind">{kindLabel(e.kind)}</span>
                      <strong>{e.name}</strong>
                    </button>
                  ))}
                  {found.items.map((it, i) => (
                    <div key={`${it.kind}-${i}`} className="leitor-found-card" style={{ animationDelay: `${(found.entities.length + i) * 90}ms` }}>
                      <span className="leitor-found-kind">{it.kind === 'trecho' ? `Sobre ${it.tag}` : it.kind === 'relacao' ? 'Ligação' : 'Anotado'}</span>
                      <span>
                        {it.text}
                        {it.kind === 'fato' && it.tag && <em className="muted"> ({it.tag})</em>}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {reactions && <ChapterReactions sceneId={scene.id} api={reactions} />}
            <nav className="leitor-nav" aria-label="Cenas">
              <button type="button" className="btn btn-ghost" disabled={current === 0} onClick={() => go(current - 1)}>
                <ArrowLeft size={16} /> Anterior
              </button>
              <span className="muted small tabular">
                {current + 1} de {total}
              </span>
              {current < total - 1 ? (
                <button type="button" className="btn btn-primary" onClick={() => go(current + 1)}>
                  Próxima cena <ArrowRight size={16} />
                </button>
              ) : (
                <span className="leitor-end">Fim, por enquanto.</span>
              )}
            </nav>
            {onComment && (
              <button type="button" className="link-btn small leitor-comment-scene" onClick={() => setCommenting({ quote: '' })}>
                Comentar só para quem escreveu
              </button>
            )}
            {footer}
          </article>
        </div>

        {notebookOpen && aids.caderno && (
          <Notebook
            known={known}
            book={book}
            furthest={furthest}
            current={current}
            tab={tab}
            setTab={setTab}
            selected={selected}
            setSelected={setSelected}
            onClose={() => setNotebookOpen(false)}
            onRestart={() => {
              setProgress({ current: 0, furthest: 0 })
              setSelected(null)
              pageRef.current?.scrollTo({ top: 0 })
            }}
          />
        )}
      </div>
      <ReadAloudBar voice={voice} />
      {onComment && selectedQuote && !commenting && <CommentFab onClick={() => setCommenting({ quote: selectedQuote })} />}
      {onComment && commenting && (
        <CommentSheet sceneId={scene.id} sceneTitle={scene.title || 'Sem título'} quote={commenting.quote} onSend={onComment} signedName={commenterName} onClose={() => setCommenting(null)} />
      )}
    </div>
  )
}

/** O texto da cena, com os nomes já conhecidos clicáveis. */
function SceneText({ doc, matcher, onName }: { doc: DocNode; matcher: MentionMatcher; onName: (id: string) => void }) {
  const inline = (n: DocNode, key: string): ReactNode => {
    if (n.type === 'text') {
      const text = n.text ?? ''
      const parts: ReactNode[] = []
      let last = 0
      for (const m of matcher.find(text)) {
        if (m.from < last) continue
        if (m.from > last) parts.push(text.slice(last, m.from))
        parts.push(
          <button key={`${key}-${m.from}`} type="button" className="leitor-name" onClick={() => onName(m.entityId)}>
            {text.slice(m.from, m.to)}
          </button>,
        )
        last = m.to
      }
      if (last < text.length) parts.push(text.slice(last))
      let node: ReactNode = <>{parts}</>
      for (const mk of n.marks ?? []) {
        if (mk.type === 'bold') node = <strong>{node}</strong>
        else if (mk.type === 'italic') node = <em>{node}</em>
        else if (mk.type === 'strike') node = <s>{node}</s>
      }
      return <span key={key}>{node}</span>
    }
    if (n.type === 'hardBreak') return <br key={key} />
    return <span key={key}>{(n.content ?? []).map((c, i) => inline(c, `${key}-${i}`))}</span>
  }
  return (
    <div className="leitor-text">
      {(doc.content ?? []).map((n, i) => {
        if (n.type === 'horizontalRule')
          return (
            <p key={i} className="leitor-sep" aria-hidden="true">
              ⁂
            </p>
          )
        if (n.type === 'blockquote') return <blockquote key={i}>{(n.content ?? []).map((c, j) => <p key={j}>{inline(c, `${i}-${j}`)}</p>)}</blockquote>
        if (!(n.content ?? []).length) return null
        if (n.type === 'heading') return <h2 key={i}>{inline(n, `${i}`)}</h2>
        return <p key={i}>{inline(n, `${i}`)}</p>
      })}
    </div>
  )
}

function Notebook({
  known,
  book,
  furthest,
  current,
  tab,
  setTab,
  selected,
  setSelected,
  onClose,
  onRestart,
}: {
  known: ReaderEntity[]
  book: ReturnType<typeof readerBook>
  furthest: number
  current: number
  tab: Tab
  setTab: (t: Tab) => void
  selected: string | null
  setSelected: (id: string | null) => void
  onClose: () => void
  onRestart: () => void
}) {
  const [query, setQuery] = useState('')
  const [confirmRestart, setConfirmRestart] = useState(false)
  const facts = book.facts.filter((f) => f.at <= furthest)
  const relations = book.relations.filter((r) => r.at <= furthest)
  const events = book.events.filter((e) => e.at <= furthest)
  const passages = useMemo(() => {
    const out: ReaderItem[] = []
    for (let i = 0; i <= furthest; i++) out.push(...discoveries(book, i).items.filter((x) => x.kind === 'trecho'))
    return out
  }, [book, furthest])
  const timeline = [...passages, ...facts].sort((a, b) => a.at - b.at)
  const q = query.trim().toLowerCase()
  const shown = q ? known.filter((e) => [e.entity.name, ...e.entity.aliases, e.summary].some((t) => t.toLowerCase().includes(q))) : known
  const kinds = [...new Set(shown.map((e) => e.entity.kind))]

  return (
    <aside id="leitor-caderno" className="leitor-caderno" aria-label="Caderno do leitor">
      <div className="leitor-caderno-head">
        <h2>Caderno</h2>
        <span className="muted tiny">Só o que você já leu</span>
        <button type="button" className="btn-icon btn-sm" aria-label="Fechar o caderno" onClick={onClose}>
          <X size={15} />
        </button>
      </div>
      <div className="segmented leitor-tabs" role="tablist" aria-label="Partes do caderno">
        {(
          [
            ['quem', `Quem é quem (${known.length})`],
            ['descobertas', `Descobertas (${timeline.length})`],
            ['relacoes', `Ligações (${relations.length})`],
            ['linha', `Linha do tempo (${events.length})`],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
            {label}
          </button>
        ))}
      </div>

      <div className="leitor-caderno-body">
        {tab === 'quem' && (
          <>
            {known.length > 4 && <input className="input input-sm" data-livre aria-label="Procurar no caderno" placeholder="Procurar…" value={query} onChange={(e) => setQuery(e.target.value)} />}
            {!known.length && <p className="muted small">Ninguém ainda. Conforme você lê, quem aparece entra aqui.</p>}
            {kinds.map((k) => (
              <section key={k} className="leitor-kind">
                <h3>{kindPlural(k)}</h3>
                {shown
                  .filter((e) => e.entity.kind === k)
                  .map((e) => {
                    const open = selected === e.entity.id
                    const about = [...facts, ...relations].filter((x) => x.entityIds.includes(e.entity.id))
                    return (
                      <div key={e.entity.id} id={`leitor-ficha-${e.entity.id}`} className={`leitor-card${open ? ' is-open' : ''}${e.first === current ? ' is-new' : ''}`}>
                        <button type="button" className="leitor-card-head" aria-expanded={open} onClick={() => setSelected(open ? null : e.entity.id)}>
                          <strong>{e.entity.name}</strong>
                          {e.first === current && <span className="leitor-badge">novo</span>}
                          <span className="muted tiny">cena {e.first + 1}</span>
                        </button>
                        {e.summary && <p className="small">{e.summary}</p>}
                        {open && (
                          <div className="leitor-card-more">
                            {e.description && <p className="small leitor-desc">{e.description}</p>}
                            {e.fields.length > 0 && (
                              <dl className="leitor-fields">
                                {e.fields.map((f) => (
                                  <div key={f.key}>
                                    <dt>{f.key}</dt>
                                    <dd>{f.value}</dd>
                                  </div>
                                ))}
                              </dl>
                            )}
                            {about.length > 0 && (
                              <ul className="leitor-about">
                                {about.map((x, i) => (
                                  <li key={i}>
                                    {x.text}
                                    {x.kind === 'fato' && x.tag && <em className="muted"> ({x.tag})</em>}
                                  </li>
                                ))}
                              </ul>
                            )}
                            {!e.description && !e.fields.length && !about.length && <p className="muted tiny">Por enquanto, só isso.</p>}
                          </div>
                        )}
                      </div>
                    )
                  })}
              </section>
            ))}
          </>
        )}

        {tab === 'descobertas' &&
          (timeline.length ? (
            <ol className="leitor-timeline">
              {timeline.map((x, i) => (
                <li key={i}>
                  <span className="muted tiny">
                    Cena {x.at + 1}
                    {x.kind === 'trecho' && ` · sobre ${x.tag}`}
                  </span>
                  <span className="small">
                    {x.text}
                    {x.kind === 'fato' && x.tag && <em className="muted"> ({x.tag})</em>}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted small">Nada descoberto ainda. Continue lendo.</p>
          ))}

        {tab === 'linha' &&
          (events.length ? (
            <ol className="leitor-timeline leitor-years">
              {events.map((ev) => {
                const text = readerText(ev.description, furthest, book.scenes)
                return (
                  <li key={ev.id} className={ev.at === current ? 'is-new' : undefined}>
                    <span className="leitor-year tabular">{ev.when}</span>
                    <span className="small">
                      <strong>{ev.title}</strong>
                      {text && <span className="muted"> — {text}</span>}
                    </span>
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className="muted small">Nenhum acontecimento ainda. Eles entram quando quem participou deles aparece na história.</p>
          ))}

        {tab === 'relacoes' && relations.length > 1 && (() => {
          const linked = new Set(relations.flatMap((r) => r.entityIds))
          return (
            <MiniGraph
              nodes={known.filter((e) => linked.has(e.entity.id)).map((e) => ({ id: e.entity.id, label: e.entity.name, isNew: e.first === current }))}
              edges={relations.map((r) => ({ from: r.entityIds[0], to: r.entityIds[1], isNew: r.at === current }))}
              onPick={(id) => {
                setSelected(id)
                setTab('quem')
              }}
            />
          )
        })()}
        {tab === 'relacoes' &&
          (relations.length ? (
            <ul className="leitor-timeline">
              {relations.map((r, i) => (
                <li key={i}>
                  <span className="muted tiny">desde a cena {r.at + 1}</span>
                  <span className="small">{r.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">Nenhuma ligação ainda.</p>
          ))}
      </div>

      <div className="leitor-caderno-foot">
        {confirmRestart ? (
          <>
            <span className="tiny">Começar do zero? O caderno se esvazia.</span>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setConfirmRestart(false)
                onRestart()
              }}
            >
              Recomeçar
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirmRestart(false)}>
              Cancelar
            </button>
          </>
        ) : (
          <button type="button" className="link-btn tiny" onClick={() => setConfirmRestart(true)}>
            <RotateCcw size={12} /> Ler de novo do começo
          </button>
        )}
      </div>
    </aside>
  )
}

/** "Como ler": quanto o Papirus aparece durante a leitura. */
function AidsPanel({ aids, onChange, look, onLook, onClose }: { aids: Aids; onChange: (a: Aids) => void; look: Look; onLook: (l: Look) => void; onClose: () => void }) {
  const preset = presetOf(aids)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const onDown = (e: PointerEvent) => !(e.target as HTMLElement).closest('.leitor-aids-wrap') && onClose()
    addEventListener('keydown', onKey)
    addEventListener('pointerdown', onDown)
    return () => {
      removeEventListener('keydown', onKey)
      removeEventListener('pointerdown', onDown)
    }
  }, [onClose])
  const toggle = (k: keyof Aids, label: string, hint: string) => (
    <label className="check leitor-aid">
      <input type="checkbox" checked={aids[k]} disabled={k !== 'caderno' && !aids.caderno} onChange={(e) => onChange({ ...aids, [k]: e.target.checked })} />
      <span>
        {label}
        <span className="muted tiny">{hint}</span>
      </span>
    </label>
  )
  return (
    <div id="leitor-ajudas" className="leitor-aids" role="group" aria-label="Como ler">
      <div className="leitor-look">
        <span className="field-label">Letra</span>
        <div className="leitor-size">
          <button type="button" className="btn btn-sm btn-ghost" aria-label="Letra menor" disabled={look.size <= 14} onClick={() => onLook({ ...look, size: look.size - 1 })}>
            A−
          </button>
          <span className="tabular small" aria-live="polite">
            {look.size}px
          </span>
          <button type="button" className="btn btn-sm btn-ghost" aria-label="Letra maior" disabled={look.size >= 28} onClick={() => onLook({ ...look, size: look.size + 1 })}>
            A+
          </button>
        </div>
        <div className="segmented" role="radiogroup" aria-label="Fonte do texto">
          <button type="button" role="radio" aria-checked={look.fonte === 'serifa'} className="leitor-font-serifa" onClick={() => onLook({ ...look, fonte: 'serifa' })}>
            Com serifa
          </button>
          <button type="button" role="radio" aria-checked={look.fonte === 'sem-serifa'} className="leitor-font-sem" onClick={() => onLook({ ...look, fonte: 'sem-serifa' })}>
            Sem serifa
          </button>
        </div>
        <span className="field-label">Página</span>
        <div className="leitor-temas" role="radiogroup" aria-label="Cor da página">
          {(Object.keys(TEMA_LABEL) as Look['tema'][]).map((t) => (
            <button key={t} type="button" role="radio" aria-checked={look.tema === t} className={`leitor-tema leitor-tema-${t}`} onClick={() => onLook({ ...look, tema: t })}>
              <span className="leitor-tema-swatch" aria-hidden="true" />
              {TEMA_LABEL[t]}
            </button>
          ))}
        </div>
      </div>
      <span className="field-label">Ajudas</span>
      <div className="segmented" role="radiogroup" aria-label="Ajudas de leitura">
        {(Object.keys(PRESETS) as Preset[]).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={preset === k} onClick={() => onChange(PRESETS[k])}>
            {PRESET_LABEL[k]}
          </button>
        ))}
      </div>
      {toggle('caderno', 'Caderno do leitor', 'Quem é quem, o que já se sabe, ligações e linha do tempo, só até onde você leu.')}
      {toggle('nomes', 'Nomes no texto abrem o caderno', 'Os nomes ganham um sublinhado leve.')}
      {toggle('novidades', 'Avisar quando o caderno ganha algo', 'Um “+2” no botão do caderno, sem interromper.')}
      {toggle('resumo', 'Quadro ao fim de cada cena', 'Mostra o que entrou no caderno com aquela cena.')}
    </div>
  )
}
