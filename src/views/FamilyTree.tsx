import { useMemo } from 'react'
import { familyLayout, familyLinks } from '../logic/family'
import { byId } from '../model/universe'
import { useWorkspace } from '../state/workspace'

const W = 150
const H = 46
const GAP_X = 28
const GAP_Y = 70

/** Árvore da família, montada das relações. Clique numa pessoa para espiar a ficha. */
export function FamilyTree() {
  const { universe, peek } = useWorkspace()
  const links = useMemo(() => familyLinks(universe), [universe])
  const { nodes } = useMemo(() => familyLayout(links), [links])
  if (!links.length)
    return (
      <p className="empty-inline">
        Nenhuma relação de família ainda. Ligue as fichas com “pai de”, “filha de”, “casado com”, “irmã de”, “avô de”… e a árvore se monta sozinha.
      </p>
    )
  const at = new Map(nodes.map((n) => [n.id, { x: n.x * (W + GAP_X), y: n.gen * (H + GAP_Y) }]))
  const width = Math.max(...nodes.map((n) => at.get(n.id)!.x)) + W
  const height = Math.max(...nodes.map((n) => at.get(n.id)!.y)) + H
  const name = (id: string) => byId(universe, 'entities', id)?.name ?? '?'

  return (
    <div className="family-wrap">
      <svg className="family" viewBox={`-10 -10 ${width + 20} ${height + 20}`} width={width + 20} height={height + 20} role="img" aria-label={`Árvore da família com ${nodes.length} pessoas`}>
        {links.map((l, i) => {
          const a = at.get(l.a)!
          const b = at.get(l.b)!
          if (l.kind === 'casal' || l.kind === 'irmaos') {
            const [left, right] = a.x < b.x ? [a, b] : [b, a]
            const y = left.y + H / 2
            return <line key={i} className={`family-${l.kind}`} x1={left.x + W} y1={y} x2={right.x} y2={y} />
          }
          // Pai/mãe → filho: cotovelo.
          const x1 = a.x + W / 2
          const x2 = b.x + W / 2
          const y1 = a.y + H
          const y2 = b.y
          const mid = y1 + (y2 - y1) / 2
          return <path key={i} className={`family-${l.kind}`} d={`M${x1},${y1} V${mid} H${x2} V${y2}`} />
        })}
        {nodes.map((n) => {
          const p = at.get(n.id)!
          const e = byId(universe, 'entities', n.id)
          const years = e && (e.startYear !== null || e.endYear !== null) ? `${e.startYear ?? '?'}–${e.endYear ?? ''}` : ''
          return (
            <g
              key={n.id}
              className="family-node"
              transform={`translate(${p.x},${p.y})`}
              role="button"
              tabIndex={0}
              aria-label={`${name(n.id)}${years ? `, ${years}` : ''}`}
              onClick={() => peek(n.id)}
              onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && peek(n.id)}
            >
              <rect width={W} height={H} rx={10} />
              <text x={W / 2} y={years ? 20 : 28} textAnchor="middle" className="family-name">
                {name(n.id).length > 20 ? `${name(n.id).slice(0, 19)}…` : name(n.id)}
              </text>
              {years && (
                <text x={W / 2} y={36} textAnchor="middle" className="family-years">
                  {years}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <p className="muted tiny family-legend">
        <span className="family-key family-key-casal" /> casal <span className="family-key family-key-irmaos" /> irmãos <span className="family-key family-key-pais" /> pais e filhos
      </p>
    </div>
  )
}
