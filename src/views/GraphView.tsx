import { Maximize, Minus, Network, Pause, Play, Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { forceLayout, neighborhood, type GraphEdge, type Point } from '../logic/graph'
import { activeAt, relationSentence, scopeLabel } from '../logic/relations'
import { appearances } from '../logic/reader'
import { formatDate } from '../logic/calendar'
import { kindLabel, kindPlural } from '../model/labels'
import type { Relation } from '../model/schema'
import { byId, entityName, manuscriptOrder } from '../model/universe'
import { useWorkspace } from '../state/workspace'
import { CanonBadge, Empty } from '../ui/bits'
import { EntityPicker } from '../ui/EntityPicker'

const W = 1200
const H = 800

interface Edge extends GraphEdge {
  id: string
  label: string
  /** "fica em" (vem da ficha), relação comum, ou quem está por trás de uma relação. */
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
function useAnimatedPositions(target: Map<string, Point>): Map<string, Point> {
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
      from.set(id, prev ?? { x: W / 2 + Math.cos(a) * 30, y: H / 2 + Math.sin(a) * 30 })
    }
    const start = performance.now()
    const duration = 900
    let frame = 0
    const step = (now: number) => {
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
  }, [target])

  return shown
}

export default function GraphView() {
  const { universe, nav, go, peek } = useWorkspace()
  const [focusId, setFocusId] = useState<string | null>(nav.view === 'relacoes' ? (nav.id ?? null) : null)
  const [depth, setDepth] = useState(2)
  const [showDerived, setShowDerived] = useState(true)
  const [onlyConnected, setOnlyConnected] = useState(true)
  const [hiddenKinds, setHiddenKinds] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<string | null>(focusId)
  const [hovered, setHovered] = useState<string | null>(null)
  const [view, setView] = useState({ x: 0, y: 0, k: 1 })
  const [inTime, setInTime] = useState(false)
  const [sceneIndex, setSceneIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ d: number; k: number } | null>(null)
  const endPointer = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    if (pointers.current.size === 0) drag.current = null
  }

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

  const scenes = useMemo(() => manuscriptOrder(universe), [universe])
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
      }
    }
    return list
  }, [universe.relations, universe.entities, showDerived])

  const { nodes, visibleEdges } = useMemo(() => {
    let ids = new Set(universe.entities.filter((e) => !hiddenKinds.has(e.kind)).map((e) => e.id))
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
  }, [universe.entities, edges, hiddenKinds, focusId, depth, onlyConnected])

  // O layout usa todas as ligações visíveis (não só as do momento), para que as fichas não pulem com o tempo.
  const layoutKey = nodes.map((n) => n.id).join(',') + '|' + visibleEdges.map((e) => e.from + e.to).join(',')
  const target = useMemo(
    () => {
      const springs = [...visibleEdges, ...visibleEdges.filter((e) => e.kind === 'por-tras').map((e) => ({ from: e.from, to: e.relation!.toId }))]
      return forceLayout(nodes.map((n) => ({ id: n.id })), springs, { width: W, height: H })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layoutKey],
  )
  const pos = useAnimatedPositions(target)

  // Num ponto da história, só entra no mapa quem já apareceu até a cena (no texto, no elenco, como POV ou lugar).
  const firstSeen = useMemo(() => appearances(scenes, universe.entities).first, [scenes, universe.entities])
  const sceneAt = Math.min(sceneIndex, scenes.length - 1)
  const appeared = (id: string) => !inTime || (firstSeen.get(id) ?? Infinity) <= sceneAt
  const shownNodes = nodes.filter((n) => appeared(n.id))
  const notYet = inTime ? nodes.length - shownNodes.length : 0
  const active = (e: Edge) => !e.relation || activeAt(e.relation, scene)
  const liveIds = new Set(visibleEdges.filter(active).flatMap((e) => [e.from, e.to]))

  const degree = new Map<string, number>()
  for (const e of visibleEdges) {
    if (e.kind === 'por-tras') continue
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1)
    degree.set(e.to, (degree.get(e.to) ?? 0) + 1)
  }
  const radius = (id: string) => 13 + Math.min(10, (degree.get(id) ?? 0) * 1.5)
  const kinds = [...new Set(universe.entities.map((e) => e.kind))]
  const sel = selected ? byId(universe, 'entities', selected) : undefined
  const focus = hovered ?? selected
  const focusEdges = focus ? visibleEdges.filter((e) => active(e) && (e.from === focus || e.to === focus || e.relation?.via.some((v) => v.entityId === focus))) : []
  const highlight = focus ? new Set([focus, ...focusEdges.flatMap((e) => [e.from, e.to, ...(e.relation ? [e.relation.fromId, e.relation.toId] : [])])]) : null
  const selRelations = sel ? universe.relations.filter((r) => r.fromId === sel.id || r.toId === sel.id || r.via.some((v) => v.entityId === sel.id)) : []

  const zoom = (f: number) => setView((v) => ({ ...v, k: Math.min(4, Math.max(0.3, v.k * f)) }))

  return (
    <div className="view graph-view">
      <header className="view-head view-head-wide">
        <h1>Relações</h1>
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
              <input type="checkbox" checked={onlyConnected} onChange={(e) => setOnlyConnected(e.target.checked)} /> Só fichas com relações
            </label>
          )}
        </div>
      </header>

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
        <div className="segmented" role="radiogroup" aria-label="Quais relações">
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
          <Play size={14} aria-hidden="true" /> Algumas relações mudam ao longo da história. Ver cena a cena
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
        <Empty icon={<Network size={32} />} title="Nenhuma relação para mostrar.">
          <p>Adicione relações nas fichas (“irmão de”, “serve a”…). Elas aparecem aqui como um mapa.</p>
        </Empty>
      ) : (
        <div className="graph-wrap">
          <svg
            ref={svgRef}
            className="graph"
            viewBox={`0 0 ${W} ${H}`}
            role="group"
            aria-label={`Grafo com ${shownNodes.length} fichas e ${visibleEdges.filter((e) => active(e) && appeared(e.from) && appeared(e.to)).length} relações`}
            onPointerDown={(e) => {
              // Arrastar o grafo nunca seleciona texto (no app do Claude, texto selecionado abre uma camada que escurece a tela).
              e.preventDefault()
              getSelection()?.removeAllRanges()
              pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
              if (pointers.current.size === 2) {
                // Dois dedos: pinça para zoom.
                const [a, b] = [...pointers.current.values()]
                pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, k: view.k }
                drag.current = null
                return
              }
              if ((e.target as Element).closest('.node')) return
              ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
              drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }
            }}
            onPointerMove={(e) => {
              if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
              if (pinch.current && pointers.current.size === 2) {
                const [a, b] = [...pointers.current.values()]
                const k = pinch.current.k * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.d)
                if (Number.isFinite(k)) setView((v) => ({ ...v, k: Math.min(4, Math.max(0.3, k)) }))
                return
              }
              if (!drag.current) return
              // Converte pixels da tela para unidades do desenho. A largura vem do retângulo na tela:
              // alguns navegadores dão 0 para clientWidth de um SVG, o que levava a posição ao infinito.
              const width = (e.currentTarget as SVGSVGElement).getBoundingClientRect().width
              if (!(width > 0)) return
              const scale = W / width
              const d = drag.current
              const x = d.vx + (e.clientX - d.x) * scale
              const y = d.vy + (e.clientY - d.y) * scale
              if (!Number.isFinite(x) || !Number.isFinite(y)) return
              // Não deixa o desenho sair inteiro da tela.
              setView((v) => ({ ...v, x: Math.max(-W, Math.min(W, x)), y: Math.max(-H, Math.min(H, y)) }))
            }}
            onPointerUp={endPointer}
            onPointerCancel={endPointer}
            onLostPointerCapture={endPointer}
          >
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="var(--line-strong)" />
              </marker>
            </defs>
            <g transform={`translate(${view.x} ${view.y}) translate(${W / 2} ${H / 2}) scale(${view.k}) translate(${-W / 2} ${-H / 2})`}>
              {visibleEdges.map((e) => {
                const a = pos.get(e.from)
                const b = pos.get(e.to)
                if (!a || !b) return null
                if (!appeared(e.from) || !appeared(e.to) || (e.relation && (!appeared(e.relation.fromId) || !appeared(e.relation.toId)))) return null
                const on = active(e)
                const lit = highlight ? highlight.has(e.from) && highlight.has(e.to) && focusEdges.includes(e) : false
                const dim = highlight && !lit
                if (e.kind === 'por-tras') {
                  // Quem está por trás aponta para o meio da relação principal.
                  const r = e.relation!
                  const p = pos.get(r.fromId)
                  const q = pos.get(r.toId)
                  if (!p || !q) return null
                  const mx = (p.x + q.x) / 2
                  const my = (p.y + q.y) / 2
                  return (
                    <g key={e.id} className={`edge edge-via${on ? '' : ' off'}${dim ? ' dim' : ''}`}>
                      <path d={`M${a.x},${a.y} L${mx},${my}`} />
                      <circle cx={mx} cy={my} r={3.5} className="edge-via-dot" />
                      {lit && (
                        <text x={(a.x + mx) / 2} y={(a.y + my) / 2 - 5} className="edge-label">
                          {e.label}
                        </text>
                      )}
                    </g>
                  )
                }
                const rr = radius(e.to)
                const d = Math.hypot(b.x - a.x, b.y - a.y) || 1
                const bx = b.x - ((b.x - a.x) / d) * (rr + 3)
                const by = b.y - ((b.y - a.y) / d) * (rr + 3)
                const scoped = e.relation && e.relation.scope.kind !== 'geral'
                return (
                  <g
                    key={e.id}
                    className={`edge${e.kind === 'derivada' ? ' edge-derived' : ''}${on ? '' : ' off'}${dim ? ' dim' : ''}${lit ? ' lit' : ''}${e.canon && e.canon !== 'estabelecido' ? ` edge-${e.canon}` : ''}${scoped ? ' edge-scoped' : ''}`}
                  >
                    <path d={`M${a.x},${a.y} L${bx},${by}`} pathLength={e.kind === 'relacao' && e.canon !== 'rumor' ? 1 : undefined} markerEnd="url(#arrow)" />
                    {lit && (
                      <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 5} className="edge-label">
                        {e.label}
                      </text>
                    )}
                  </g>
                )
              })}
              {shownNodes.map((n, i) => {
                const p = pos.get(n.id)
                if (!p) return null
                const r = radius(n.id)
                const dim = (highlight && !highlight.has(n.id)) || (inTime && !liveIds.has(n.id))
                return (
                  <g
                    key={n.id}
                    className={`node kind-${n.kind}${n.id === selected ? ' selected' : ''}${dim ? ' dim' : ''}${inTime && firstSeen.get(n.id) === sceneAt ? ' is-new' : ''}`}
                    style={{ ['--i' as string]: i }}
                    transform={`translate(${p.x} ${p.y})`}
                    tabIndex={0}
                    role="button"
                    aria-label={`${n.name}, ${kindLabel(n.kind)}`}
                    onClick={() => setSelected(n.id === selected ? null : n.id)}
                    onPointerEnter={() => setHovered(n.id)}
                    onPointerLeave={() => setHovered((h) => (h === n.id ? null : h))}
                    onFocus={() => setHovered(n.id)}
                    onBlur={() => setHovered((h) => (h === n.id ? null : h))}
                    onMouseDown={(e) => e.detail > 1 && e.preventDefault()}
                    onDoubleClick={(e) => {
                      e.preventDefault()
                      getSelection()?.removeAllRanges()
                      go('fichas', n.id)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setSelected(n.id)
                    }}
                  >
                    {n.id === selected && <circle r={r + 7} className="node-ring" />}
                    <circle r={r} />
                    <text y={r + 17} className="node-label">
                      {n.name}
                    </text>
                  </g>
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
            <button type="button" className="btn-icon" aria-label="Enquadrar" onClick={() => setView({ x: 0, y: 0, k: 1 })}>
              <Maximize size={16} />
            </button>
          </div>

          {sel && (
            <aside className="graph-panel" aria-label="Ficha selecionada">
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
      <p className="muted small graph-hint">
        Arraste para mover, role para aproximar, passe o mouse ou clique numa ficha para destacar, duplo clique para abrir. Linhas tracejadas: quem está por trás de uma relação.
      </p>
    </div>
  )
}
