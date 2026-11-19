import { Network } from 'lucide-react'
import { useMemo } from 'react'
import { roleIn } from '../logic/roles'
import type { Entity } from '../model/schema'
import { useWorkspace } from '../state/workspace'
import { Picture } from '../images/Picture'
import { GeneratedCover } from '../ui/GeneratedCover'

/*
 * O mural em foco (Nova cara): uma ficha no centro e só as ligações dela em volta, com o nome da ligação no
 * fio. Tocar em outra ficha a traz para o centro; as pistas abertas dela aparecem como "?". Assim o mural não
 * polui, por maior que o mundo seja. O jeito do retrato muda com o clima (medalhão, hexágono, foto).
 */
const MAX = 8

export function FocusMural({ centerId, onCenter, onFullGraph }: { centerId: string | null; onCenter: (id: string) => void; onFullGraph: () => void }) {
  const { universe, bookId, go, peek } = useWorkspace()
  const withLinks = useMemo(() => {
    const n = new Map<string, number>()
    for (const r of universe.relations) for (const id of [r.fromId, r.toId]) n.set(id, (n.get(id) ?? 0) + 1)
    return universe.entities.filter((e) => n.has(e.id)).sort((a, b) => (n.get(b.id) ?? 0) - (n.get(a.id) ?? 0))
  }, [universe.relations, universe.entities])
  const center =
    universe.entities.find((e) => e.id === centerId) ?? withLinks.find((e) => roleIn(e, bookId) === 'protagonista') ?? withLinks[0] ?? null

  if (!center)
    return <p className="muted small focus-empty">Ainda não há ligações. Ligue duas fichas (na ficha, em Ligações) e elas aparecem aqui.</p>

  // As ligações do centro, uma por ficha (a primeira de cada), e as pistas abertas em que ele está.
  const seen = new Set<string>()
  const links: { other: Entity; label: string; out: boolean }[] = []
  for (const r of universe.relations) {
    if (r.fromId !== center.id && r.toId !== center.id) continue
    const otherId = r.fromId === center.id ? r.toId : r.fromId
    const other = universe.entities.find((e) => e.id === otherId)
    if (!other || seen.has(other.id) || other.id === center.id) continue
    seen.add(other.id)
    links.push({ other, label: r.type || 'ligado a', out: r.fromId === center.id })
  }
  const clues = universe.seeds.filter((s) => s.entityIds.includes(center.id) && (s.status === 'aberta' || s.status === 'parcial')).slice(0, 2)
  const shown = links.slice(0, MAX - clues.length)
  const more = links.length - shown.length
  const total = shown.length + clues.length
  const at = (i: number) => {
    const a = (i / Math.max(total, 1)) * Math.PI * 2 - Math.PI / 2
    return { x: 50 + Math.cos(a) * 38, y: 47 + Math.sin(a) * 36 }
  }

  return (
    <div className="focus-mural-wrap">
      <div className="focus-mural-bar">
        <label className="focus-pick">
          <span className="tiny muted">No centro</span>
          <select className="input input-sm" aria-label="Ficha no centro do mural" value={center.id} onChange={(ev) => onCenter(ev.target.value)}>
            {withLinks.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name || 'Sem nome'}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onFullGraph}>
          <Network size={15} aria-hidden="true" /> Grafo completo
        </button>
      </div>
      <div className="focus-mural" role="group" aria-label={`Mural de ${center.name || 'Sem nome'}`}>
        <svg className="focus-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {[...shown, ...clues].map((_, i) => {
            const p = at(i)
            return <line key={i} x1={50} y1={47} x2={p.x} y2={p.y} className={i >= shown.length ? 'is-clue' : ''} vectorEffect="non-scaling-stroke" />
          })}
        </svg>
        {shown.map((l, i) => {
          const p = at(i)
          return (
            <span key={`f-${l.other.id}`} className="focus-label" style={{ left: `${50 + (p.x - 50) * 0.62}%`, top: `${47 + (p.y - 47) * 0.62}%` }}>
              {l.out ? `${l.label} →` : `← ${l.label}`}
            </span>
          )
        })}
        <button type="button" className="focus-node is-center" style={{ left: '50%', top: '47%' }} onClick={() => go('fichas', center.id)} aria-label={`${center.name || 'Sem nome'} (no centro): abrir a ficha`}>
          <Face e={center} />
          <b>{center.name || 'Sem nome'}</b>
        </button>
        {shown.map((l, i) => {
          const p = at(i)
          return (
            <button key={l.other.id} type="button" className="focus-node" style={{ left: `${p.x}%`, top: `${p.y}%` }} onClick={() => onCenter(l.other.id)} aria-label={`${l.other.name || 'Sem nome'}: ${l.out ? `${center.name} ${l.label}` : l.label} (pôr no centro)`}>
              <Face e={l.other} />
              <b>{l.other.name || 'Sem nome'}</b>
            </button>
          )
        })}
        {clues.map((s, k) => {
          const p = at(shown.length + k)
          return (
            <button key={s.id} type="button" className="focus-node is-clue" style={{ left: `${p.x}%`, top: `${p.y}%` }} onClick={() => go('tramas', s.id)} aria-label={`Pista aberta: ${s.title}`}>
              <span className="focus-face">?</span>
              <b>{s.title}</b>
            </button>
          )
        })}
      </div>
      {more > 0 && (
        <p className="small muted focus-more">
          E mais {more} {more === 1 ? 'ligação' : 'ligações'}:{' '}
          {links.slice(shown.length).map((l, i) => (
            <span key={l.other.id}>
              {i > 0 && ', '}
              <button type="button" className="link-btn" onClick={() => peek(l.other.id)}>
                {l.other.name}
              </button>
            </span>
          ))}
        </p>
      )}
    </div>
  )
}

function Face({ e }: { e: Entity }) {
  return <span className="focus-face">{e.image ? <Picture value={e.image} className="focus-img" /> : <GeneratedCover name={e.name || '?'} />}</span>
}
