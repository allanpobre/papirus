import { CalendarHeart, Check, Plus, Sun, X } from 'lucide-react'
import { useState } from 'react'
import { CULTURE_CARDS, dayInLife } from '../logic/culture'
import { answer, answerOf } from '../logic/kindQuestions'
import type { Entity } from '../model/schema'
import { newId, patch } from '../model/universe'
import { useWorkspace } from '../state/workspace'
import { Fold } from '../ui/Fold'

/**
 * Oficina da cultura: cartas de pergunta sobre o dia a dia (a resposta vira campo da ficha), "Um dia na vida"
 * montado com as respostas e as festas de todo ano (que aparecem na Linha do tempo). Só em fichas de cultura.
 */
export function CultureWorkshop({ entity: e }: { entity: Entity }) {
  const { universe, update, toast } = useWorkspace()
  const [open, setOpen] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [feast, setFeast] = useState({ name: '', month: '', day: '', about: '' })
  if (e.kind !== 'cultura') return null
  const months = universe.settings.calendarMonths
  const save = (key: string, value: string) => update((u) => patch(u, 'entities', e.id, { fields: answer(e.fields, key, value) }))
  const answered = CULTURE_CARDS.filter((c) => answerOf(e.fields, c.key).trim()).length
  const day = dayInLife(e, universe)
  const card = CULTURE_CARDS.find((c) => c.key === open)
  const feasts = e.feasts ?? []
  return (
    <div className="culture-workshop">
      <Fold id="ficha-cultura-viva" title={`Oficina da cultura (${answered}/${CULTURE_CARDS.length})`} defaultOpen={answered > 0}>
        <p className="muted small">Toque numa carta e responda em uma linha. A resposta vira um campo da ficha.</p>
        <div className="culture-cards" role="group" aria-label="Cartas da cultura">
          {CULTURE_CARDS.map((c) => {
            const value = answerOf(e.fields, c.key).trim()
            return (
              <button
                key={c.key}
                type="button"
                className={`culture-card${value ? ' is-done' : ''}`}
                aria-expanded={open === c.key}
                onClick={() => {
                  setOpen(open === c.key ? null : c.key)
                  setDraft(value)
                }}
              >
                <strong>
                  {value && <Check size={12} aria-hidden="true" />} {c.key}
                </strong>
                <span>{value || c.ask}</span>
              </button>
            )
          })}
        </div>
        {card && (
          <form
            className="culture-answer"
            aria-label={card.ask}
            onSubmit={(ev) => {
              ev.preventDefault()
              save(card.key, draft.trim())
              setOpen(null)
            }}
          >
            <label className="small" htmlFor="culture-answer">
              <strong>{card.ask}</strong>
            </label>
            <div className="chips">
              {card.ideas.map((idea) => (
                <button key={idea} type="button" className="chip" onClick={() => setDraft(idea)}>
                  {idea}
                </button>
              ))}
            </div>
            <input id="culture-answer" className="input" value={draft} placeholder="Ou escreva a sua" onChange={(ev) => setDraft(ev.target.value)} autoFocus />
            <div className="row">
              <button type="submit" className="btn btn-primary btn-sm">
                Guardar
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(null)}>
                Cancelar
              </button>
            </div>
          </form>
        )}

        <h4 className="lang-h">
          <Sun size={14} aria-hidden="true" /> Um dia na vida
        </h4>
        {day ? (
          <>
            <p className="culture-day">{day}</p>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                update((u) => patch(u, 'entities', e.id, { description: e.description.trim() ? `${e.description.trimEnd()}\n\n${day}` : day }))
                toast('Posto no fim da descrição: mude como quiser.')
              }}
            >
              Pôr na descrição
            </button>
          </>
        ) : (
          <p className="muted small">Responda duas cartas ou mais e o dia aparece aqui.</p>
        )}

        <h4 className="lang-h">
          <CalendarHeart size={14} aria-hidden="true" /> Festas de todo ano
        </h4>
        {feasts.length > 0 && (
          <ul className="lang-dict" aria-label="Festas">
            {feasts.map((f) => (
              <li key={f.id}>
                <strong>{f.name}</strong>
                <span className="muted small">
                  {f.month !== undefined && months[f.month] ? `${f.day ? `${f.day} de ` : ''}${months[f.month].name}` : ''}
                  {f.about ? ` · ${f.about}` : ''}
                </span>
                <button type="button" className="btn btn-ghost btn-sm" aria-label={`Tirar ${f.name}`} onClick={() => update((u) => patch(u, 'entities', e.id, { feasts: feasts.filter((x) => x.id !== f.id) }))}>
                  <X size={13} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="culture-feast"
          onSubmit={(ev) => {
            ev.preventDefault()
            if (!feast.name.trim()) return
            const month = feast.month === '' ? undefined : Number(feast.month)
            const dayN = Number(feast.day) || undefined
            update((u) => patch(u, 'entities', e.id, { feasts: [...feasts, { id: newId(), name: feast.name.trim(), month, day: month === undefined ? undefined : dayN, about: feast.about.trim() }] }))
            setFeast({ name: '', month: '', day: '', about: '' })
          }}
        >
          <input className="input" aria-label="Nome da festa" placeholder="Festa da Primeira Chuva" value={feast.name} onChange={(ev) => setFeast({ ...feast, name: ev.target.value })} />
          {months.length > 0 && (
            <>
              <select className="input" aria-label="Mês da festa" value={feast.month} onChange={(ev) => setFeast({ ...feast, month: ev.target.value })}>
                <option value="">Sem mês</option>
                {months.map((m, i) => (
                  <option key={i} value={i}>
                    {m.name}
                  </option>
                ))}
              </select>
              <input className="input" aria-label="Dia da festa" type="number" min={1} placeholder="dia" value={feast.day} onChange={(ev) => setFeast({ ...feast, day: ev.target.value })} />
            </>
          )}
          <input className="input" aria-label="O que acontece" placeholder="O que acontece (todos saem descalços)" value={feast.about} onChange={(ev) => setFeast({ ...feast, about: ev.target.value })} />
          <button type="submit" className="btn btn-sm" disabled={!feast.name.trim()}>
            <Plus size={13} aria-hidden="true" /> Festa
          </button>
        </form>
        {months.length === 0 && <p className="tiny muted">Com um calendário próprio (Ajustes › Universo), as festas ganham mês e dia.</p>}
      </Fold>
    </div>
  )
}
