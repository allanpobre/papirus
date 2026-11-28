import { GitBranch } from 'lucide-react'
import { useMemo, useState } from 'react'
import { contentTree, hasBranches, type TreeNode } from '../logic/contentTree'
import { diplomacyOf, diplomacyYears, TONE_LABEL, type Tone } from '../logic/quadros'
import { formatYear } from '../model/labels'
import type { Universe } from '../model/schema'
import { byId } from '../model/universe'
import { useWorkspace } from '../state/workspace'
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

const branchy = (u: Universe) => u.entities.filter((e) => hasBranches(u, e.id)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

function TreesBoard() {
  const { universe, go, readOnly } = useWorkspace()
  const roots = useMemo(() => branchy(universe), [universe])
  const [rootId, setRootId] = useState<string | null>(null)
  const [everyone, setEveryone] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const pick = roots.find((r) => r.id === rootId)?.id ?? roots[0]?.id ?? null
  const tree = pick ? contentTree(universe, pick, { everyone }) : null
  const roleOf = (n: TreeNode) => (n.via?.kind === 'lista' ? universe.relations.find((r) => r.id === (n.via as { relationId: string }).relationId)?.role : undefined)
  const draw = (n: TreeNode, top = false): React.ReactNode => (
    <li key={n.entity.id}>
      <div className={`ftree-node${top ? ' is-root' : ''}`} style={{ '--k': `var(--kind-${n.entity.kind}, var(--accent))` } as React.CSSProperties}>
        <button type="button" className="ftree-name" aria-label={`Abrir a ficha ${n.entity.name}`} onClick={() => go('fichas', n.entity.id)}>
          <b>{n.entity.name}</b>
          <small>{roleOf(n) || n.entity.summary.trim() || n.entity.kind}</small>
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
          <div className="ftree-wrap">
            <ul className="ftree">{draw(tree, true)}</ul>
          </div>
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

function DiplomacyBoard() {
  const { universe, go } = useWorkspace()
  const years = useMemo(() => diplomacyYears(universe), [universe])
  const [year, setYear] = useState<number | null>(null)
  const { nodes, edges } = useMemo(() => diplomacyOf(universe, { year }), [universe, year])
  const suffix = universe.settings.calendarSuffix
  if (!diplomacyOf(universe).nodes.length)
    return <Empty>Ainda não há ligações entre facções ou reinos. Ligue duas delas (“aliado de”, “em guerra com”, “paz tensa com”) e o quadro aparece, com cores e linhas diferentes para cada tipo.</Empty>

  const W = 560
  const noneThisYear = !nodes.length
  const H = nodes.length <= 2 ? 200 : nodes.length === 3 ? 340 : 440
  const pos = new Map(
    nodes.map((n, i) => {
      // Dois: um de cada lado; três ou mais: em roda, começando de cima.
      const a = nodes.length === 2 ? Math.PI + i * Math.PI : (i / nodes.length) * Math.PI * 2 - Math.PI / 2
      const rx = W / 2 - 90
      const ry = H / 2 - 50
      return [n.id, { x: W / 2 + rx * Math.cos(a), y: H / 2 + ry * Math.sin(a) }] as const
    }),
  )
  return (
    <div className="quadro">
      {years.length > 1 && (
        <div className="quadro-year">
          <label>
            Ano
            <input
              type="range"
              min={years[0]}
              max={years[years.length - 1]}
              step={1}
              value={year ?? years[years.length - 1]}
              onChange={(e) => setYear(Number(e.target.value))}
              aria-label="Ano do mundo"
            />
          </label>
          <output>{year === null ? 'Todos os anos' : formatYear(year, suffix)}</output>
          {year !== null && (
            <button type="button" className="btn btn-ghost" onClick={() => setYear(null)}>
              Todos os anos
            </button>
          )}
        </div>
      )}
      {noneThisYear && <Empty>Nenhuma ligação entre facções e reinos neste ano. Mexa no controle de ano, ou toque em “Todos os anos”.</Empty>}
      {!noneThisYear && <svg className="dip" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Quadro de diplomacia: as ligações entre facções e reinos">
        {edges.map((e, i) => {
          const a = pos.get(e.from)
          const b = pos.get(e.to)
          if (!a || !b) return null
          // Duas ligações entre o mesmo par: uma linha mais para cima e a outra para baixo, com os textos separados.
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
        {nodes.map((n) => {
          const p = pos.get(n.id)!
          return (
            <g key={n.id} className="dip-node" transform={`translate(${p.x - 62} ${p.y - 22})`} tabIndex={0} role="link" aria-label={`Abrir a ficha ${n.name}`} onClick={() => go('fichas', n.id)} onKeyDown={(ev) => ev.key === 'Enter' && go('fichas', n.id)}>
              <rect width="124" height="44" rx="7" />
              <text x="62" y="19" textAnchor="middle" className="dip-name">
                {n.name.length > 17 ? `${n.name.slice(0, 16)}…` : n.name}
              </text>
              <text x="62" y="34" textAnchor="middle" className="dip-sub">
                {n.summary.trim().slice(0, 20) || (n.kind === 'reino' ? 'Reino' : 'Facção')}
              </text>
            </g>
          )
        })}
      </svg>}
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
