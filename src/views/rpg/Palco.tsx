import { Eye, EyeOff, Minus, Plus, Timer, X } from 'lucide-react'
import { useState } from 'react'
import type { Session } from '../../model/schema'
import { addClock, CLOCK_SIZES, currentBeat, editClock, removeClock, tickClock } from '../../rpg/stage'
import { useWorkspace } from '../../state/workspace'
import { ClockFace } from '../../ui/ClockFace'
import { InitiativeTracker } from './InitiativeTracker'
import { RequestsPanel } from './Requests'
import { useRpg } from './rpgContext'

/**
 * O palco (o painel do meio do escudo): o que está acontecendo e o que os jogadores veem.
 * A cena atual com o clima, os relógios, os testes pedidos e o combate.
 */
export function Palco({ session, onRoteiro }: { session: Session; onRoteiro?: () => void }) {
  const beat = currentBeat(session)
  return (
    <section className="shield-panel shield-palco" aria-label="Palco">
      <header className="shield-head">
        <h2 className="shield-title">Palco</h2>
        <span className="muted tiny">o que os jogadores veem</span>
      </header>
      <div className={`stage-card${beat ? '' : ' is-empty'}`} role="group" aria-label="Cena atual">
        <span className="stage-kick">Cena atual</span>
        {beat ? (
          <>
            <strong className="stage-title">{beat.title}</strong>
            {beat.mood && <span className="stage-mood">{beat.mood}</span>}
          </>
        ) : (
          <span className="stage-mood">
            Nenhuma cena escolhida.{' '}
            {onRoteiro ? (
              <button type="button" className="link-btn" onClick={onRoteiro}>
                Escolher no Roteiro
              </button>
            ) : (
              'Toque numa cena do Roteiro para começar.'
            )}
          </span>
        )}
      </div>
      <Clocks />
      <RequestsPanel />
      <div className="table-panel sm-combate">
        <InitiativeTracker session={session} />
      </div>
    </section>
  )
}

/** Os relógios da mesa: um toque enche um pedaço; o olho esconde dos jogadores. */
export function Clocks() {
  const { update, readOnly } = useWorkspace()
  const { group } = useRpg()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [size, setSize] = useState<number>(4)
  return (
    <div className="clocks" role="group" aria-label="Relógios">
      {group.clocks.map((c) => (
        <div key={c.id} className={`clock-chip${c.filled >= c.size ? ' is-full' : ''}${c.hidden ? ' is-hidden' : ''}`}>
          <ClockFace size={c.size} filled={c.filled} />
          <span className="clock-text">
            <strong>{c.name}</strong>
            <span className="muted tiny">
              {c.filled} de {c.size}
              {c.hidden ? ' · só você vê' : ''}
            </span>
          </span>
          {!readOnly && (
            <span className="clock-acts">
              <button type="button" className="btn-icon btn-xs" aria-label={`Esvaziar um pedaço de ${c.name}`} onClick={() => update((u) => tickClock(u, group.id, c.id, -1))}>
                <Minus size={12} />
              </button>
              <button type="button" className="btn-icon btn-xs" aria-label={`Encher um pedaço de ${c.name}`} onClick={() => update((u) => tickClock(u, group.id, c.id, 1))}>
                <Plus size={12} />
              </button>
              <button
                type="button"
                className="btn-icon btn-xs"
                aria-label={c.hidden ? `Mostrar ${c.name} aos jogadores` : `Esconder ${c.name} dos jogadores`}
                onClick={() => update((u) => editClock(u, group.id, c.id, { hidden: !c.hidden }))}
              >
                {c.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>
              <button type="button" className="btn-icon btn-xs" aria-label={`Tirar o relógio ${c.name}`} onClick={() => update((u) => removeClock(u, group.id, c.id))}>
                <X size={12} />
              </button>
            </span>
          )}
        </div>
      ))}
      {!readOnly &&
        (adding ? (
          <form
            className="clock-add"
            onSubmit={(e) => {
              e.preventDefault()
              if (!name.trim()) return
              update((u) => addClock(u, group.id, name, size))
              setName('')
              setAdding(false)
            }}
          >
            <label htmlFor="relogio-nome" className="sr-only">
              Nome do relógio
            </label>
            <input id="relogio-nome" className="input input-sm" autoFocus placeholder="A guarda chega…" value={name} onChange={(e) => setName(e.target.value)} />
            <div className="segmented" role="radiogroup" aria-label="Pedaços">
              {CLOCK_SIZES.map((n) => (
                <button key={n} type="button" role="radio" aria-checked={size === n} onClick={() => setSize(n)}>
                  {n}
                </button>
              ))}
            </div>
            <button type="submit" className="btn btn-sm btn-primary" disabled={!name.trim()}>
              Criar
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setAdding(false)}>
              Cancelar
            </button>
          </form>
        ) : (
          <button type="button" className="btn btn-sm btn-ghost clock-new" onClick={() => setAdding(true)}>
            <Timer size={14} /> Relógio
          </button>
        ))}
    </div>
  )
}
