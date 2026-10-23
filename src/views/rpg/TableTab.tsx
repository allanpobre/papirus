import { Dices, Maximize2, Minimize2, Minus, Play, Plus, Send } from 'lucide-react'
import { useEffect, useState } from 'react'
import { DiceError, roll } from '../../logic/dice'
import type { RandomTable, Sheet } from '../../model/schema'
import { draftSession, insert, patch } from '../../model/universe'
import { resolveRoll, rollAttribute } from '../../rpg/rolls'
import { adjustResource } from '../../rpg/sheets'
import { makeSystem } from '../../rpg/systems'
import { useWorkspace } from '../../state/workspace'
import { InitiativeTracker } from './InitiativeTracker'
import { useRpg } from './rpgContext'

const QUICK = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']
const FALLBACK_SYSTEM = makeSystem('narrativo')

/**
 * "Na mesa": tudo o que se usa durante o jogo numa tela só, com botões grandes
 * para tablet e celular. Iniciativa, grupo, dados, tabelas e o registro.
 */
export function TableTab() {
  const { universe, update } = useWorkspace()
  const { group, activeSession } = useRpg()
  const [full, setFull] = useState(false)

  useEffect(() => {
    const onChange = () => setFull(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen?.().catch(() => undefined)
  }

  if (!activeSession) {
    const sessions = universe.sessions.filter((s) => s.groupId === group.id).sort((a, b) => a.number - b.number)
    const planned = sessions.find((s) => s.status === 'planejada')
    const start = () =>
      update((u) => {
        if (planned) return patch(u, 'sessions', planned.id, { status: 'em-andamento' })
        const [next, s] = insert(u, 'sessions', draftSession((sessions.at(-1)?.number ?? 0) + 1, group.id))
        return patch(next, 'sessions', s.id, { status: 'em-andamento' })
      })
    return (
      <div className="table-start">
        <p className="lede">Nenhuma sessão em andamento para {group.name}.</p>
        <button type="button" className="btn btn-primary btn-lg" onClick={start}>
          <Play size={18} /> {planned ? `Começar “${planned.title}”` : `Começar a sessão ${(sessions.at(-1)?.number ?? 0) + 1}`}
        </button>
        <p className="muted small">Na mesa, as rolagens e anotações vão direto para o registro da sessão.</p>
      </div>
    )
  }

  return (
    <div className="table-mode">
      <div className="table-mode-bar">
        <span className="eyebrow">Na mesa</span>
        <strong className="table-mode-title">{activeSession.title}</strong>
        <span className="muted small">{group.name}</span>
        <button type="button" className="btn btn-ghost btn-sm table-full" onClick={toggleFull}>
          {full ? <Minimize2 size={14} /> : <Maximize2 size={14} />} {full ? 'Sair da tela cheia' : 'Tela cheia'}
        </button>
      </div>
      <div className="table-grid">
        <div className="table-panel table-initiative">
          <InitiativeTracker session={activeSession} />
        </div>
        <section className="table-panel" aria-label="Grupo">
          <h2 className="section-title">Grupo</h2>
          <PartyCards />
        </section>
        <section className="table-panel" aria-label="Dados">
          <h2 className="section-title">Dados</h2>
          <QuickDice />
          <TableRolls />
        </section>
        <section className="table-panel" aria-label="Registro">
          <h2 className="section-title">Registro</h2>
          <LogBox />
        </section>
      </div>
    </div>
  )
}

function PartyCards() {
  const { universe, update } = useWorkspace()
  const { group, report } = useRpg()
  const party = universe.sheets.filter((s) => s.groupId === group.id && s.role === 'pj')
  if (!party.length) return <p className="muted small">Nenhum personagem de jogador nesta mesa. Crie em Personagens.</p>
  const set = (s: Sheet, c: Partial<Sheet>) => update((u) => patch(u, 'sheets', s.id, c))

  return (
    <ul className="pc-cards">
      {party.map((s) => {
        const system = universe.systems.find((x) => x.id === s.systemId)
        return (
          <li key={s.id} className="pc-card">
            <div className="pc-card-head">
              <strong>{s.name}</strong>
              {s.player && <span className="muted tiny">{s.player}</span>}
            </div>
            {system?.features.resources &&
              system.resources.map((def) => {
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
          </li>
        )
      })}
    </ul>
  )
}

function QuickDice() {
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

function TableRolls() {
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

function LogBox() {
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
