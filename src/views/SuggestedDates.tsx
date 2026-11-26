import { CalendarPlus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { suggestDates, type SuggestedDate } from '../logic/suggestDates'
import { formatYear } from '../model/labels'
import { draftEvent, insert } from '../model/universe'
import { recall, remember } from '../state/prefs'
import { useWorkspace } from '../state/workspace'
import { Modal } from '../ui/Modal'

/*
 * “Achei N anos escritos nas fichas” (auditoria 26, Duda): “a tempestade de 340” vira um evento na Linha do tempo,
 * ligado à ficha, se o autor quiser. O título vem da frase e pode ser trocado antes. Os recusados não voltam.
 */
const keyOf = (s: SuggestedDate) => `${s.entityId}:${s.year}`

export function SuggestedDates() {
  const { universe, undoable, readOnly } = useWorkspace()
  const storeKey = `datas-recusadas:${universe.id}`
  const [refused, setRefused] = useState<string[]>(() => {
    try {
      return JSON.parse(recall(storeKey) ?? '[]') as string[]
    } catch {
      return []
    }
  })
  const all = useMemo(() => suggestDates(universe).filter((s) => !refused.includes(keyOf(s))), [universe, refused])
  const [open, setOpen] = useState(false)
  const [off, setOff] = useState<Set<string>>(new Set())
  const [titles, setTitles] = useState<Record<string, string>>({})
  if (readOnly || all.length === 0) return null
  const name = (id: string) => universe.entities.find((e) => e.id === id)?.name ?? '?'
  const suffix = universe.settings.calendarSuffix
  const chosen = all.filter((s) => !off.has(keyOf(s)))
  return (
    <>
      <div className="suggested-links" role="region" aria-label="Anos achados no texto">
        <CalendarPlus size={16} aria-hidden="true" />
        <span className="small">
          Achei <strong>{all.length === 1 ? '1 ano' : `${all.length} anos`}</strong> escritos nas suas fichas. Quer pôr na linha do tempo?
        </span>
        <button type="button" className="btn btn-sm btn-primary" onClick={() => setOpen(true)}>
          Ver e escolher
        </button>
      </div>
      {open && (
        <Modal
          title="Anos achados no texto"
          about="O Papirus achou anos nas fichas (como “a tempestade de 340”). Cada um vira um evento na Linha do tempo, ligado à ficha. Troque o título se quiser; os que você desmarcar não voltam a aparecer."
          onClose={() => setOpen(false)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
                Agora não
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={chosen.length === 0}
                onClick={() => {
                  const recusados = all.filter((s) => off.has(keyOf(s))).map(keyOf)
                  if (recusados.length) {
                    const next = [...refused, ...recusados]
                    setRefused(next)
                    remember(storeKey, JSON.stringify(next))
                  }
                  undoable(chosen.length === 1 ? '1 evento na linha do tempo' : `${chosen.length} eventos na linha do tempo`, (u) =>
                    chosen.reduce(
                      (acc, s) => insert(acc, 'events', { ...draftEvent((titles[keyOf(s)] ?? s.title).trim() || s.title, s.year), entityIds: [s.entityId] })[0],
                      u,
                    ),
                  )
                  setOpen(false)
                  setOff(new Set())
                }}
              >
                {chosen.length === 1 ? 'Pôr 1 evento' : `Pôr ${chosen.length} eventos`}
              </button>
            </>
          }
        >
          <ul className="suggested-list">
            {all.map((s) => (
              <li key={keyOf(s)}>
                <label>
                  <input
                    type="checkbox"
                    checked={!off.has(keyOf(s))}
                    onChange={() =>
                      setOff((o) => {
                        const n = new Set(o)
                        if (n.has(keyOf(s))) n.delete(keyOf(s))
                        else n.add(keyOf(s))
                        return n
                      })
                    }
                  />
                  <span>
                    <strong className="tabular">{formatYear(s.year, suffix)}</strong> · {name(s.entityId)}
                    <span className="tiny muted suggested-quote">“{s.quote}”</span>
                  </span>
                </label>
                <input
                  className="input input-sm suggested-title"
                  aria-label={`Título do evento de ${formatYear(s.year, suffix)}`}
                  value={titles[keyOf(s)] ?? s.title}
                  onChange={(e) => setTitles((t) => ({ ...t, [keyOf(s)]: e.target.value }))}
                />
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </>
  )
}
