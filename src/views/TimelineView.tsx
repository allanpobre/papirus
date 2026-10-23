import { CalendarRange, Feather, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { formatYear } from '../model/labels'
import type { TimelineEvent } from '../model/schema'
import { byId, draftEvent, entityName, insert, manuscriptOrder, patch, remove } from '../model/universe'
import { useWorkspace } from '../state/workspace'
import { CanonBadge, CanonSelect, Empty, Field, Select, YearInput } from '../ui/bits'
import { ConfirmButton } from '../ui/ConfirmButton'
import { EntityMultiPicker, EntityPicker } from '../ui/EntityPicker'
import { Modal } from '../ui/Modal'

export default function TimelineView() {
  const { universe, update, nav, go, undoable } = useWorkspace()
  const suffix = universe.settings.calendarSuffix
  const [filterIds, setFilterIds] = useState<string[]>([])
  const [minImportance, setMinImportance] = useState(1)
  const [showScenes, setShowScenes] = useState(true)
  const [editing, setEditing] = useState<string | null>(nav.view === 'timeline' ? (nav.id ?? null) : null)
  const [newTitle, setNewTitle] = useState('')
  const [newYear, setNewYear] = useState<number | null>(null)

  const eras = universe.events.filter((e) => e.kind === 'era').sort((a, b) => a.year - b.year)
  const events = useMemo(
    () =>
      universe.events
        .filter((e) => e.kind === 'evento' && e.importance >= minImportance)
        .filter((e) => filterIds.length === 0 || filterIds.some((id) => e.entityIds.includes(id) || e.placeId === id)),
    [universe.events, minImportance, filterIds],
  )
  const scenes = showScenes
    ? manuscriptOrder(universe).filter((s) => s.date && (filterIds.length === 0 || filterIds.some((id) => s.presentIds.includes(id) || s.povId === id || s.placeId === id)))
    : []

  type Row = { year: number; day: number | null; kind: 'evento'; ev: TimelineEvent } | { year: number; day: number | null; kind: 'cena'; sceneId: string }
  const rows: Row[] = [
    ...events.map((ev) => ({ year: ev.year, day: null, kind: 'evento' as const, ev })),
    ...scenes.map((s) => ({ year: s.date!.year, day: s.date!.day, kind: 'cena' as const, sceneId: s.id })),
  ].sort((a, b) => a.year - b.year || (a.day ?? -1) - (b.day ?? -1) || (a.kind === 'evento' ? -1 : 1))

  const years = [...rows.map((r) => r.year), ...eras.flatMap((e) => [e.year, e.endYear ?? e.year])]
  const minY = years.length ? Math.min(...years) : 0
  const maxY = years.length ? Math.max(...years) : 0
  const span = Math.max(1, maxY - minY)

  const eraOf = (year: number) => eras.filter((e) => year >= e.year && year <= (e.endYear ?? e.year)).map((e) => e.title)

  const create = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim() || newYear === null) return
    let id = ''
    update((u) => {
      const [next, ev] = insert(u, 'events', draftEvent(newTitle.trim(), newYear))
      id = ev.id
      return next
    })
    setNewTitle('')
    setEditing(id)
  }

  const groups: { year: number; rows: Row[] }[] = []
  for (const r of rows) {
    const g = groups[groups.length - 1]
    if (g && g.year === r.year) g.rows.push(r)
    else groups.push({ year: r.year, rows: [r] })
  }

  const editingEvent = editing ? byId(universe, 'events', editing) : undefined

  return (
    <div className="view timeline-view">
      <header className="view-head view-head-wide">
        <h1>Timeline</h1>
        <form className="quick-create" onSubmit={create}>
          <label htmlFor="novo-evento" className="sr-only">
            Novo evento
          </label>
          <input id="novo-evento" className="input" placeholder="Novo evento…" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
          <YearInput label="Ano do novo evento" value={newYear} onChange={setNewYear} />
          <button type="submit" className="btn btn-primary" disabled={!newTitle.trim() || newYear === null}>
            <Plus size={16} /> Evento
          </button>
        </form>
      </header>

      <div className="timeline-filters">
        <div className="timeline-filter-entities">
          <EntityMultiPicker label="Mostrar só o que envolve" value={filterIds} onChange={setFilterIds} placeholder="Filtrar por ficha…" />
        </div>
        <Field label="Importância mínima">
          {(id) => (
            <Select
              id={id}
              value={String(minImportance)}
              onChange={(v) => setMinImportance(Number(v))}
              options={[
                { value: '1', label: 'Todos' },
                { value: '2', label: 'Médios e grandes' },
                { value: '3', label: 'Só os grandes' },
              ]}
            />
          )}
        </Field>
        <label className="check">
          <input type="checkbox" checked={showScenes} onChange={(e) => setShowScenes(e.target.checked)} /> Mostrar cenas datadas
        </label>
      </div>

      {eras.length > 0 && (
        <div className="era-strip" aria-label="Eras">
          {eras.map((era) => (
            <button
              key={era.id}
              type="button"
              className="era"
              style={{ left: `${((era.year - minY) / span) * 100}%`, width: `${Math.max(4, (((era.endYear ?? era.year) - era.year) / span) * 100)}%` }}
              title={`${era.title}: ${formatYear(era.year, suffix)} — ${formatYear(era.endYear, suffix)}`}
              onClick={() => setEditing(era.id)}
            >
              {era.title}
            </button>
          ))}
          <span className="era-axis era-axis-start">{formatYear(minY, suffix)}</span>
          <span className="era-axis era-axis-end">{formatYear(maxY, suffix)}</span>
        </div>
      )}

      {groups.length === 0 ? (
        <Empty icon={<CalendarRange size={32} />} title="Nenhum evento ainda.">
          <p>Crie eventos e eras com o ano do seu calendário. Cenas com data narrativa aparecem aqui também.</p>
        </Empty>
      ) : (
        <ol className="timeline">
          {groups.map((g) => (
            <li key={g.year} className="tl-year">
              <div className="tl-year-label">
                <span className="tl-year-num">{formatYear(g.year, suffix)}</span>
                {eraOf(g.year).length > 0 && <span className="tl-era">{eraOf(g.year).join(' · ')}</span>}
              </div>
              <ul className="tl-items">
                {g.rows.map((r) =>
                  r.kind === 'evento' ? (
                    <li key={r.ev.id} className={`tl-item tl-imp-${r.ev.importance}`}>
                      <button type="button" className="tl-card" onClick={() => setEditing(r.ev.id)}>
                        <span className="tl-title">{r.ev.title}</span>
                        {r.ev.endYear !== null && <span className="muted small"> até {formatYear(r.ev.endYear, suffix)}</span>}
                        {r.ev.canon !== 'estabelecido' && <CanonBadge canon={r.ev.canon} />}
                        {r.ev.description && <span className="tl-desc">{r.ev.description}</span>}
                        {(r.ev.entityIds.length > 0 || r.ev.placeId) && (
                          <span className="tl-who">
                            {[...r.ev.entityIds.map((id) => entityName(universe, id)), r.ev.placeId ? `em ${entityName(universe, r.ev.placeId)}` : ''].filter(Boolean).join(', ')}
                          </span>
                        )}
                      </button>
                    </li>
                  ) : (
                    <li key={r.sceneId} className="tl-item tl-scene">
                      <button type="button" className="tl-card" onClick={() => go('escrever', r.sceneId)}>
                        <Feather size={14} aria-hidden="true" />
                        <span className="tl-title">{byId(universe, 'scenes', r.sceneId)?.title || 'Sem título'}</span>
                        {r.day !== null && <span className="muted small"> · dia {r.day}</span>}
                        <span className="muted small"> · cena</span>
                      </button>
                    </li>
                  ),
                )}
              </ul>
            </li>
          ))}
        </ol>
      )}

      {editingEvent && (
        <Modal
          title={editingEvent.kind === 'era' ? 'Era' : 'Evento'}
          onClose={() => setEditing(null)}
          footer={
            <>
              <ConfirmButton
                question="Apagar este evento?"
                confirmLabel="Apagar"
                onConfirm={() => {
                  undoable('Evento apagado', (u) => remove(u, 'events', editingEvent.id))
                  setEditing(null)
                }}
              >
                <Trash2 size={15} /> Apagar
              </ConfirmButton>
              <button type="button" className="btn btn-primary" onClick={() => setEditing(null)}>
                Pronto
              </button>
            </>
          }
        >
          <EventForm ev={editingEvent} onChange={(c) => update((u) => patch(u, 'events', editingEvent.id, c))} />
        </Modal>
      )}
    </div>
  )
}

