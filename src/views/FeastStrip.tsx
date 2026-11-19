import { CalendarHeart } from 'lucide-react'
import { feastsOf } from '../logic/culture'
import { useWorkspace } from '../state/workspace'

/** "Festas de todo ano", na Linha do tempo: as festas das culturas na ordem do calendário. Some sem festas. */
export function FeastStrip() {
  const { universe, go } = useWorkspace()
  const rows = feastsOf(universe)
  if (!rows.length) return null
  return (
    <section className="feast-strip" aria-label="Festas de todo ano">
      <h3 className="small">
        <CalendarHeart size={14} aria-hidden="true" /> Festas de todo ano
      </h3>
      <ul>
        {rows.map((f) => (
          <li key={f.id}>
            <button type="button" className="feast-chip" title={f.about || undefined} onClick={() => go('fichas', f.culture.id)}>
              <strong>{f.name}</strong>
              <span>
                {f.when ? `${f.when} · ` : ''}
                {f.culture.name}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
