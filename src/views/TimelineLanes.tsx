import { TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { LANE_LABEL, lanesOf, outOfOrder, storyYear, type LaneBy } from '../logic/lanes'
import { formatYear } from '../model/labels'
import type { TimelineEvent } from '../model/schema'
import { patch } from '../model/universe'
import { useStoryPoint } from '../state/storyPoint'
import { useWorkspace } from '../state/workspace'

const LANE_H = 56
const LABEL_W = 96

/**
 * Linha do tempo em faixas: uma faixa por personagem, grupo ou lugar; eras no fundo; setas de causa →
 * consequência; arrastar um evento para o lado muda o ano; a linha da régua mostra onde a história está.
 */
export function TimelineLanes({ events, eras, onOpen }: { events: TimelineEvent[]; eras: TimelineEvent[]; onOpen: (id: string) => void }) {
  const { universe, undoable } = useWorkspace()
  const [point] = useStoryPoint(universe.id)
  const suffix = universe.settings.calendarSuffix
  const [by, setBy] = useState<LaneBy>('personagem')
  const [drag, setDrag] = useState<{ id: string; x: number; dy: number } | null>(null)
  const moved = useRef(false)
  const lanes = lanesOf(universe, events, by)
  const nowYear = storyYear(universe, point.sceneId)
  const years = [...events.map((e) => e.year), ...events.map((e) => e.endYear ?? e.year), ...eras.flatMap((e) => [e.year, e.endYear ?? e.year]), ...(nowYear !== null ? [nowYear] : [])]
  const minY = Math.min(...years)
  const maxY = Math.max(...years)
  const span = Math.max(1, maxY - minY)
  // Cada ano ganha pelo menos 2 px e a faixa toda pelo menos 640 px; um ano longo demais vira rolagem.
  const pxYear = Math.max(2, Math.min(60, 640 / span))
  const width = Math.ceil(span * pxYear) + 230
  const xOf = (year: number) => 60 + (year - minY) * pxYear
  const previewYear = (ev: TimelineEvent) => (drag?.id === ev.id ? ev.year + Math.round(drag.dy / pxYear) : ev.year)
  const wrong = outOfOrder(events)
  // Na mesma faixa, eventos perto um do outro vão para a linha de cima ou de baixo (o nome não cobre o outro).
  const yIn = new Map<string, number>()
  lanes.forEach((l, li) => {
    const ends = [-Infinity, -Infinity]
    for (const ev of l.events) {
      const x = xOf(previewYear(ev))
      const row = ends[0] <= x ? 0 : ends[1] <= x ? 1 : ends[0] <= ends[1] ? 0 : 1
      ends[row] = x + Math.min(150, 24 + ev.title.length * 6)
      yIn.set(`${l.id}${ev.id}`, li * LANE_H + (row === 0 ? 18 : 40))
    }
  })
  // Onde cada evento aparece primeiro (para as setas).
  const firstAt = new Map<string, { x: number; y: number }>()
  lanes.forEach((l) =>
    l.events.forEach((ev) => {
      if (!firstAt.has(ev.id)) firstAt.set(ev.id, { x: xOf(previewYear(ev)), y: yIn.get(`${l.id}${ev.id}`)! })
    }),
  )
  const arrows = events.flatMap((ev) => (ev.causes ?? []).map((c) => ({ from: firstAt.get(c), to: firstAt.get(ev.id), key: `${c}>${ev.id}` }))).filter((a) => a.from && a.to)
  const height = lanes.length * LANE_H
  // Ao abrir (e ao trocar as faixas), rola até onde a história está ou até o evento mais recente.
  const scroller = useRef<HTMLDivElement>(null)
  const focusYear = nowYear ?? Math.max(...events.map((e) => e.year))
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollLeft = Math.max(0, LABEL_W + xOf(focusYear) - el.clientWidth * 0.6)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [by, focusYear])

  return (
    <section className="lanes" aria-label="Linha do tempo em faixas">
      <div className="chips" role="radiogroup" aria-label="Faixas de">
        {(Object.keys(LANE_LABEL) as LaneBy[]).map((k) => (
          <button key={k} type="button" role="radio" className="chip" aria-checked={by === k} onClick={() => setBy(k)}>
            {LANE_LABEL[k]}
          </button>
        ))}
      </div>
      {wrong.length > 0 && (
        <ul className="atlas-fast small" aria-label="Fora de ordem">
          {wrong.map((w) => (
            <li key={`${w.cause.id}${w.effect.id}`}>
              <TriangleAlert size={14} aria-hidden="true" /> “{w.effect.title}” ({formatYear(w.effect.year, suffix)}) vem antes da sua causa, “{w.cause.title}” ({formatYear(w.cause.year, suffix)}).
            </li>
          ))}
        </ul>
      )}
      {lanes.length === 0 ? (
        <p className="muted small">Nenhum evento para mostrar em faixas.</p>
      ) : (
        <div className="lanes-scroll" ref={scroller}>
          <div className="lanes-names" style={{ width: LABEL_W }}>
            {lanes.map((l) => (
              <div key={l.id || 'mundo'} className="lane-name" style={{ height: LANE_H }} title={l.name}>
                {l.name}
              </div>
            ))}
          </div>
          <div className="lanes-track" style={{ minWidth: width, height: height + 26 }}>
            {eras.map((era) => (
              <div key={era.id} className="lane-era" style={{ left: xOf(era.year), width: Math.max(4, ((era.endYear ?? era.year) - era.year) * pxYear), height }} title={era.title}>
                <span>{era.title}</span>
              </div>
            ))}
            {lanes.map((l, li) => (
              <div key={l.id || 'mundo'} className="lane-row" style={{ top: li * LANE_H, height: LANE_H }} />
            ))}
            <svg className="lane-arrows" width={width} height={height} aria-hidden="true">
              <defs>
                <marker id="lane-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" />
                </marker>
              </defs>
              {arrows.map((a) => {
                const { x: x1, y: y1 } = a.from!
                const { x: x2, y: y2 } = a.to!
                const mid = (x1 + x2) / 2
                return <path key={a.key} d={`M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2 - 6},${y2}`} markerEnd="url(#lane-arrow)" />
              })}
            </svg>
            {lanes.map((l) =>
              l.events.map((ev) => {
                const y = previewYear(ev)
                return (
                  <button
                    key={`${l.id}${ev.id}`}
                    type="button"
                    className={`lane-event imp-${ev.importance}${drag?.id === ev.id ? ' is-dragging' : ''}`}
                    style={{ left: xOf(y), top: yIn.get(`${l.id}${ev.id}`) }}
                    aria-label={`${ev.title}, ${formatYear(y, suffix)}`}
                    title={`${ev.title} (${formatYear(y, suffix)}). Arraste para mudar o ano.`}
                    onPointerDown={(e) => {
                      moved.current = false
                      ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
                      setDrag({ id: ev.id, x: e.clientX, dy: 0 })
                    }}
                    onPointerMove={(e) => {
                      if (!drag || drag.id !== ev.id) return
                      const dy = e.clientX - drag.x
                      if (Math.abs(dy) > 6) moved.current = true
                      if (moved.current) setDrag({ ...drag, dy })
                    }}
                    onPointerUp={() => {
                      if (!drag) return
                      const next = previewYear(ev)
                      setDrag(null)
                      if (moved.current && next !== ev.year) {
                        const shift = next - ev.year
                        undoable(`“${ev.title}”: ${formatYear(ev.year, suffix)} → ${formatYear(next, suffix)}`, (u) => patch(u, 'events', ev.id, { year: next, endYear: ev.endYear === null ? null : ev.endYear + shift }))
                      }
                    }}
                    onPointerCancel={() => setDrag(null)}
                    onClick={() => {
                      if (!moved.current) onOpen(ev.id)
                    }}
                  >
                    <span className="lane-dot" aria-hidden="true" />
                    <span className="lane-label">
                      {ev.title}
                      {drag?.id === ev.id && <strong> {formatYear(y, suffix)}</strong>}
                    </span>
                  </button>
                )
              }),
            )}
            {nowYear !== null && (
              <div className="lane-now" style={{ left: xOf(nowYear), height }} title="Onde a história está (régua da história)">
                <span>A história: {formatYear(nowYear, suffix)}</span>
              </div>
            )}
            <span className="lane-axis" style={{ left: xOf(minY), top: height + 4 }}>
              {formatYear(minY, suffix)}
            </span>
            <span className="lane-axis lane-axis-end" style={{ left: xOf(maxY), top: height + 4 }}>
              {formatYear(maxY, suffix)}
            </span>
          </div>
        </div>
      )}
      <p className="tiny muted">Arraste um evento para o lado para mudar o ano. As setas vão da causa para a consequência (no evento, “Causado por”).</p>
    </section>
  )
}