function EventForm({ ev, onChange }: { ev: TimelineEvent; onChange: (c: Partial<TimelineEvent>) => void }) {
  return (
    <div className="form-grid">
      <Field label="Título" wide>
        {(id) => <input id={id} className="input" value={ev.title} onChange={(e) => onChange({ title: e.target.value })} />}
      </Field>
      <Field label="Tipo">
        {(id) => (
          <Select
            id={id}
            value={ev.kind}
            onChange={(v) => onChange({ kind: v })}
            options={[
              { value: 'evento', label: 'Evento' },
              { value: 'era', label: 'Era (faixa de tempo)' },
            ]}
          />
        )}
      </Field>
      <Field label="Importância">
        {(id) => (
          <Select
            id={id}
            value={String(ev.importance)}
            onChange={(v) => onChange({ importance: Number(v) })}
            options={[
              { value: '1', label: 'Pequena' },
              { value: '2', label: 'Média' },
              { value: '3', label: 'Grande' },
            ]}
          />
        )}
      </Field>
      <div className="field">
        <span className="field-label">Período</span>
        <div className="inline-fields">
          <YearInput label="Ano" value={ev.year} onChange={(v) => v !== null && onChange({ year: v })} />
          <span className="muted">até</span>
          <YearInput label="Ano final" placeholder="(opcional)" value={ev.endYear} onChange={(v) => onChange({ endYear: v })} />
        </div>
      </div>
      <Field label="Canon">{(id) => <CanonSelect id={id} value={ev.canon} onChange={(v) => onChange({ canon: v })} />}</Field>
      <EntityPicker label="Local" kinds={['lugar', 'reino']} value={ev.placeId} onChange={(v) => onChange({ placeId: v })} />
      <div className="field-wide">
        <EntityMultiPicker label="Participantes" value={ev.entityIds} onChange={(ids) => onChange({ entityIds: ids })} />
      </div>
      <Field label="Descrição" wide>
        {(id) => <textarea id={id} className="input textarea" rows={4} value={ev.description} onChange={(e) => onChange({ description: e.target.value })} />}
      </Field>
    </div>
  )
}
