import { ChevronLeft, ChevronRight, Minus, Plus, RotateCcw, UsersRound, X } from 'lucide-react'
import { useState } from 'react'
import { roll } from '../../logic/dice'
import type { Session } from '../../model/schema'
import { byId, newId, patch } from '../../model/universe'
import { rollInitiative } from '../../rpg/rolls'
import { adjustResource } from '../../rpg/sheets'
import { useWorkspace } from '../../state/workspace'
import { useRpg } from './rpgContext'

/**
 * Ordem de iniciativa da sessão. A vez atual e a rodada ficam salvas; combatentes
 * ligados a fichas de jogo mostram o recurso principal e as condições da ficha.
 */
export function InitiativeTracker({ session }: { session: Session }) {
  const { universe, update } = useWorkspace()
  const { system, group, logText } = useRpg()
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const list = [...session.initiative].sort((a, b) => b.value - a.value)
  const turn = list.length ? session.turn % list.length : 0
  const main = system?.resources[0]
  const set = (c: Partial<Session>) => update((u) => patch(u, 'sessions', session.id, c))

  const rollFor = (sheetId: string | null) => {
    const sheet = sheetId ? byId(universe, 'sheets', sheetId) : undefined
    return system ? rollInitiative(system, sheet ?? null) : roll('d20').total
  }

  const add = () => {
    if (!name.trim()) return
    const v = value.trim() ? Number(value) : rollFor(null)
    if (!Number.isFinite(v)) return
    set({ initiative: [...session.initiative, { id: newId(), name: name.trim(), value: v, hp: '', note: '', sheetId: null }] })
    setName('')
    setValue('')
  }

  const addParty = () => {
    const present = new Set(session.initiative.map((i) => i.sheetId))
    const sheets = universe.sheets.filter((s) => s.groupId === group.id && s.role === 'pj' && !present.has(s.id))
    set({ initiative: [...session.initiative, ...sheets.map((s) => ({ id: newId(), name: s.name, value: rollFor(s.id), hp: '', note: '', sheetId: s.id }))] })
  }

  const next = (dir: 1 | -1) => {
    if (!list.length) return
    let t = session.turn + dir
    let round = session.round
    if (t >= list.length) {
      t = 0
      round += 1
      logText(`Rodada ${round}`, 'nota')
    } else if (t < 0) {
      t = list.length - 1
      round = Math.max(1, round - 1)
    }
    set({ turn: t, round })
  }

  const npcSheets = universe.sheets.filter((s) => s.groupId === group.id && s.role === 'npc' && !session.initiative.some((i) => i.sheetId === s.id))

  return (
    <section className="initiative" aria-label="Iniciativa">
      <div className="section-head">
        <h2 className="section-title">
          Iniciativa {list.length > 0 && <span className="round-pill">Rodada {session.round}</span>}
        </h2>
        <div className="inline-fields">
          {list.length > 0 && (
            <>
              <button type="button" className="btn-icon" aria-label="Vez anterior" onClick={() => next(-1)}>
                <ChevronLeft size={16} />
              </button>
              <button type="button" className="btn btn-sm btn-primary" onClick={() => next(1)}>
                Próxima vez <ChevronRight size={14} />
              </button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => set({ initiative: [], turn: 0, round: 1 })}>
                <RotateCcw size={14} /> Encerrar combate
              </button>
            </>
          )}
        </div>
      </div>

      {list.length > 0 && (
        <ol className="init-list">
          {list.map((c, i) => {
            const sheet = c.sheetId ? byId(universe, 'sheets', c.sheetId) : undefined
            const res = sheet && main ? (sheet.resources[main.id] ?? { current: main.default, max: main.default }) : null
            const current = i === turn
            return (
              <li key={c.id} className={`init-row${current ? ' current' : ''}${res && res.max > 0 && res.current <= 0 ? ' down' : ''}`} aria-current={current ? 'step' : undefined}>
                <input
                  className="input input-sm init-value"
                  inputMode="numeric"
                  aria-label={`Iniciativa de ${c.name}`}
                  value={c.value}
                  onChange={(e) => Number.isFinite(Number(e.target.value)) && set({ initiative: session.initiative.map((x) => (x.id === c.id ? { ...x, value: Number(e.target.value) } : x)) })}
                />
                <span className="init-name">
                  {c.name}
                  {sheet && <span className={`role-dot role-${sheet.role}`} aria-hidden="true" />}
                </span>
                {res && main && sheet ? (
                  <span className="init-res">
                    <button type="button" className="btn-icon btn-xs" aria-label={`Menos 1 ${main.abbr} de ${c.name}`} onClick={() => update((u) => patch(u, 'sheets', sheet.id, { resources: adjustResource(sheet, main.id, -1) }))}>
                      <Minus size={12} />
                    </button>
                    <span className="tabular">
                      {main.abbr} {res.current}/{res.max}
                    </span>
                    <button type="button" className="btn-icon btn-xs" aria-label={`Mais 1 ${main.abbr} de ${c.name}`} onClick={() => update((u) => patch(u, 'sheets', sheet.id, { resources: adjustResource(sheet, main.id, 1) }))}>
                      <Plus size={12} />
                    </button>
                  </span>
                ) : (
                  <input className="input input-sm init-hp" aria-label={`PV de ${c.name}`} placeholder="PV" value={c.hp} onChange={(e) => set({ initiative: session.initiative.map((x) => (x.id === c.id ? { ...x, hp: e.target.value } : x)) })} />
                )}
                {sheet && system?.features.conditions ? (
                  <span className="init-conditions">
                    {sheet.conditions.map((cond) => (
                      <button key={cond} type="button" className="chip chip-condition" aria-pressed="true" title="Remover condição" onClick={() => update((u) => patch(u, 'sheets', sheet.id, { conditions: sheet.conditions.filter((x) => x !== cond) }))}>
                        {cond} ×
                      </button>
                    ))}
                    <select
                      className="input select input-sm init-add-cond"
                      aria-label={`Adicionar condição a ${c.name}`}
                      value=""
                      onChange={(e) => e.target.value && update((u) => patch(u, 'sheets', sheet.id, { conditions: [...sheet.conditions, e.target.value] }))}
                    >
                      <option value="">+ condição</option>
                      {system.conditions.filter((x) => !sheet.conditions.includes(x)).map((x) => (
                        <option key={x} value={x}>
                          {x}
                        </option>
                      ))}
                    </select>
                  </span>
                ) : (
                  <input className="input input-sm" aria-label={`Notas de ${c.name}`} placeholder="Condições…" value={c.note} onChange={(e) => set({ initiative: session.initiative.map((x) => (x.id === c.id ? { ...x, note: e.target.value } : x)) })} />
                )}
                <button
                  type="button"
                  className="btn-icon btn-xs"
                  aria-label={`Remover ${c.name}`}
                  onClick={() => set({ initiative: session.initiative.filter((x) => x.id !== c.id), turn: i < turn ? Math.max(0, session.turn - 1) : session.turn })}
                >
                  <X size={12} />
                </button>
              </li>
            )
          })}
        </ol>
      )}

      <div className="init-add">
        <button type="button" className="btn btn-sm btn-ghost" onClick={addParty}>
          <UsersRound size={14} /> Adicionar os jogadores da mesa
        </button>
        {npcSheets.length > 0 && (
          <select
            className="input select input-sm"
            aria-label="Adicionar NPC"
            value=""
            onChange={(e) => {
              const s = npcSheets.find((x) => x.id === e.target.value)
              if (s) set({ initiative: [...session.initiative, { id: newId(), name: s.name, value: rollFor(s.id), hp: '', note: '', sheetId: s.id }] })
            }}
          >
            <option value="">+ NPC da mesa</option>
            {npcSheets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
        <form
          className="inline-fields"
          onSubmit={(e) => {
            e.preventDefault()
            add()
          }}
        >
          <label htmlFor="init-nome" className="sr-only">
            Nome
          </label>
          <input id="init-nome" className="input input-sm" placeholder="Combatente avulso" value={name} onChange={(e) => setName(e.target.value)} />
          <label htmlFor="init-valor" className="sr-only">
            Iniciativa
          </label>
          <input id="init-valor" className="input input-sm input-year" inputMode="numeric" placeholder="Rolar" value={value} onChange={(e) => setValue(e.target.value)} />
          <button type="submit" className="btn btn-sm btn-ghost">
            <Plus size={14} /> Adicionar
          </button>
        </form>
      </div>
      <p className="muted tiny">Sem valor, o Papirus rola a iniciativa do sistema da mesa{system ? ` (${system.initiativeFormula})` : ' (1d20)'}.</p>
    </section>
  )
}
