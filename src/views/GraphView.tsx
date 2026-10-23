import { Maximize, Minus, Network, Plus } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { forceLayout, neighborhood, type GraphEdge } from '../logic/graph'
import { kindLabel, kindPlural } from '../model/labels'
import { byId, entityName } from '../model/universe'
import { useWorkspace } from '../state/workspace'
import { CanonBadge, Empty } from '../ui/bits'
import { EntityPicker } from '../ui/EntityPicker'

const W = 1200
const H = 800

interface Edge extends GraphEdge {
  id: string
  label: string
  derived: boolean
  canon?: string
}

export default function GraphView() {
  const { universe, nav, go, peek } = useWorkspace()
  const [focusId, setFocusId] = useState<string | null>(nav.view === 'relacoes' ? (nav.id ?? null) : null)
  const [depth, setDepth] = useState(2)
  const [showDerived, setShowDerived] = useState(true)
  const [onlyConnected, setOnlyConnected] = useState(true)
  const [hiddenKinds, setHiddenKinds] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<string | null>(focusId)
  const [view, setView] = useState({ x: 0, y: 0, k: 1 })
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)

  const edges = useMemo<Edge[]>(() => {
    const list: Edge[] = universe.relations.map((r) => ({ id: r.id, from: r.fromId, to: r.toId, label: r.type, derived: false, canon: r.canon }))
    if (showDerived) {
      for (const e of universe.entities) {
        if (e.parentId) list.push({ id: `p-${e.id}`, from: e.id, to: e.parentId, label: 'fica em', derived: true })
      }
    }
    return list
  }, [universe.relations, universe.entities, showDerived])

  const { nodes, visibleEdges } = useMemo(() => {
    let ids = new Set(universe.entities.filter((e) => !hiddenKinds.has(e.kind)).map((e) => e.id))
    let es = edges.filter((e) => ids.has(e.from) && ids.has(e.to))
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

  const layoutKey = nodes.map((n) => n.id).join(',') + '|' + visibleEdges.map((e) => e.from + e.to).join(',')
  const pos = useMemo(
    () => forceLayout(nodes.map((n) => ({ id: n.id })), visibleEdges, { width: W, height: H }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layoutKey],
  )

  const degree = new Map<string, number>()
  for (const e of visibleEdges) {
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1)
    degree.set(e.to, (degree.get(e.to) ?? 0) + 1)
  }
  const kinds = [...new Set(universe.entities.map((e) => e.kind))]
  const sel = selected ? byId(universe, 'entities', selected) : undefined
  const selEdges = selected ? edges.filter((e) => e.from === selected || e.to === selected) : []
  const highlight = selected ? new Set([selected, ...selEdges.flatMap((e) => [e.from, e.to])]) : null

  const zoom = (f: number) => setView((v) => ({ ...v, k: Math.min(4, Math.max(0.3, v.k * f)) }))

  return (
    <div className="view graph-view">
      <header className="view-head view-head-wide">
        <h1>Relações</h1>
        <div className="graph-controls">
          <EntityPicker label="Centrar em" hideLabel placeholder="Centrar numa ficha…" value={focusId} allowCreate={false} onChange={(id) => { setFocusId(id); setSelected(id); setView({ x: 0, y: 0, k: 1 }) }} />
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

      <div className="filter-chips" aria-label="Tipos visíveis">
        {kinds.map((k) => (
          <button
            key={k}
            type="button"
            className="chip"
            aria-pressed={!hiddenKinds.has(k)}
            onClick={() => setHiddenKinds((h) => { const n = new Set(h); if (n.has(k)) n.delete(k); else n.add(k); return n })}
          >
            <span className={`kind-dot kind-${k}`} aria-hidden="true" /> {kindPlural(k)}
          </button>
        ))}
      </div>

      {nodes.length === 0 ? (
        <Empty icon={<Network size={32} />} title="Nenhuma relação para mostrar.">
          <p>Adicione relações nas fichas (“irmão de”, “serve a”…). Elas aparecem aqui como um mapa.</p>
        </Empty>
      ) : (
        <div className="graph-wrap">
          <svg
            className="graph"
            viewBox={`0 0 ${W} ${H}`}
            role="group"
            aria-label={`Grafo com ${nodes.length} fichas e ${visibleEdges.length} relações`}
            onPointerDown={(e) => {
              if ((e.target as Element).closest('.node')) return
              ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
              drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }
            }}
            onPointerMove={(e) => {
              if (!drag.current) return
              const scale = W / (e.currentTarget as SVGSVGElement).clientWidth
              setView((v) => ({ ...v, x: drag.current!.vx + (e.clientX - drag.current!.x) * scale, y: drag.current!.vy + (e.clientY - drag.current!.y) * scale }))
            }}
            onPointerUp={() => (drag.current = null)}
            onWheel={(e) => zoom(e.deltaY < 0 ? 1.1 : 0.9)}
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
                const r = 13 + Math.min(10, (degree.get(e.to) ?? 0) * 1.5)
                const d = Math.hypot(b.x - a.x, b.y - a.y) || 1
                const bx = b.x - ((b.x - a.x) / d) * (r + 3)
                const by = b.y - ((b.y - a.y) / d) * (r + 3)
                const dim = highlight && !(highlight.has(e.from) && highlight.has(e.to) && (e.from === selected || e.to === selected))
                return (
                  <g key={e.id} className={`edge${e.derived ? ' edge-derived' : ''}${dim ? ' dim' : ''}${e.canon && e.canon !== 'estabelecido' ? ` edge-${e.canon}` : ''}`}>
                    <line x1={a.x} y1={a.y} x2={bx} y2={by} markerEnd="url(#arrow)" />
                    {(!dim && highlight) && (
                      <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 4} className="edge-label">
                        {e.label}
                      </text>
                    )}
                  </g>
                )
              })}
              {nodes.map((n) => {
                const p = pos.get(n.id)
                if (!p) return null
                const r = 13 + Math.min(10, (degree.get(n.id) ?? 0) * 1.5)
                const dim = highlight && !highlight.has(n.id)
                return (
                  <g
                    key={n.id}
                    className={`node kind-${n.kind}${n.id === selected ? ' selected' : ''}${dim ? ' dim' : ''}`}
                    transform={`translate(${p.x} ${p.y})`}
                    tabIndex={0}
                    role="button"
                    aria-label={`${n.name}, ${kindLabel(n.kind)}`}
                    onClick={() => setSelected(n.id === selected ? null : n.id)}
                    onDoubleClick={() => go('fichas', n.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setSelected(n.id)
                    }}
                  >
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
              <ul className="plain-list small">
                {selEdges.map((e) => (
                  <li key={e.id}>
                    {e.from === sel.id ? (
                      <>
                        {e.label} <strong>{entityName(universe, e.to)}</strong>
                      </>
                    ) : (
                      <>
                        <strong>{entityName(universe, e.from)}</strong> {e.label}
                      </>
                    )}
                    {e.canon && e.canon !== 'estabelecido' && <CanonBadge canon={e.canon as never} />}
                  </li>
                ))}
              </ul>
              <div className="inline-fields">
                <button type="button" className="btn btn-sm btn-primary" onClick={() => go('fichas', sel.id)}>
                  Abrir ficha
                </button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setFocusId(sel.id); setView({ x: 0, y: 0, k: 1 }) }}>
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
      <p className="muted small graph-hint">Arraste para mover, role para aproximar, clique numa ficha para destacar, duplo clique para abrir.</p>
    </div>
  )
}
