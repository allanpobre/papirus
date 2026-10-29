import { Dices, Flag, Maximize2, Megaphone, Minimize2, Minus, Play, Plus, Send, UserPlus, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { DiceError, roll } from '../../logic/dice'
import type { RandomTable, Sheet } from '../../model/schema'
import { patch } from '../../model/universe'
import { resolveRoll, rollAttribute } from '../../rpg/rolls'
import { adjustResource, isPool } from '../../rpg/sheets'
import { makeSystem } from '../../rpg/systems'
import { attendanceOf, sessionToStart } from '../../rpg/sessionLife'
import { useWorkspace } from '../../state/workspace'
import { ConfirmButton } from '../../ui/ConfirmButton'
import { InitiativeTracker } from './InitiativeTracker'
import { AnnounceDialog } from './Announce'
import { AttendanceSelect } from './Attendance'
import { PresenceList } from './LiveTable'
import { SecretsPanel } from './Secrets'
import { useRpg } from './rpgContext'

const QUICK = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']
const FALLBACK_SYSTEM = makeSystem('narrativo')

/**
 * "Na mesa": tudo o que se usa durante o jogo numa tela só, com botões grandes
 * para tablet e celular. Iniciativa, grupo, dados, tabelas e o registro.
 */
export function TableTab() {
  const { universe, readOnly } = useWorkspace()
  const { group, activeSession, startSession, endSession, invite } = useRpg()
  const [full, setFull] = useState(false)
  const [announcing, setAnnouncing] = useState(false)

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
    const next = sessionToStart(universe, group.id)
    return (
      <div className="table-start">
        <p className="lede">Nenhuma sessão em andamento para {group.name}.</p>
        <button type="button" className="btn btn-primary btn-lg" onClick={() => startSession(next.id ?? undefined)}>
          <Play size={18} /> {next.id ? `Começar “${next.title}”` : `Começar a sessão ${next.number}`}
        </button>
        <p className="muted small">Na mesa, as rolagens e anotações vão direto para o registro da sessão.</p>
        {!readOnly && (
          <section className="table-start-who" aria-labelledby="mesa-quem">
            <h2 id="mesa-quem" className="section-label">
              <Users size={14} aria-hidden="true" /> Quem já está na mesa
            </h2>
            <PresenceList groupId={group.id} empty={group.share ? 'Ninguém abriu o link ainda.' : 'Os jogadores podem acompanhar pelo celular, cada um com a sua ficha.'} />
            <button type="button" className="btn btn-sm" onClick={invite}>
              <UserPlus size={14} /> Convidar jogadores
            </button>
          </section>
        )}
      </div>
    )
  }

  return (
    <div className="table-mode">
      <div className="table-mode-bar">
        <span className="eyebrow">Na mesa</span>
        <strong className="table-mode-title">{activeSession.title}</strong>
        <span className="muted small">{group.name}</span>
        <span className="table-mode-acts">
          {!readOnly && (
            <button type="button" className="btn btn-primary btn-sm table-announce" onClick={() => setAnnouncing(true)}>
              <Megaphone size={14} /> Anunciar
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-sm table-full" onClick={toggleFull}>
            {full ? <Minimize2 size={14} /> : <Maximize2 size={14} />} {full ? 'Sair da tela cheia' : 'Tela cheia'}
          </button>
          {!readOnly && (
            <ConfirmButton className="btn btn-sm table-end" question="Encerrar a sessão?" confirmLabel="Encerrar" onConfirm={() => endSession(activeSession.id)}>
              <Flag size={14} /> Encerrar sessão
            </ConfirmButton>
          )}
        </span>
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
        <SecretsPanel />
        <section className="table-panel" aria-label="Registro">
          <h2 className="section-title">Registro</h2>
          <LogBox />
        </section>
      </div>
      {announcing && <AnnounceDialog onClose={() => setAnnouncing(false)} />}
    </div>
  )
}

function PartyCards() {
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
