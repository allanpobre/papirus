import { Dices, Minus, Plus, ScrollText, Send } from 'lucide-react'
import { useState } from 'react'
import { DiceError, roll } from '../../logic/dice'
import type { RandomTable, Sheet } from '../../model/schema'
import { patch } from '../../model/universe'
import { resolveRoll, rollAttribute } from '../../rpg/rolls'
import { adjustResource, isPool } from '../../rpg/sheets'
import { makeSystem } from '../../rpg/systems'
import { attendanceOf } from '../../rpg/sessionLife'
import { useWorkspace } from '../../state/workspace'
import { AttendanceSelect } from './Attendance'
import { useRpg } from './rpgContext'

/*
 * As peças da mesa usadas no modo sessão: o grupo, os dados, as tabelas e o registro.
 */
const QUICK = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']
const FALLBACK_SYSTEM = makeSystem('narrativo')

/** Os personagens de jogador na mesa. Com `onSheet`, cada cartão abre a ficha completa. */
export function PartyCards({ onSheet }: { onSheet?: (sheetId: string) => void } = {}) {
  const { universe, update } = useWorkspace()
  const { group, report, activeSession } = useRpg()
  const party = universe.sheets.filter((s) => s.groupId === group.id && s.role === 'pj')
  if (!party.length) return <p className="muted small">Nenhum personagem de jogador nesta mesa. Crie em Personagens.</p>
  const set = (s: Sheet, c: Partial<Sheet>) => update((u) => patch(u, 'sheets', s.id, c))
  // Quem não veio: o mestre conduz o personagem (continua aqui) ou ele fica de fora (vai para o fim, recolhido).
  const out = party.filter((s) => attendanceOf(activeSession, s.id) === 'fora')

  return (
    <>
      <ul className="pc-cards">
        {party.filter((s) => attendanceOf(activeSession, s.id) !== 'fora').map((s) => {
          const system = universe.systems.find((x) => x.id === s.systemId)
          const gm = attendanceOf(activeSession, s.id) === 'mestre'
          return (
            <li key={s.id} className={`pc-card${gm ? ' is-gm' : ''}`}>
              <div className="pc-card-head">
                <strong>{s.name}</strong>
                {s.player && !gm && <span className="muted tiny">{s.player}</span>}
                {gm && <span className="pc-gm-tag">mestre conduz</span>}
                {onSheet && system && (
                  <button type="button" className="btn btn-ghost btn-xs pc-sheet" aria-label={`Ficha de ${s.name}`} onClick={() => onSheet(s.id)}>
                    <ScrollText size={13} /> Ficha
                  </button>
                )}
                {system?.resources
                  .filter((d) => !isPool(d))
                  .map((d) => (
                    <span key={d.id} className="pc-value" title={d.name}>
                      {d.abbr} <strong className="tabular">{(s.resources[d.id] ?? { current: d.default }).current}</strong>
                    </span>
                  ))}
              </div>
              {system?.features.resources &&
                system.resources.filter(isPool).map((def) => {
                  const r = s.resources[def.id] ?? { current: def.default, max: def.default }
                  const pct = r.max > 0 ? Math.max(0, Math.min(100, (r.current / r.max) * 100)) : 0
                  const change = (d: number) => set(s, { resources: adjustResource({ ...s, resources: { ...s.resources, [def.id]: r } }, def.id, d) })
                  return (
                    <div key={def.id} className={`pc-res${r.max > 0 && r.current <= 0 ? ' resource-empty' : ''}`}>
                      <button type="button" className="btn-icon pc-step" aria-label={`${s.name}: menos 1 ${def.abbr}`} onClick={() => change(-1)}>
                        <Minus size={16} />
                      </button>
                      <span className="pc-res-mid">
                        <span className="pc-res-label">
                          <span>{def.abbr}</span>
                          <span className="tabular">
                            {r.current}/{r.max}
                          </span>
                        </span>
                        <span className="resource-bar" aria-hidden="true">
                          <span style={{ width: `${pct}%` }} />
                        </span>
                      </span>
                      <button type="button" className="btn-icon pc-step" aria-label={`${s.name}: mais 1 ${def.abbr}`} onClick={() => change(1)}>
                        <Plus size={16} />
                      </button>
                    </div>
                  )
                })}
              {system && system.attributes.length > 0 && (
                <div className="pc-rolls">
                  {system.attributes.map((a) => (
                    <button key={a.id} type="button" className="chip" title={`Rolar ${a.name}`} onClick={() => report(rollAttribute(system, s, a.id), s.name)}>
                      {a.abbr}
                    </button>
                  ))}
                </div>
              )}
              {system?.features.conditions && system.conditions.length > 0 && (
                <details className="pc-conditions">
                  <summary className="small">{s.conditions.length ? s.conditions.join(', ') : 'Condições'}</summary>
                  <div className="chips">
                    {system.conditions.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className="chip chip-condition"
                        aria-pressed={s.conditions.includes(c)}
                        onClick={() => set(s, { conditions: s.conditions.includes(c) ? s.conditions.filter((x) => x !== c) : [...s.conditions, c] })}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </details>
              )}
              {activeSession && (
                <div className="pc-card-foot">
                  <AttendanceSelect session={activeSession} sheet={s} />
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {out.length > 0 && activeSession && (
        <div className="pc-out">
          <h3 className="section-label">De fora nesta sessão</h3>
          <ul className="plain-list">
            {out.map((s) => (
              <li key={s.id} className="pc-out-row">
                <span>
                  {s.name} {s.player && <span className="muted tiny">{s.player}</span>}
                </span>
                <AttendanceSelect session={activeSession} sheet={s} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

export function QuickDice() {
  const { system, report } = useRpg()
  const [expr, setExpr] = useState('')
  const [error, setError] = useState<string | null>(null)
  const run = (e: string) => {
    try {
      report(resolveRoll(system ?? FALLBACK_SYSTEM, 'Rolagem', e.replace(/\s+/g, '')))
      setError(null)
    } catch (err) {
      setError(err instanceof DiceError ? err.message : 'Rolagem inválida.')
    }
  }
  return (
    <>
      <div className="dice-quick table-dice">
        {QUICK.map((d) => (
          <button key={d} type="button" className="die" onClick={() => run(d)}>
            {d}
          </button>
        ))}
      </div>
      <form
        className="inline-fields"
        onSubmit={(e) => {
          e.preventDefault()
          if (expr.trim()) run(expr)
        }}
      >
        <label htmlFor="mesa-expr" className="sr-only">
          Rolagem
        </label>
        <input id="mesa-expr" className="input" placeholder="2d6+3" spellCheck={false} value={expr} onChange={(e) => setExpr(e.target.value)} />
        <button type="submit" className="btn btn-primary">
          <Dices size={16} /> Rolar
        </button>
      </form>
      {error && (
        <p className="notice notice-error small" role="alert">
          {error}
        </p>
      )}
    </>
  )
}

export function TableRolls() {
  const { universe } = useWorkspace()
  const { logText } = useRpg()
  const [last, setLast] = useState<{ table: string; pick: string } | null>(null)
  const tables = universe.tables.filter((t) => t.entries.some((e) => e.trim()))
  if (!tables.length) return null
  const rollTable = (t: RandomTable) => {
    const entries = t.entries.filter((e) => e.trim())
    const pick = entries[Math.min(entries.length, roll(`1d${Math.max(2, entries.length)}`).total) - 1]
    setLast({ table: t.name, pick })
    logText(`${t.name}: ${pick}`, 'rolagem')
  }
  return (
    <div className="table-tables">
      <h3 className="section-label">Tabelas</h3>
      <div className="chips">
        {tables.map((t) => (
          <button key={t.id} type="button" className="chip" onClick={() => rollTable(t)}>
            {t.name}
          </button>
        ))}
      </div>
      {last && (
        <p className="table-result" aria-live="polite">
          <span className="muted small">{last.table}:</span> {last.pick}
        </p>
      )}
    </div>
  )
}

export function LogBox() {
  const { activeSession, logText } = useRpg()
  const [text, setText] = useState('')
  const log = activeSession?.log ?? []
  const send = () => {
    if (text.trim() && logText(text.trim())) setText('')
  }
  return (
    <>
      <form
        className="inline-fields"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <label htmlFor="mesa-nota" className="sr-only">
          Anotar no registro
        </label>
        <input id="mesa-nota" className="input" placeholder="O que aconteceu…" value={text} onChange={(e) => setText(e.target.value)} />
        <button type="submit" className="btn btn-primary" aria-label="Anotar" disabled={!text.trim()}>
          <Send size={16} />
        </button>
      </form>
      <ol className="log table-log">
        {[...log]
          .reverse()
          .slice(0, 12)
          .map((l) => (
            <li key={l.id} className={l.kind === 'rolagem' ? 'log-roll' : undefined}>
              <span className="log-at tabular">{l.at}</span>
              <span className="log-text">{l.text}</span>
            </li>
          ))}
      </ol>
    </>
  )
}
