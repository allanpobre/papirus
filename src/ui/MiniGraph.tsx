/** Um mapa pequeno de ligações (caderno do leitor, Codex dos jogadores). Quem é novo chega animado. */
export interface MiniNode {
  id: string
  label: string
  isNew?: boolean
}
export interface MiniEdge {
  from: string
  to: string
  isNew?: boolean
}

export function MiniGraph({ nodes, edges, onPick, className = 'leitor-graph' }: { nodes: MiniNode[]; edges: MiniEdge[]; onPick?: (id: string) => void; className?: string }) {
  const W = 320
  const H = 240
  const pos = new Map(
    nodes.map((n, i) => {
      const a = (i / nodes.length) * Math.PI * 2 - Math.PI / 2
      return [n.id, { x: W / 2 + Math.cos(a) * (W / 2 - 52), y: H / 2 + Math.sin(a) * (H / 2 - 26) }]
    }),
  )
  return (
    <svg className={className} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Mapa com ${nodes.length} fichas e ${edges.length} ligações`}>
      {edges.map((e, i) => {
        const a = pos.get(e.from)
        const b = pos.get(e.to)
        if (!a || !b) return null
        return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={e.isNew ? 'is-new' : undefined} pathLength={1} />
      })}
      {nodes.map((n) => {
        const p = pos.get(n.id)!
        return (
          <g key={n.id} transform={`translate(${p.x} ${p.y})`} className={n.isNew ? 'is-new' : undefined} onClick={onPick ? () => onPick(n.id) : undefined}>
            <circle r={7} />
            <text y={-11} textAnchor="middle">
              {n.label.length > 16 ? `${n.label.slice(0, 15)}…` : n.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
