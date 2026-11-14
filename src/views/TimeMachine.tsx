import { Hourglass, Minus, Plus, X } from 'lucide-react'
import { useMemo } from 'react'
import { ageLabel } from '../logic/age'
import { worldAt, worldBounds } from '../logic/timeMachine'
import { formatYear, kindLabel } from '../model/labels'
import { useWorkspace } from '../state/workspace'
import { useChosenYear } from './timeYear'

/**
 * Máquina do tempo: arraste os anos e veja o mundo naquele momento — quem vivia (com a idade),
 * quem mandava em quê, o que existia, o que acontecia. Os Mapas apagam o que não existia.
 */
export function TimeMachine() {
  const { universe, go } = useWorkspace()
  const bounds = useMemo(() => worldBounds(universe), [universe])
  const [year, setYear] = useChosenYear(universe.id)
  const suffix = universe.settings.calendarSuffix
  const shown = year ?? bounds?.min ?? 0
  const at = useMemo(() => (year === null ? null : worldAt(universe, year)), [universe, year])
  if (!bounds) return null
  const fy = (y: number) => formatYear(y, suffix)

  return (
    <section className="time-machine" aria-labelledby="maquina-titulo">
      <header className="time-machine-head">
        <h2 id="maquina-titulo">
          <Hourglass size={16} aria-hidden="true" /> Máquina do tempo
        </h2>
        {year !== null && (
          <button type="button" className="btn btn-sm time-machine-exit" onClick={() => setYear(null)}>
            <X size={14} aria-hidden="true" /> Sair do ano
          </button>
        )}
      </header>
      <div className="time-machine-ctrl">
        <span className="tiny muted tabular">{fy(bounds.min)}</span>
        <input
          type="range"
          className="time-machine-ruler"
          aria-label="Ano"
          min={bounds.min}
          max={bounds.max}
          value={shown}
          onChange={(e) => setYear(Number(e.target.value))}
        />
        <span className="tiny muted tabular">{fy(bounds.max)}</span>
        <div className="time-machine-steps">
          <button type="button" className="btn-icon time-machine-step" aria-label="Um ano antes" onClick={() => setYear(Math.max(bounds.min, shown - 1))}>
            <Minus size={18} />
          </button>
          <input
            className="input time-machine-year tabular"
            type="number"
            inputMode="numeric"
            aria-label="Ir para o ano"
            value={year ?? ''}
            placeholder="Ano"
            onChange={(e) => setYear(e.target.value === '' ? null : Number(e.target.value))}
          />
          <button type="button" className="btn-icon time-machine-step" aria-label="Um ano depois" onClick={() => setYear(Math.min(bounds.max, shown + 1))}>
            <Plus size={18} />
          </button>
        </div>
      </div>
      {at === null ? (
        <p className="muted small">Arraste a régua para ver o mundo num ano: quem vivia e com que idade, quem mandava, o que existia. As Fichas e os Mapas também mostram só o que existia nele.</p>
      ) : (
        <div className="time-machine-out">
          <p className="time-machine-year-label">
            <strong>{fy(year!)}</strong>
          </p>
          {at.rulers.length > 0 && (
            <div>
              <h3>Quem mandava</h3>
              <ul>
                {at.rulers.map((r, i) => (
                  <li key={i}>
                    <button type="button" className="link-btn" onClick={() => go('fichas', r.ruler.id)}>
                      {r.ruler.name}
                    </button>{' '}
                    {r.type}{' '}
                    <button type="button" className="link-btn" onClick={() => go('fichas', r.realm.id)}>
                      {r.realm.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <h3>Quem vivia</h3>
            {at.alive.length ? (
              <ul className="time-machine-people">
                {at.alive.map(({ entity: e, age }) => (
                  <li key={e.id}>
                    <button type="button" className="link-btn" onClick={() => go('fichas', e.id)}>
                      {e.name}
                    </button>
                    {age !== null && <span className="muted"> · {ageLabel(age)}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">Ninguém com data de nascimento estava vivo.</p>
            )}
          </div>
          {at.standing.length > 0 && (
            <div>
              <h3>O que existia</h3>
              <p className="small">{at.standing.map((e) => `${e.name} (${kindLabel(e.kind).toLocaleLowerCase('pt-BR')})`).join(' · ')}</p>
            </div>
          )}
          {at.events.length > 0 && (
            <div>
              <h3>Acontecendo</h3>
              <ul>
                {at.events.map((ev) => (
                  <li key={ev.id}>{ev.title || 'Sem título'}</li>
                ))}
              </ul>
            </div>
          )}
          {(at.notYet.length > 0 || at.gone.length > 0) && (
            <p className="muted small">
              {at.notYet.length > 0 && `Ainda por vir: ${at.notYet.map((e) => e.name).join(', ')}. `}
              {at.gone.length > 0 && `Já não existiam: ${at.gone.map((e) => e.name).join(', ')}.`}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
