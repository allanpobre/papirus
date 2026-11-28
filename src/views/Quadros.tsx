import { GitBranch } from 'lucide-react'
import { useMemo, useState } from 'react'
import { contentTree, hasBranches, treeSize, type TreeNode } from '../logic/contentTree'
import { layoutHorizontal, linkPath } from '../logic/treeLayout'
import { diplomacyOf, diplomacyYears, TONE_LABEL, type Tone } from '../logic/quadros'
import { formatYear } from '../model/labels'
import type { Entity, Universe } from '../model/schema'
import { byId } from '../model/universe'
import { useWorkspace } from '../state/workspace'
import { useMediaQuery } from '../ui/useMediaQuery'
import { FamilyTree } from './FamilyTree'
import { TreeDialog } from './TreeDialog'

export type QuadroMode = 'mural' | 'familia' | 'arvores' | 'diplomacia'
const MODES: { id: QuadroMode; label: string }[] = [
  { id: 'mural', label: 'Mural' },
  { id: 'familia', label: 'Família' },
  { id: 'arvores', label: 'Árvores' },
  { id: 'diplomacia', label: 'Diplomacia' },
]

/** As formas de ver as ligações: o mural de sempre e os quadros prontos (família, árvores, diplomacia). */
export function QuadroModes({ mode, onMode }: { mode: QuadroMode; onMode: (m: QuadroMode) => void }) {
  return (
    <div className="quadro-modes" role="group" aria-label="Ver as ligações como">
      {MODES.map((m) => (
        <button key={m.id} type="button" className="chip" aria-pressed={mode === m.id} onClick={() => onMode(m.id)}>
          {m.label}
        </button>
      ))}
    </div>
  )
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="quadro-empty muted">{children}</p>

// ---------------------------------------------------------------- Árvores

/** As fichas com galhos, a árvore maior primeiro (a da Terra de Oz antes da de uma cidade dentro dela). */
const branchy = (u: Universe) =>
  u.entities
    .filter((e) => hasBranches(u, e.id))
    .map((e) => ({ e, size: treeSize(contentTree(u, e.id)!) }))
    .sort((a, b) => b.size - a.size || a.e.name.localeCompare(b.e.name, 'pt-BR'))
    .map((x) => x.e)

const BOX_W = 176
const BOX_H = 46

function TreesBoard() {
  const { universe, go, readOnly } = useWorkspace()
  const phone = useMediaQuery('(max-width: 760px)')
  const roots = useMemo(() => branchy(universe), [universe])
  const [rootId, setRootId] = useState<string | null>(null)
  const [everyone, setEveryone] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const pick = roots.find((r) => r.id === rootId)?.id ?? roots[0]?.id ?? null
  const tree = pick ? contentTree(universe, pick, { everyone }) : null
  const roleOf = (n: TreeNode) => (n.via?.kind === 'lista' ? universe.relations.find((r) => r.id === (n.via as { relationId: string }).relationId)?.role : undefined)
  const label = (n: TreeNode) => roleOf(n) || n.entity.summary.trim() || n.entity.kind
  const layout = useMemo(() => (tree && !phone ? layoutHorizontal(tree, { boxW: BOX_W, boxH: BOX_H }) : null), [tree, phone])
  // No celular, a árvore fica recuada, de cima para baixo (a deitada pede largura).
  const draw = (n: TreeNode, top = false): React.ReactNode => (
    <li key={n.entity.id}>
      <div className={`ftree-node${top ? ' is-root' : ''}`} style={{ '--k': `var(--kind-${n.entity.kind}, var(--accent))` } as React.CSSProperties}>
        <button type="button" className="ftree-name" aria-label={`Abrir a ficha ${n.entity.name}`} onClick={() => go('fichas', n.entity.id)}>
          <b>{n.entity.name}</b>
          <small>{label(n)}</small>
        </button>
      </div>
      {n.children.length > 0 && <ul>{n.children.map((c) => draw(c))}</ul>}
    </li>
  )
  return (
    <div className="quadro">
      <div className="quadro-bar">
        {roots.length > 0 && (
          <label className="quadro-pick">
            Árvore de
            <select className="input select" value={pick ?? ''} onChange={(e) => setRootId(e.target.value)}>
              {roots.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {!readOnly && (
          <>
            {pick && (
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(pick)}>
                <GitBranch size={15} aria-hidden="true" /> Editar esta árvore
              </button>
            )}
            <button type="button" className="btn btn-primary" onClick={() => setEditing('')}>
              Nova árvore
            </button>
          </>
        )}
      </div>
      {tree ? (
        <>
          <label className="check">
            <input type="checkbox" checked={everyone} onChange={(e) => setEveryone(e.target.checked)} /> Mostrar também pessoas (com o papel de cada uma)
          </label>
          {layout ? (
            <div className="ftree-wrap">
              <div className="ftree-h" style={{ width: layout.width, height: layout.height }}>
                <svg className="ftree-h-lines" width={layout.width} height={layout.height} aria-hidden="true">
                  {layout.links.map((l) => (
                    <path key={`${l.from.node.entity.id}-${l.to.node.entity.id}`} d={linkPath(l.from, l.to, BOX_W, BOX_H)} />
                  ))}
                </svg>
                {layout.nodes.map((l) => (
                  <div
                    key={l.node.entity.id}
                    className={`ftree-node ftree-h-node${l === layout.nodes[layout.nodes.length - 1] ? ' is-root' : ''}`}
                    style={{ left: l.x, top: l.y, width: BOX_W, height: BOX_H, '--k': `var(--kind-${l.node.entity.kind}, var(--accent))` } as React.CSSProperties}
                  >
                    <button type="button" className="ftree-name" aria-label={`Abrir a ficha ${l.node.entity.name}`} onClick={() => go('fichas', l.node.entity.id)}>
                      <b>{l.node.entity.name}</b>
                      <small>{label(l.node)}</small>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="ftree-wrap">
              <ul className="ftree">{draw(tree, true)}</ul>
            </div>
          )}
        </>
      ) : (
        <Empty>Nenhuma árvore ainda. Uma árvore mostra o que está dentro de quê: tipos de dragão, ordens de uma facção, cidades de um reino. Toque em “Nova árvore”.</Empty>
      )}
      {editing !== null && <TreeDialog rootId={editing || null} onClose={() => setEditing(null)} onPickRoot={(id) => (setRootId(id), setEditing(id))} />}
    </div>
  )
}

// ---------------------------------------------------------------- Diplomacia

const TONES: Tone[] = ['alianca', 'guerra', 'tensa', 'outra']

/** Os nomes em fila, os vizinhos juntos (começando de quem tem mais ligações), para os arcos ficarem curtos. */
function orderNodes(nodes: Entity[], edges: { from: string; to: string }[]): Entity[] {
  const deg = new Map(nodes.map((n) => [n.id, edges.filter((e) => e.from === n.id || e.to === n.id).length]))
  const seen = new Set<string>()
  const out: Entity[] = []
  for (const start of [...nodes].sort((a, b) => (deg.get(b.id) ?? 0) - (deg.get(a.id) ?? 0) || a.name.localeCompare(b.name, 'pt-BR'))) {
    if (seen.has(start.id)) continue
    const queue = [start]
    seen.add(start.id)
    while (queue.length) {
      const cur = queue.shift()!
      out.push(cur)
      for (const e of edges) {
        const other = e.from === cur.id ? e.to : e.to === cur.id ? e.from : null
        const next = other ? nodes.find((n) => n.id === other) : undefined
        if (next && !seen.has(next.id)) (seen.add(next.id), queue.push(next))
      }
    }
  }
  return out
}

/** Um nome em até duas linhas, para caber no cartão. */
function twoLines(name: string, max = 12): [string, string] {
  const words = name.split(/\s+/)
  let first = ''
  let i = 0
  while (i < words.length && (first + ' ' + words[i]).trim().length <= max) first = (first + ' ' + words[i++]).trim()
  if (!first) return [name.slice(0, max - 1) + '…', '']
  const rest = words.slice(i).join(' ')
  return [first, rest.length > max ? rest.slice(0, max - 1) + '…' : rest]
}

function DiplomacyBoard() {
  const { universe, go } = useWorkspace()
  const years = useMemo(() => diplomacyYears(universe), [universe])
  const [year, setYear] = useState<number | null>(null)
  const { nodes, edges } = useMemo(() => diplomacyOf(universe, { year }), [universe, year])
  const suffix = universe.settings.calendarSuffix
  if (!diplomacyOf(universe).nodes.length)
    return <Empty>Ainda não há ligações entre facções ou reinos. Ligue duas delas (“aliado de”, “em guerra com”, “em tensão com”) e o quadro aparece, com cores e linhas diferentes para cada tipo.</Empty>

  // Em fila, com arcos por cima (até 10 nomes); com mais, em roda.
  const row = nodes.length <= 10
  const ordered = row ? orderNodes(nodes, edges) : nodes
  const idx = new Map(ordered.map((n, i) => [n.id, i]))
  const NW = 96
  const NH = 46
  const STEP = 116
  const maxSpan = Math.max(1, ...edges.map((e) => Math.abs((idx.get(e.from) ?? 0) - (idx.get(e.to) ?? 0))))
  const W = row ? Math.max(560, ordered.length * STEP + 24) : 560
  const archTop = 34 + 26 * maxSpan + 16
  const H = row ? archTop + NH + 24 : nodes.length <= 3 ? 340 : 440
  const baseY = row ? archTop : 0
  const pos = new Map(
    ordered.map((n, i) => {
      if (row) return [n.id, { x: 12 + i * STEP + NW / 2, y: baseY }] as const
      const a = nodes.length === 2 ? Math.PI + i * Math.PI : (i / nodes.length) * Math.PI * 2 - Math.PI / 2
      return [n.id, { x: W / 2 + (W / 2 - 90) * Math.cos(a), y: H / 2 + (H / 2 - 50) * Math.sin(a) }] as const
    }),
  )
  return (
    <div className="quadro">
      {years.length > 1 && (
        <div className="quadro-year">
          <label>
            Ano
            <input type="range" min={years[0]} max={years[years.length - 1]} step={1} value={year ?? years[years.length - 1]} onChange={(e) => setYear(Number(e.target.value))} aria-label="Ano do mundo" />
          </label>
          <output>{year === null ? 'Todos os anos' : formatYear(year, suffix)}</output>
          {year !== null && (
            <button type="button" className="btn btn-ghost" onClick={() => setYear(null)}>
              Todos os anos
            </button>
          )}
        </div>
      )}
      {!nodes.length && <Empty>Nenhuma ligação entre facções e reinos neste ano. Mexa no controle de ano, ou toque em “Todos os anos”.</Empty>}
      {nodes.length > 0 && (
        <div className="dip-wrap">
          <svg className="dip" viewBox={`0 0 ${W} ${H}`} style={{ minWidth: row ? Math.min(W, 720) : undefined }} role="img" aria-label="Quadro de diplomacia: as ligações entre facções e reinos">
            {edges.map((e, i) => {
              const a = pos.get(e.from)
              const b = pos.get(e.to)
              if (!a || !b) return null
              if (row) {
                // Um arco por cima: quanto mais longe os dois, mais alto; ligações do mesmo par, uma acima da outra.
                const span = Math.abs((idx.get(e.from) ?? 0) - (idx.get(e.to) ?? 0))
                const same = edges.filter((x) => [x.from, x.to].sort().join('|') === [e.from, e.to].sort().join('|'))
                const lift = 34 + 26 * span + 14 * same.indexOf(e)
                const y = a.y
                const mid = (a.x + b.x) / 2
                return (
                  <g key={`${e.id}-${i}`} className={`dip-edge is-${e.tone}`}>
                    <path d={`M${a.x} ${y} C${a.x} ${y - lift}, ${b.x} ${y - lift}, ${b.x} ${y}`} fill="none" />
                    <text x={mid} y={y - lift * 0.75 - 6} textAnchor="middle">
                      {e.label}
                    </text>
                  </g>
                )
              }
              const key = [e.from, e.to].sort().join('|')
              const group = edges.filter((x) => [x.from, x.to].sort().join('|') === key)
              const k = group.indexOf(e) - (group.length - 1) / 2
              const dx = b.x - a.x
              const dy = b.y - a.y
              const len = Math.hypot(dx, dy) || 1
              const ox = (-dy / len) * k * 12
              const oy = (dx / len) * k * 12
              return (
                <g key={`${e.id}-${i}`} className={`dip-edge is-${e.tone}`}>
                  <line x1={a.x + ox} y1={a.y + oy} x2={b.x + ox} y2={b.y + oy} />
                  <text x={(a.x + b.x) / 2 + ox} y={(a.y + b.y) / 2 + oy - 5} textAnchor="middle">
                    {e.label}
                  </text>
                </g>
              )
            })}
            {ordered.map((n) => {
              const p = pos.get(n.id)!
              const [l1, l2] = twoLines(n.name)
              return (
                <g key={n.id} className="dip-node" transform={`translate(${p.x - NW / 2} ${p.y - (row ? 0 : NH / 2)})`} tabIndex={0} role="link" aria-label={`Abrir a ficha ${n.name}`} onClick={() => go('fichas', n.id)} onKeyDown={(ev) => ev.key === 'Enter' && go('fichas', n.id)}>
                  <rect width={NW} height={NH} rx="7" />
                  <text x={NW / 2} y={l2 ? 19 : 25} textAnchor="middle" className="dip-name">
                    {l1}
                  </text>
                  {l2 && (
                    <text x={NW / 2} y={34} textAnchor="middle" className="dip-name">
                      {l2}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        </div>
      )}
      <ul className="dip-legend" aria-label="Legenda">
        {TONES.filter((t) => edges.some((e) => e.tone === t)).map((t) => (
          <li key={t} className={`is-${t}`}>
            <i aria-hidden="true" /> {TONE_LABEL[t]}
          </li>
        ))}
      </ul>
      {/* Em texto, para leitor de tela e para o celular, onde o desenho fica pequeno. */}
      <ul className="dip-list">
        {edges.map((e) => (
          <li key={e.id}>
            {byId(universe, 'entities', e.from)?.name} <b>{e.label}</b> {byId(universe, 'entities', e.to)?.name} <span className="muted">· {TONE_LABEL[e.tone].toLowerCase()}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function QuadroBoard({ mode }: { mode: Exclude<QuadroMode, 'mural'> }) {
  return mode === 'familia' ? <div className="quadro"><FamilyTree /></div> : mode === 'arvores' ? <TreesBoard /> : <DiplomacyBoard />
}
