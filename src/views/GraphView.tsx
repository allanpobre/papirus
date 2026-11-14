import { bookScope } from '../logic/bookScope'
import { isLead, nodeRadius, roleIn } from '../logic/roles'
import { FamilyTree } from './FamilyTree'
import { familyLinks } from '../logic/family'
import { Maximize, Minus, Network, Pause, Play, Plus, Search, SlidersHorizontal, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { forceLayout, neighborhood, separate, settleLabels, type GraphEdge, type LabelSpot, type Point } from '../logic/graph'
import { activeAt, relationSentence, scopeLabel } from '../logic/relations'
import { appearances } from '../logic/reader'
import { formatDate } from '../logic/calendar'
import { kindLabel, kindPlural } from '../model/labels'
import type { Relation } from '../model/schema'
import { bookScenes, byId, entityName } from '../model/universe'
import { useWorkspace } from '../state/workspace'
import { CanonBadge, Empty } from '../ui/bits'
import { EntityPicker } from '../ui/EntityPicker'
import { AreaHead } from './AreaModes'
import { EdgeShape, NodeShape, ViaShape, type NodeActions } from './GraphParts'

/** Tamanho do desenho antes de medir a tela (e nos testes sem tela). */
const FALLBACK = { w: 1200, h: 800 }
const LABEL_SIZE = 13
/** Altura da faixa dos botões de zoom, no celular (deitados, embaixo). */
const CONTROLS = 52

interface Edge extends GraphEdge {
  id: string
  label: string
  /** "fica em" (vem da ficha), relação comum, ou quem está por trás de uma ligação. */
  kind: 'derivada' | 'relacao' | 'por-tras'
  relation?: Relation
  canon?: string
}

const calm = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
const ease = (t: number) => 1 - Math.pow(1 - t, 3)

/**
 * Posições mostradas na tela, animadas até o alvo do layout. Ao abrir, as fichas
 * saem do centro e se acomodam; ao mudar o filtro, deslizam para o novo lugar.
 */
function useAnimatedPositions(target: Map<string, Point>, center: Point): Map<string, Point> {
  const [shown, setShown] = useState<Map<string, Point>>(() => (calm() ? target : new Map()))
  const shownRef = useRef(shown)
  useEffect(() => {
    shownRef.current = shown
  })

  useEffect(() => {
    if (calm()) {
      const id = requestAnimationFrame(() => setShown(target))
      return () => cancelAnimationFrame(id)
    }
    const from = new Map<string, Point>()
    let i = 0
    for (const id of target.keys()) {
      const prev = shownRef.current.get(id)
      // Fichas novas nascem perto do centro, cada uma num ângulo, e "abrem" para o lugar delas.
      const a = i++ * 2.399963
      from.set(id, prev ?? { x: center.x + Math.cos(a) * 30, y: center.y + Math.sin(a) * 30 })
    }
    const start = performance.now()
    const duration = 900
    let frame = 0
    let last = start
    const step = (now: number) => {
      // Aparelho lento (cada quadro leva mais de 60 ms): pula a animação e mostra o desenho pronto,
      // em vez de refazer o desenho inteiro dezenas de vezes.
      if (now - last > 60) {
        setShown(target)
        return
      }
      last = now
      const t = Math.min(1, (now - start) / duration)
      const k = ease(t)
      const next = new Map<string, Point>()
      for (const [id, p] of target) {
        const f = from.get(id)!
        next.set(id, { x: f.x + (p.x - f.x) * k, y: f.y + (p.y - f.y) * k })
      }
      setShown(next)
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  return shown
}

/**
 * O tamanho da área do desenho na tela, em pixels (arredondado, para o desenho não se refazer a
 * cada pixel ao redimensionar). O grafo é desenhado nessa medida: 1 unidade = 1 pixel, então os
 * nomes têm o mesmo tamanho no celular e no monitor largo, e o desenho ocupa a área que há.
 */
function useBoxSize(): [(el: HTMLElement | null) => void, { w: number; h: number } | null] {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const observer = useRef<ResizeObserver | null>(null)
  const ref = useCallback((el: HTMLElement | null) => {
    observer.current?.disconnect()
    observer.current = null
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      if (!(r.width > 0 && r.height > 0)) return
      const next = { w: Math.max(280, Math.round(r.width / 20) * 20), h: Math.max(320, Math.round(r.height / 20) * 20) }
      setSize((s) => (s && s.w === next.w && s.h === next.h ? s : next))
    }
    measure()
    if (typeof ResizeObserver !== 'undefined') {
      observer.current = new ResizeObserver(measure)
      observer.current.observe(el)
    }
  }, [])
  return [ref, size]
}

export default function GraphView() {
  const { universe, nav, go, peek, bookId } = useWorkspace()
  const [focusId, setFocusId] = useState<string | null>(nav.view === 'relacoes' ? (nav.id ?? null) : null)
  const [depth, setDepth] = useState(2)
  const [showDerived, setShowDerived] = useState(true)
  const [onlyConnected, setOnlyConnected] = useState(true)
  const [hiddenKinds, setHiddenKinds] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<string | null>(focusId)
  const [hovered, setHovered] = useState<string | null>(null)
  // A busca (a lupa, no celular): aberta ou não, e a ficha que acabou de ser achada (o anel pulsa um instante).
  const [findOpen, setFindOpen] = useState(false)
  const [found, setFound] = useState<string | null>(null)
  const [view, setView] = useState({ x: 0, y: 0, k: 1 })
  const [inTime, setInTime] = useState(false)
  const [sceneIndex, setSceneIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  // `moved`: o dedo já andou o bastante para ser arrasto (e não toque). Até lá, nada se mexe.
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null)
  // Durante o gesto, o desenho se move direto (sem redesenhar a tela toda); ao soltar, a posição é guardada.
  const gRef = useRef<SVGGElement>(null)
  const live = useRef<{ x: number; y: number; k: number } | null>(null)
  const frame = useRef(0)
  // Um arrasto que começou numa bolinha não pode virar "toque" nela ao soltar.
  const suppressClick = useRef(false)
  const svgRef = useRef<SVGSVGElement>(null)
  const [wrapRef, measured] = useBoxSize()
  const { w: W, h: H } = measured ?? FALLBACK
  const narrow = W < 560
  // O que as bolinhas fazem: um objeto só, que nunca muda (assim passar o mouse não redesenha todas elas).
  const goRef = useRef(go)
  useEffect(() => {
    goRef.current = go
  })
  const actions = useMemo<NodeActions>(
    () => ({
      tap: (id) => {
        if (suppressClick.current) return
        setSelected((s) => (s === id ? null : id))
      },
      pick: (id) => setSelected(id),
      open: (id) => goRef.current('fichas', id),
      enter: (id, pointerType) => {
        if (pointerType === 'mouse' && !drag.current?.moved) setHovered(id)
      },
      leave: (id, pointerType) => {
        if (pointerType === 'mouse') setHovered((h) => (h === id ? null : h))
      },
      focus: (id) => setHovered(id),
      blur: (id) => setHovered((h) => (h === id ? null : h)),
    }),
    [],
  )
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ d: number; k: number } | null>(null)
  const transformOf = (v: { x: number; y: number; k: number }) => `translate(${v.x} ${v.y}) translate(${W / 2} ${H / 2}) scale(${v.k}) translate(${-W / 2} ${-H / 2})`
  /** Move o desenho já, sem passar pelo React; uma vez por quadro. */
  const moveLive = (next: { x: number; y: number; k: number }) => {
    live.current = next
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      if (live.current) gRef.current?.setAttribute('transform', transformOf(live.current))
    })
  }
  /** Fim do gesto: guarda onde o desenho parou. */
  const commitLive = () => {
    if (frame.current) cancelAnimationFrame(frame.current)
    frame.current = 0
    if (live.current) setView(live.current)
    live.current = null
  }
  /** Leva o desenho até `next` em meio segundo (sem animar para quem pediu menos movimento). */
  const fly = useRef<{ id: number; to: { x: number; y: number; k: number } } | null>(null)
  const flyTo = (next: { x: number; y: number; k: number }) => {
    if (fly.current) cancelAnimationFrame(fly.current.id)
    const from = live.current ?? view
    if (calm()) {
      fly.current = null
      setView(next)
      return
    }
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 450)
      const k = ease(t)
      gRef.current?.setAttribute('transform', transformOf({ x: from.x + (next.x - from.x) * k, y: from.y + (next.y - from.y) * k, k: from.k + (next.k - from.k) * k }))
      if (t < 1) fly.current = { id: requestAnimationFrame(step), to: next }
      else {
        fly.current = null
        setView(next)
      }
    }
    fly.current = { id: requestAnimationFrame(step), to: next }
  }
  /** Um dedo ou o mouse tocou no meio do voo: o desenho para onde ia chegar. */
  const stopFly = () => {
    if (!fly.current) return
    cancelAnimationFrame(fly.current.id)
    setView(fly.current.to)
    live.current = fly.current.to
    fly.current = null
  }
  const endPointer = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    if (pointers.current.size === 0) {
      drag.current = null
      commitLive()
    }
  }

  // Esc fecha o cartão da ficha.
  useEffect(() => {
    if (!selected) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[role="dialog"]')) setSelected(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected])

  // A roda do mouse dá zoom no grafo sem rolar a página por trás.
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setView((v) => ({ ...v, k: Math.min(4, Math.max(0.3, v.k * (e.deltaY < 0 ? 1.1 : 0.9))) }))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  })

  // O livro escolhido no alto: o mapa mostra quem aparece nele, e o "cena a cena" anda só por ele.
  const book = bookId ? universe.stories.find((s) => s.id === bookId) : undefined
  const scenes = useMemo(() => bookScenes(universe, bookId), [universe, bookId])
  // Trocou o livro: o "cena a cena" volta ao começo e o desenho, ao centro.
  const lastBook = useRef(bookId)
  useEffect(() => {
    if (lastBook.current === bookId) return
    lastBook.current = bookId
    setSceneIndex(0)
    setPlaying(false)
    setView({ x: 0, y: 0, k: 1 })
  }, [bookId])
  const scene = inTime ? (scenes[Math.min(sceneIndex, scenes.length - 1)] ?? null) : null

  // Tocar a história: avança uma cena por vez.
  useEffect(() => {
    if (!playing) return
    const t = setTimeout(() => {
      if (sceneIndex >= scenes.length - 1) setPlaying(false)
      else setSceneIndex((i) => i + 1)
    }, 1500)
    return () => clearTimeout(t)
  }, [playing, sceneIndex, scenes.length])

  const edges = useMemo<Edge[]>(() => {
    const list: Edge[] = []
    for (const r of universe.relations) {
      list.push({ id: r.id, from: r.fromId, to: r.toId, label: r.type, kind: 'relacao', relation: r, canon: r.canon })
      r.via.forEach((v, i) => list.push({ id: `${r.id}-via-${i}`, from: v.entityId, to: r.fromId, label: v.role || 'com', kind: 'por-tras', relation: r }))
    }
    if (showDerived) {
      for (const e of universe.entities) {
        if (e.parentId) list.push({ id: `p-${e.id}`, from: e.id, to: e.parentId, label: 'fica em', kind: 'derivada' })
        // Campos que apontam para fichas ("Mãe: Ilsa").
        e.fields.forEach((f, i) => f.type === 'ficha' && f.ref && list.push({ id: `c-${e.id}-${i}`, from: e.id, to: f.ref, label: f.key.toLocaleLowerCase('pt-BR') || 'campo', kind: 'derivada' }))
      }
    }
    return list
  }, [universe.relations, universe.entities, showDerived])

  // Em que cena cada ficha aparece pela primeira vez (no texto, no elenco, como POV ou lugar). Com um livro
  // escolhido, só entra no mapa quem aparece nele; num ponto da história, quem já apareceu até a cena.
  const firstSeen = useMemo(() => appearances(scenes, universe.entities).first, [scenes, universe.entities])
  // Fichas novas (que ainda não aparecem em livro nenhum) valem para qualquer livro: a mesma regra de Fichas, Linha do tempo e Mapas.
  const scope = useMemo(() => bookScope(universe, bookId), [universe, bookId])
  // Com um livro escolhido, quem não aparece nele nem é ficha nova não entra no mapa (a busca não oferece).
  const hiddenByBook = useMemo(() => (book ? universe.entities.filter((e) => !firstSeen.has(e.id) && !scope?.inNoBook(e.id)).map((e) => e.id) : []), [universe.entities, book, firstSeen, scope])
  const { nodes, visibleEdges } = useMemo(() => {
    // Com um livro: quem aparece nele e quem ainda não aparece em livro nenhum (fichas novas).
    let ids = new Set(universe.entities.filter((e) => !hiddenKinds.has(e.kind) && (!book || firstSeen.has(e.id) || Boolean(scope?.inNoBook(e.id)))).map((e) => e.id))
    let es = edges.filter((e) => ids.has(e.from) && ids.has(e.to) && (e.kind !== 'por-tras' || ids.has(e.relation!.toId)))
    if (focusId && ids.has(focusId)) {
      const near = neighborhood(focusId, es, depth)
      ids = new Set([...ids].filter((id) => near.has(id)))
      es = es.filter((e) => ids.has(e.from) && ids.has(e.to))
    } else if (onlyConnected) {
      const connected = new Set(es.flatMap((e) => [e.from, e.to]))
      ids = new Set([...ids].filter((id) => connected.has(id)))
    }
    return { nodes: universe.entities.filter((e) => ids.has(e.id)), visibleEdges: es }
  }, [universe.entities, edges, hiddenKinds, focusId, depth, onlyConnected, book, firstSeen, scope])

  // O layout usa todas as ligações visíveis (não só as do momento), para que as fichas não pulem com o tempo.
  const layoutKey = nodes.map((n) => n.id).join(',') + '|' + visibleEdges.map((e) => e.from + e.to).join(',') + `|${W}x${H}`
  // No celular, a faixa de baixo fica para os botões de zoom.
  const baseH = narrow ? H - CONTROLS : H
  // Com muitas fichas, o desenho fica maior que a tela (cada uma com lugar para a bolinha e o nome):
  // abre no tamanho de ler, e a pessoa arrasta para andar pelas ligações. "Enquadrar" mostra tudo.
  const grow = Math.max(1, Math.sqrt((nodes.length * (narrow ? 11000 : 13000)) / (W * baseH)))
  const LW = Math.round(W * grow)
  const LH = Math.round(baseH * grow)
  const degree = new Map<string, number>()
  for (const e of visibleEdges) {
    if (e.kind === 'por-tras') continue
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1)
    degree.set(e.to, (degree.get(e.to) ?? 0) + 1)
  }
  // O protagonista ganha uma bolinha um pouco maior (o desenho e os nomes se afastam contando com ela).
  const leads = new Set(universe.entities.filter((e) => isLead(roleIn(e, bookId))).map((e) => e.id))
  const leadKey = [...leads].join('|')
  const radius = (id: string) => nodeRadius(degree.get(id) ?? 0, narrow, leads.has(id))
  const labelWidth = (name: string) => (name || 'Sem nome').length * LABEL_SIZE * 0.6 + 8
  const sizeKey = nodes.map((n) => n.name).join('|')
  const raw = useMemo(
    () => {
      const springs = [...visibleEdges, ...visibleEdges.filter((e) => e.kind === 'por-tras').map((e) => ({ from: e.from, to: e.relation!.toId }))]
      // A margem deixa lugar para os nomes em volta das bolinhas da borda.
      return forceLayout(nodes.map((n) => ({ id: n.id })), springs, { width: LW, height: LH, margin: narrow ? 56 : 80, stretch: narrow ? 1.7 : 2.2 })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layoutKey],
  )
  // Depois das forças, uma passada que afasta as fichas até nenhuma bolinha ou nome encostar em outro;
  // depois, os nomes escolhem o lugar (quem tem mais ligações escolhe primeiro) e, se uma linha ainda passa
  // por cima de um nome, a bolinha se afasta um pouco. O desenho é então centrado na tela. O desenho tem
  // o tamanho bw × bh.
  const { target, bw, bh, labels } = useMemo(() => {
    const boxes = new Map(
      nodes.map((n) => {
        const r = radius(n.id)
        return [n.id, { w: Math.max(2 * r, labelWidth(n.name)), h: 2 * r + 4 + LABEL_SIZE * 1.3, top: -r }]
      }),
    )
    const sep = separate(raw, boxes, { gap: narrow ? 8 : 12 })
    if (!sep.size) return { target: sep, bw: W, bh: baseH, labels: new Map<string, LabelSpot>() }
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    for (const [id, p] of sep) {
      const b = boxes.get(id)!
      x0 = Math.min(x0, p.x - b.w / 2)
      x1 = Math.max(x1, p.x + b.w / 2)
      y0 = Math.min(y0, p.y + b.top)
      y1 = Math.max(y1, p.y + b.top + b.h)
    }
    const M = 16
    const spread = new Map([...sep].map(([id, p]) => [id, { x: p.x - x0 + M, y: p.y - y0 + M }]))
    const bw = x1 - x0 + 2 * M
    const bh = y1 - y0 + 2 * M
    const { pos: local, labels } = settleLabels(
      [...nodes]
        .sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))
        .map((n) => ({ id: n.id, width: labelWidth(n.name), height: LABEL_SIZE * 1.3, r: radius(n.id) })),
      spread,
      { width: bw, height: bh, pad: 4, edges: visibleEdges.filter((e) => e.kind !== 'por-tras') },
    )
    const dx = (W - bw) / 2
    const dy = (baseH - bh) / 2
    return { target: new Map([...local].map(([id, p]) => [id, { x: p.x + dx, y: p.y + dy }])), bw, bh, labels }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw, sizeKey, leadKey])
  /** O zoom que mostra o desenho inteiro. */
  const fitK = Math.min(1, W / bw, baseH / bh)
  const pos = useAnimatedPositions(target, { x: W / 2, y: H / 2 })

  const sceneAt = Math.min(sceneIndex, scenes.length - 1)
  const appeared = (id: string) => !inTime || (firstSeen.get(id) ?? Infinity) <= sceneAt
  const shownNodes = nodes.filter((n) => appeared(n.id))
  const notYet = inTime ? nodes.length - shownNodes.length : 0
  const active = (e: Edge) => !e.relation || activeAt(e.relation, scene)
  const liveIds = new Set(visibleEdges.filter(active).flatMap((e) => [e.from, e.to]))

  // A lupa: o desenho vai até a ficha (se ela está no mapa) e a destaca; se não está (um filtro, nenhuma ligação,
  // ainda não apareceu na história), mostra só ela e quem se liga a ela, como "Centrar numa ficha".
  const foundTimer = useRef(0)
  const find = (id: string) => {
    setFindOpen(false)
    setSelected(id)
    setFound(id)
    clearTimeout(foundTimer.current)
    foundTimer.current = window.setTimeout(() => setFound(null), 2200)
    const spot = shownNodes.some((n) => n.id === id) ? target.get(id) : undefined
    if (!spot) {
      const kind = universe.entities.find((e) => e.id === id)?.kind
      if (kind && hiddenKinds.has(kind)) setHiddenKinds((h) => new Set([...h].filter((k) => k !== kind)))
      if (inTime && !appeared(id)) setInTime(false)
      setFocusId(id)
      setView({ x: 0, y: 0, k: 1 })
      return
    }
    // A ficha vai para a parte de cima da tela: o cartão dela abre embaixo (no celular) e não a cobre.
    const k = Math.min(2, Math.max(1, view.k))
    const cy = narrow ? H * 0.27 : H / 2
    flyTo({ k, x: k * (W / 2 - spot.x), y: cy - H / 2 - k * (spot.y - H / 2) })
  }
  useEffect(() => () => clearTimeout(foundTimer.current), [])

  const kinds = [...new Set(universe.entities.map((e) => e.kind))]
  const sel = selected ? byId(universe, 'entities', selected) : undefined
  const focus = hovered ?? selected
  const focusEdges = focus ? visibleEdges.filter((e) => active(e) && (e.from === focus || e.to === focus || e.relation?.via.some((v) => v.entityId === focus))) : []
  const focusSet = new Set(focusEdges)
  const highlight = focus ? new Set([focus, ...focusEdges.flatMap((e) => [e.from, e.to, ...(e.relation ? [e.relation.fromId, e.relation.toId] : [])])]) : null
  const selRelations = sel ? universe.relations.filter((r) => r.fromId === sel.id || r.toId === sel.id || r.via.some((v) => v.entityId === sel.id)) : []

  const [filtersOpen, setFiltersOpen] = useState(false)
  // Quantos filtros mudaram do padrão (para o botão do celular dizer que há algo ligado).
  const filterCount = [focusId, hiddenKinds.size > 0, inTime, !showDerived, !onlyConnected].filter(Boolean).length
  const hasFamily = useMemo(() => familyLinks(universe).length > 0, [universe])
  const [mode, setMode] = useState<'ligacoes' | 'familia'>('ligacoes')
  const zoom = (f: number) => setView((v) => ({ ...v, k: Math.min(4, Math.max(Math.min(0.3, fitK), v.k * f)) }))

  return (
    <div className={`view graph-view${filtersOpen ? ' filters-open' : ''}`}>
      <AreaHead current="relacoes" tour="relacoes" />
      <header className="view-head view-head-wide area-tools">
        {/* No celular, o grafo vem primeiro: os filtros ficam atrás deste botão. */}
        {universe.relations.length > 0 && <button type="button" className="btn btn-sm graph-filters-btn" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>
          <SlidersHorizontal size={14} aria-hidden="true" /> Filtros{filterCount > 0 && <span className="chip-count"> {filterCount}</span>}
        </button>}
        {nodes.length > 0 && <button type="button" className="btn btn-sm graph-find-btn" aria-expanded={findOpen} aria-controls="graph-find" onClick={() => setFindOpen(!findOpen)}>
          <Search size={14} aria-hidden="true" /> Achar ficha
        </button>}
        <div className="graph-controls">
          <EntityPicker
            label="Centrar em"
            hideLabel
            placeholder="Centrar numa ficha…"
            value={focusId}
            allowCreate={false}
            onChange={(id) => {
              setFocusId(id)
              setSelected(id)
              setView({ x: 0, y: 0, k: 1 })
            }}
          />
          {focusId && (
            <label className="inline-label">
              Distância
              <input type="range" min={1} max={4} value={depth} onChange={(e) => setDepth(Number(e.target.value))} aria-label="Distância a partir da ficha" />
              <span className="tabular">{depth}</span>
            </label>
          )}
          <label className="check">
            <input type="checkbox" checked={showDerived} onChange={(e) => setShowDerived(e.target.checked)} /> Incluir “fica em”
          </label>
          {!focusId && (
            <label className="check">
              <input type="checkbox" checked={onlyConnected} onChange={(e) => setOnlyConnected(e.target.checked)} /> Só fichas com ligações
            </label>
          )}
        </div>
      </header>

      {findOpen && (
        <div
          id="graph-find"
          className="graph-find"
          role="search"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation()
              setFindOpen(false)
            }
          }}
        >
          <EntityPicker label="Achar uma ficha" hideLabel placeholder="Achar uma ficha pelo nome…" value={null} allowCreate={false} autoFocus exclude={hiddenByBook} onChange={(id) => id && find(id)} />
          <button type="button" className="btn-icon" aria-label="Fechar a busca" onClick={() => setFindOpen(false)}>
            <X size={16} />
          </button>
        </div>
      )}

      {hasFamily && (
        <div className="segmented graph-mode" role="radiogroup" aria-label="Como ver">
          <button type="button" role="radio" aria-checked={mode === 'ligacoes'} onClick={() => setMode('ligacoes')}>
            Ligações
          </button>
          <button type="button" role="radio" aria-checked={mode === 'familia'} onClick={() => setMode('familia')}>
            Árvore da família
          </button>
        </div>
      )}
      {mode === 'familia' && hasFamily ? (
        <FamilyTree />
      ) : (
        <>
      <div className="graph-bar">
        <div className="filter-chips" aria-label="Tipos visíveis">
          {kinds.map((k) => (
            <button
              key={k}
              type="button"
              className="chip"
              aria-pressed={!hiddenKinds.has(k)}
              onClick={() =>
                setHiddenKinds((h) => {
                  const n = new Set(h)
                  if (n.has(k)) n.delete(k)
                  else n.add(k)
                  return n
                })
              }
            >
              <span className={`kind-dot kind-${k}`} aria-hidden="true" /> {kindPlural(k)}
            </button>
          ))}
        </div>
        <div className="segmented" role="radiogroup" aria-label="Quais ligações">
          <button type="button" role="radio" aria-checked={!inTime} onClick={() => { setInTime(false); setPlaying(false) }}>
            Todas
          </button>
          <button type="button" role="radio" aria-checked={inTime} disabled={!scenes.length} onClick={() => setInTime(true)}>
            Num ponto da história
          </button>
        </div>
      </div>

      {!inTime && scenes.length > 1 && universe.relations.some((r) => r.scope.kind !== 'geral') && (
        <button type="button" className="graph-time-hint" onClick={() => setInTime(true)}>
          <Play size={14} aria-hidden="true" /> Algumas ligações mudam ao longo da história. Ver cena a cena
        </button>
      )}

      {inTime && scene && (
        <div className="graph-time">
          <button
            type="button"
            className="btn-icon"
            aria-label={playing ? 'Pausar' : 'Tocar a história'}
            onClick={() => {
              if (!playing && sceneIndex >= scenes.length - 1) setSceneIndex(0)
              setPlaying(!playing)
            }}
          >
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <input
            type="range"
            min={0}
            max={scenes.length - 1}
            value={Math.min(sceneIndex, scenes.length - 1)}
            aria-label="Cena"
            aria-valuetext={scene.title}
            onChange={(e) => {
              setPlaying(false)
              setSceneIndex(Number(e.target.value))
            }}
          />
          <button
            type="button"
            className="btn-icon"
            aria-label="Sair do cena a cena"
            title="Sair do cena a cena (ver todas as ligações)"
            onClick={() => {
              setInTime(false)
              setPlaying(false)
            }}
          >
            <X size={16} />
          </button>
          <p className="graph-time-label" aria-live="polite">
            <span className="tabular muted">
              {Math.min(sceneIndex, scenes.length - 1) + 1}/{scenes.length}
            </span>{' '}
            <strong>{scene.title || 'Sem título'}</strong>
            {scene.storyId && <span className="muted"> · {byId(universe, 'stories', scene.storyId)?.title}</span>}
            {scene.date && <span className="muted"> · {formatDate(universe, scene.date)}</span>}
            {notYet > 0 && <span className="muted"> · {notYet} {notYet === 1 ? 'ficha ainda não apareceu' : 'fichas ainda não apareceram'}</span>}
          </p>
          {(() => {
            // O que muda nesta cena em relação à anterior: é isso que o mapa anima.
            const i = Math.min(sceneIndex, scenes.length - 1)
            const prev = i > 0 ? scenes[i - 1] : null
            const scoped = universe.relations.filter((r) => r.scope.kind !== 'geral')
            const seen = (id: string, at: number) => (firstSeen.get(id) ?? Infinity) <= at
            const both = (r: (typeof scoped)[number], at: number) => seen(r.fromId, at) && seen(r.toId, at)
            const entering = nodes.filter((n) => firstSeen.get(n.id) === i)
            const starts = scoped.filter((r) => activeAt(r, scene) && both(r, i) && (!prev || !activeAt(r, prev) || !both(r, i - 1)))
            const ends = prev ? scoped.filter((r) => !activeAt(r, scene) && activeAt(r, prev) && both(r, i - 1)) : []
            if (!starts.length && !ends.length && !entering.length) return <p className="graph-changes muted small">Nada muda nesta cena.</p>
            return (
              <ul className="graph-changes small" aria-label="O que muda nesta cena">
                {entering.length > 0 && (
                  <li className="graph-change-new">
                    <span aria-hidden="true">●</span> Entra na história: {entering.map((n) => n.name).join(', ')}
                  </li>
                )}
                {starts.map((r) => (
                  <li key={`s-${r.id}`} className="graph-change-start">
                    <span aria-hidden="true">+</span> {relationSentence(universe, r)}
                  </li>
                ))}
                {ends.map((r) => (
                  <li key={`e-${r.id}`} className="graph-change-end">
                    <span aria-hidden="true">−</span> {relationSentence(universe, r)} <span className="muted">(deixa de valer)</span>
                  </li>
                ))}
              </ul>
            )
          })()}
        </div>
      )}

      {nodes.length === 0 ? (
        book ? (
          <Empty icon={<Network size={32} />} title="Ninguém aparece neste livro ainda.">
            <p>Quando o texto de “{book.title || 'Sem título'}” citar uma ficha (ou ela estiver no elenco de uma cena), ela entra aqui.</p>
          </Empty>
        ) : (
          <Empty icon={<Network size={32} />} title="Nenhuma ligação para mostrar.">
            <p>Adicione ligações nas fichas (“irmão de”, “serve a”…). Elas aparecem aqui como um mapa.</p>
          </Empty>
        )
      ) : (
        <div className="graph-wrap" ref={wrapRef}>
          <svg
            ref={svgRef}
            className={`graph${highlight ? ' has-focus' : ''}`}
            viewBox={`0 0 ${W} ${H}`}
            role="group"
            aria-label={`Grafo com ${shownNodes.length} fichas e ${visibleEdges.filter((e) => active(e) && appeared(e.from) && appeared(e.to)).length} ligações`}
            onPointerDown={(e) => {
              stopFly()
              // Arrastar o grafo nunca seleciona texto (no app do Claude, texto selecionado abre uma camada que escurece a tela).
              e.preventDefault()
              getSelection()?.removeAllRanges()
              pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
              const now = live.current ?? view
              if (pointers.current.size === 2) {
                // Dois dedos: pinça para zoom.
                const [a, b] = [...pointers.current.values()]
                pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, k: now.k }
                drag.current = null
                suppressClick.current = true
                return
              }
              // Vale começar o arrasto em cima de uma bolinha: só vira arrasto se o dedo andar.
              suppressClick.current = false
              drag.current = { x: e.clientX, y: e.clientY, vx: now.x, vy: now.y, moved: false }
            }}
            onPointerMove={(e) => {
              if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
              if (pinch.current && pointers.current.size === 2) {
                const [a, b] = [...pointers.current.values()]
                const k = pinch.current.k * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.d)
                if (Number.isFinite(k)) moveLive({ ...(live.current ?? view), k: Math.min(4, Math.max(0.3, k)) })
                return
              }
              if (!drag.current) return
              if (!drag.current.moved) {
                if (Math.hypot(e.clientX - drag.current.x, e.clientY - drag.current.y) < 8) return
                drag.current.moved = true
                suppressClick.current = true
                setHovered(null)
                ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
              }
              // Converte pixels da tela para unidades do desenho. A largura vem do retângulo na tela:
              // alguns navegadores dão 0 para clientWidth de um SVG, o que levava a posição ao infinito.
              const width = (e.currentTarget as SVGSVGElement).getBoundingClientRect().width
              if (!(width > 0)) return
              const scale = W / width
              const d = drag.current
              const x = d.vx + (e.clientX - d.x) * scale
              const y = d.vy + (e.clientY - d.y) * scale
              if (!Number.isFinite(x) || !Number.isFinite(y)) return
              // Não deixa o desenho sair inteiro da tela (mas deixa chegar à borda de um desenho grande).
              const v = live.current ?? view
              const lx = Math.max(W, (bw * v.k) / 2)
              const ly = Math.max(H, (bh * v.k) / 2)
              moveLive({ ...v, x: Math.max(-lx, Math.min(lx, x)), y: Math.max(-ly, Math.min(ly, y)) })
            }}
            onPointerUp={(e) => {
              // Toque no fundo (sem arrastar) fecha o cartão da ficha.
              const d = drag.current
              if (d && !d.moved && pointers.current.size === 1 && !(e.target as Element).closest('.node')) setSelected(null)
              endPointer(e)
            }}
            onPointerCancel={endPointer}
            // Começar o arrasto solta a captura que o toque tinha na bolinha de baixo (o aviso sobe até aqui): isso não é o fim do gesto.
            onLostPointerCapture={(e) => e.target === e.currentTarget && endPointer(e)}
          >
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="var(--line-strong)" />
              </marker>
            </defs>
            <g ref={gRef} transform={transformOf(view)}>
              {visibleEdges.map((e) => {
                const a = pos.get(e.from)
                const b = pos.get(e.to)
                if (!a || !b) return null
                if (!appeared(e.from) || !appeared(e.to) || (e.relation && (!appeared(e.relation.fromId) || !appeared(e.relation.toId)))) return null
                const off = !active(e)
                const lit = focusSet.has(e)
                if (e.kind === 'por-tras') {
                  // Quem está por trás aponta para o meio da relação principal.
                  const r = e.relation!
                  const p = pos.get(r.fromId)
                  const q = pos.get(r.toId)
                  if (!p || !q) return null
                  return <ViaShape key={e.id} off={off} lit={lit} label={e.label} ax={a.x} ay={a.y} mx={(p.x + q.x) / 2} my={(p.y + q.y) / 2} />
                }
                const rr = radius(e.to)
                const d = Math.hypot(b.x - a.x, b.y - a.y) || 1
                const row = lit ? focusEdges.filter((f) => f.kind !== 'por-tras' && ((f.from === e.from && f.to === e.to) || (f.from === e.to && f.to === e.from))).indexOf(e) : 0
                return (
                  <EdgeShape
                    key={e.id}
                    kind={e.kind}
                    canon={e.canon}
                    scoped={Boolean(e.relation && e.relation.scope.kind !== 'geral')}
                    off={off}
                    lit={lit}
                    label={e.label}
                    row={row}
                    ax={a.x}
                    ay={a.y}
                    bx={b.x - ((b.x - a.x) / d) * (rr + 3)}
                    by={b.y - ((b.y - a.y) / d) * (rr + 3)}
                    cx={b.x}
                    cy={b.y}
                  />
                )
              })}
              {shownNodes.map((n, i) => {
                const p = pos.get(n.id)
                if (!p) return null
                const r = radius(n.id)
                const spot = labels.get(n.id)
                return (
                  <NodeShape
                    key={n.id}
                    id={n.id}
                    name={n.name}
                    kind={n.kind}
                    image={n.image}
                    index={i}
                    x={p.x}
                    y={p.y}
                    r={r}
                    selected={n.id === selected}
                    dim={inTime && !liveIds.has(n.id)}
                    isNew={inTime && firstSeen.get(n.id) === sceneAt}
                    hl={highlight ? highlight.has(n.id) : false}
                    found={n.id === found}
                    labelDx={spot?.dx ?? 0}
                    labelDy={spot?.dy ?? r + 17}
                    labelAnchor={spot?.anchor ?? 'middle'}
                    actions={actions}
                  />
                )
              })}
            </g>
          </svg>
          <div className="graph-zoom">
            <button type="button" className="btn-icon" aria-label="Aproximar" onClick={() => zoom(1.2)}>
              <Plus size={16} />
            </button>
            <button type="button" className="btn-icon" aria-label="Afastar" onClick={() => zoom(1 / 1.2)}>
              <Minus size={16} />
            </button>
            <button type="button" className="btn-icon" aria-label="Enquadrar" onClick={() => setView({ x: 0, y: 0, k: fitK })}>
              <Maximize size={16} />
            </button>
          </div>

          {sel && (
            <aside
              className="graph-panel"
              aria-label="Ficha selecionada"
              onKeyDown={(e) => {
                if (e.key === 'Escape') setSelected(null)
              }}
            >
              <button type="button" className="btn-icon graph-panel-close" aria-label="Fechar o cartão" onClick={() => setSelected(null)}>
                <X size={16} />
              </button>
              <span className="eyebrow">{kindLabel(sel.kind)}</span>
              <h2>{sel.name}</h2>
              {sel.summary && <p className="small">{sel.summary}</p>}
              <ul className="plain-list small graph-panel-list">
                {selRelations.map((r) => {
                  const on = activeAt(r, scene)
                  return (
                    <li key={r.id} className={on ? undefined : 'muted'}>
                      {relationSentence(universe, r)}
                      {scopeLabel(universe, r) && <span className="muted"> · {scopeLabel(universe, r)}</span>}
                      {r.canon !== 'estabelecido' && <CanonBadge canon={r.canon} />}
                      {inTime && !on && <span className="tiny"> (não vale nesta cena)</span>}
                    </li>
                  )
                })}
                {sel.parentId && showDerived && (
                  <li>
                    fica em <strong>{entityName(universe, sel.parentId)}</strong>
                  </li>
                )}
              </ul>
              <div className="inline-fields">
                <button type="button" className="btn btn-sm btn-primary" onClick={() => go('fichas', sel.id)}>
                  Abrir ficha
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => {
                    setFocusId(sel.id)
                    setView({ x: 0, y: 0, k: 1 })
                  }}
                >
                  Centrar
                </button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => peek(sel.id)}>
                  Espiar
                </button>
              </div>
            </aside>
          )}
        </div>
      )}
{nodes.length > 0 && (
      <p className="muted small graph-hint">
        Arraste para mover, role para aproximar, passe o mouse ou clique numa ficha para destacar, duplo clique para abrir. Linhas tracejadas: quem está por trás de uma ligação.
      </p>
      )}
        </>
      )}
    </div>
  )
}
