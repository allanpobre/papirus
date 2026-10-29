import { ChevronDown, ChevronLeft, ChevronRight, Dices, Flag, Minus, Plus, Smartphone, Swords, UserPlus, X } from 'lucide-react'
import { useState } from 'react'
import type { Session } from '../../model/schema'
import { byId, insert, newId, patch } from '../../model/universe'
import { addCondition, conditionsOf, expireEffects, initiativeOrder, isDown, lifeOf, removeCondition, roundsLeft } from '../../rpg/combat'
import { addMonsters, draftMonster, sortedMonsters } from '../../rpg/bestiary'
import { autoInitiative, defineTurns, endFight, fightPhase, joinFight, setInitiative, startFight, waitingFor } from '../../rpg/fight'
import { attendanceOf } from '../../rpg/sessionLife'
import { adjustResource, defenseLabel, defenseResource, isPool } from '../../rpg/sheets'
import { useTablePresence } from '../../share/presence'
import { useWorkspace } from '../../state/workspace'
import { ConfirmButton } from '../../ui/ConfirmButton'
import { RollingDie } from '../../ui/RollingDie'
import { MonsterDialog } from './Bestiary'
import { TurnPanel } from './Combat'
import { useRpg } from './rpgContext'

type Entry = Session['initiative'][number]

/**
 * O combate da sessão, em três passos:
 * 1. sem combate, um botão: "Começar combate";
 * 2. a iniciativa: cada jogador rola no celular (o mestre rola ou digita por quem não tem),
 *    o mestre põe os inimigos, e "Definir turnos" fecha a ordem quando todos rolaram;
 * 3. os turnos: de quem é a vez, a ordem enxuta (um toque abre vida, Defesa e condições) e a próxima vez.
 */
export function InitiativeTracker({ session }: { session: Session }) {
  const phase = fightPhase(session)
  if (phase === 'fora') return <FightStart session={session} />
  return phase === 'iniciativa' ? <RollingInitiative session={session} /> : <Turns session={session} />
}

function FightStart({ session }: { session: Session }) {
  const { update, readOnly } = useWorkspace()
  const { system, group } = useRpg()
  return (
    <section className="initiative fight-start" aria-label="Iniciativa">
      <span className="fight-start-icon" aria-hidden="true">
        <Swords size={26} />
      </span>
      <h2 className="section-title">Nenhum combate agora</h2>
      <p className="muted small">{group.share ? 'Os jogadores rolam a iniciativa no celular; você põe os inimigos.' : 'Você rola ou digita a iniciativa de cada um e põe os inimigos.'}</p>
      {!readOnly && (
        <button type="button" className="btn btn-primary fight-go" onClick={() => update((u) => startFight(u, session.id, system))}>
          <Swords size={17} /> Começar combate
        </button>
      )}
    </section>
  )
}

function RollingInitiative({ session }: { session: Session }) {
  const { universe, update, readOnly } = useWorkspace()
  const { system, group } = useRpg()
  const [open, setOpen] = useState<string | null>(null)
  const waiting = waitingFor(session)
  const pcs = session.initiative.filter((e) => e.sheetId && byId(universe, 'sheets', e.sheetId)?.role === 'pj')
  const others = initiativeOrder(session).filter((e) => !pcs.includes(e))
  const ready = session.initiative.length > 0 && waiting.length === 0
  const names = waiting.map((e) => e.name)
  // Quem está com o Codex aberto rola no celular; para os outros, o mestre rola ou digita.
  const online = new Set(useTablePresence(group.share ? group.id : undefined).map((p) => p.name))

  return (
    <section className="initiative fight" aria-label="Iniciativa">
      <div className="fight-head">
        <h2 className="section-title">Iniciativa</h2>
        <span className="round-pill">{waiting.length ? 'rolando' : 'pronta'}</span>
      </div>

      <h3 className="section-label">Jogadores</h3>
      {pcs.length === 0 && <p className="muted small">Nenhum personagem de jogador nesta sessão.</p>}
      <ol className="fight-list">
        {pcs.map((e) => (
          <Combatant key={e.id} session={session} entry={e} onPhone={online.has(e.name)} open={open === e.id} onToggle={() => setOpen(open === e.id ? null : e.id)} />
        ))}
      </ol>

      <h3 className="section-label">Inimigos e NPCs</h3>
      {others.length === 0 && <p className="muted small">Ponha quem vai lutar contra eles. O Papirus rola a iniciativa deles.</p>}
      <ol className="fight-list">
        {others.map((e) => (
          <Combatant key={e.id} session={session} entry={e} open={open === e.id} onToggle={() => setOpen(open === e.id ? null : e.id)} />
        ))}
      </ol>
      {!readOnly && <AddCombatants session={session} />}

      {!readOnly && (
        <div className="fight-foot">
          <button type="button" className="btn btn-primary fight-go" disabled={!ready} onClick={() => update((u) => defineTurns(u, session.id))}>
            <Swords size={17} /> Definir turnos
          </button>
          <p className="muted small" role="status">
            {!session.initiative.length
              ? 'Ninguém no combate ainda.'
              : waiting.length
                ? `Esperando ${names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} e ${names.at(-1)}`} rolar.${group.share ? '' : ' Sem o link da mesa, role ou digite por eles.'}`
                : 'Todos rolaram. A ordem sai do maior para o menor.'}
          </p>
          <ConfirmButton className="btn btn-ghost btn-sm" question="Cancelar o combate?" confirmLabel="Cancelar combate" onConfirm={() => update((u) => endFight(u, session.id))}>
            <X size={14} /> Cancelar
          </ConfirmButton>
        </div>
      )}
      {system && <p className="muted tiny">Iniciativa do sistema: {system.initiativeFormula}</p>}
    </section>
  )
}

function Turns({ session }: { session: Session }) {
  const { universe, update, readOnly } = useWorkspace()
  const [open, setOpen] = useState<string | null>(null)
  const list = initiativeOrder(session)
  const turn = list.length ? session.turn % list.length : 0
  const set = (c: Partial<Session>) => update((u) => patch(u, 'sessions', session.id, c))

  // Inimigos derrotados perdem a vez; personagens de jogador caídos, não (podem estar sangrando).
  const skips = (i: number) => {
    const e = list[i]
    const sheet = e.sheetId ? byId(universe, 'sheets', e.sheetId) : undefined
    return sheet?.role !== 'pj' && isDown(universe, e)
  }

  const next = (dir: 1 | -1) => {
    if (!list.length) return
    let t = turn
    let round = session.round
    for (let step = 0; step < list.length; step++) {
      t += dir
      if (t >= list.length) {
        t = 0
        round += 1
      } else if (t < 0) {
        t = list.length - 1
        round = Math.max(1, round - 1)
      }
      if (!skips(t)) break
    }
    if (round <= session.round) return set({ turn: t, round })
    // A rodada virou: as condições que venceram acabam, e o registro conta.
    const at = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    update((u) => {
      const { universe: v, ended } = expireEffects(patch(u, 'sessions', session.id, { turn: t, round }), session.id)
      const s = byId(v, 'sessions', session.id)!
      if (s.status !== 'em-andamento') return v
      return patch(v, 'sessions', s.id, { log: [...s.log, ...[`Rodada ${round}`, ...ended].map((text) => ({ id: newId(), at, text, kind: 'nota' as const }))] })
    })
  }

  return (
    <section className="initiative fight" aria-label="Iniciativa">
      <div className="fight-head">
        <h2 className="section-title">Combate</h2>
        <span className="round-pill">Rodada {session.round}</span>
        {!readOnly && (
          <ConfirmButton className="btn btn-ghost btn-sm fight-end" question="Encerrar o combate?" confirmLabel="Encerrar" onConfirm={() => update((u) => endFight(u, session.id))}>
            <Flag size={14} /> Encerrar combate
          </ConfirmButton>
        )}
      </div>

      <TurnPanel session={session} />
      {!readOnly && (
        <div className="fight-step">
          <button type="button" className="btn-icon" aria-label="Vez anterior" onClick={() => next(-1)}>
            <ChevronLeft size={18} />
          </button>
          <button type="button" className="btn btn-primary fight-next" onClick={() => next(1)}>
            Próxima vez <ChevronRight size={16} />
          </button>
        </div>
      )}

      <ol className="fight-list" aria-label="Ordem dos turnos">
        {list.map((e, i) => (
          <Combatant key={e.id} session={session} entry={e} current={i === turn} open={open === e.id} onToggle={() => setOpen(open === e.id ? null : e.id)} />
        ))}
      </ol>
      {!readOnly && (
        <details className="fight-more">
          <summary>
            <UserPlus size={15} aria-hidden="true" /> Pôr mais no combate
          </summary>
          <AddCombatants session={session} />
        </details>
      )}
    </section>
  )
}

/**
 * Uma linha do combate: a iniciativa no d20, o nome e a vida. Um toque abre o resto
 * (vida, Defesa, condições, tirar do combate). Quem ainda está rolando pede o valor.
 */
function Combatant({ session, entry: c, current = false, onPhone = false, open, onToggle }: { session: Session; entry: Entry; current?: boolean; onPhone?: boolean; open: boolean; onToggle: () => void }) {
  const { universe, update, readOnly } = useWorkspace()
  const { system } = useRpg()
  const [typed, setTyped] = useState('')
  const sheet = c.sheetId ? byId(universe, 'sheets', c.sheetId) : undefined
  const main = system?.resources.find(isPool)
  const res = sheet && main ? (sheet.resources[main.id] ?? { current: main.default, max: main.default }) : null
  const down = isDown(universe, c)
  const life = lifeOf(universe, c)
  const pct = life && life.max ? Math.max(0, Math.min(100, (life.current / life.max) * 100)) : null
  const defLabel = defenseLabel(system)
  const defAbbr = defenseResource(system)?.abbr ?? 'DEF'
  const conds = conditionsOf(universe, c)
  const setEntry = (x: Partial<Entry>) => update((u) => patch(u, 'sessions', session.id, { initiative: session.initiative.map((e) => (e.id === c.id ? { ...e, ...x } : e)) }))
  const gm = sheet && attendanceOf(session, sheet.id) === 'mestre'

  if (!c.rolled) {
    const submit = () => {
      const v = Number(typed)
      if (typed.trim() && Number.isFinite(v)) update((u) => setInitiative(u, session.id, c.id, v))
    }
    return (
      <li className="fight-row is-waiting">
        <div className="fight-line">
          <RollingDie value={null} label={`${c.name} ainda não rolou`} />
          <span className="fight-name">
            <strong>{c.name}</strong>
            <span className="muted tiny">
              {onPhone && !gm ? (
                <>
                  <Smartphone size={11} aria-hidden="true" /> rolando no celular…
                </>
              ) : gm ? (
                'o mestre conduz: role por ele'
              ) : (
                'sem o Codex aberto: role ou digite o que saiu'
              )}
            </span>
          </span>
        </div>
        {!readOnly && onPhone && !gm ? (
          <div className="fight-type">
            <button type="button" className="btn btn-xs btn-ghost" aria-label={`Rolar por ${c.name}`} onClick={() => update((u) => setInitiative(u, session.id, c.id, autoInitiative(u, system, c.sheetId)))}>
              <Dices size={13} /> Rolar por ele
            </button>
          </div>
        ) : !readOnly && (
          <form
            className="fight-type"
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            <input className="input input-sm" inputMode="numeric" aria-label={`Iniciativa de ${c.name}`} placeholder="Valor" value={typed} onChange={(e) => setTyped(e.target.value.replace(/[^\d-]/g, '').slice(0, 3))} />
            <button type="submit" className="btn btn-sm" disabled={!typed.trim()}>
              OK
            </button>
            <button type="button" className="btn btn-sm btn-ghost" aria-label={`Rolar por ${c.name}`} onClick={() => update((u) => setInitiative(u, session.id, c.id, autoInitiative(u, system, c.sheetId)))}>
              <Dices size={14} /> Rolar
            </button>
          </form>
        )}
      </li>
    )
  }

  return (
    <li className={`fight-row${current ? ' current' : ''}${down ? ' down' : ''}${open ? ' is-open' : ''}`} aria-current={current ? 'step' : undefined}>
      <button type="button" className="fight-line" aria-expanded={open} aria-label={`${c.name}: iniciativa ${c.value}${life ? `, ${life.abbr} ${life.current}${life.max ? `/${life.max}` : ''}` : ''}${conds.length ? `, ${conds.join(', ')}` : ''}`} onClick={onToggle}>
        <RollingDie value={c.value} />
        <span className="fight-name">
          <strong className="init-name-text">{c.name}</strong>
          {sheet && <span className={`role-dot role-${sheet.role}`} aria-hidden="true" />}
          {down && <span className="init-down">derrotado</span>}
          <span className="fight-meta muted tiny">
            {life ? `${life.abbr} ${life.current}${life.max ? `/${life.max}` : ''}` : sheet ? '' : 'sem PV'}
            {conds.length > 0 && ` · ${conds.join(', ')}`}
            {c.note && ` · ${c.note}`}
          </span>
          {pct !== null && (
            <span className={`init-bar${pct <= 25 ? ' is-low' : ''}`} aria-hidden="true">
              <span style={{ width: `${pct}%` }} />
            </span>
          )}
        </span>
        <ChevronDown size={16} className="fight-chevron" aria-hidden="true" />
      </button>

      {open && (
        <div className="fight-edit">
          {res && main && sheet ? (
            <div className="fight-field">
              <span className="field-label">{main.abbr}</span>
              <button type="button" className="btn-icon btn-xs" aria-label={`Menos 1 ${main.abbr} de ${c.name}`} onClick={() => update((u) => patch(u, 'sheets', sheet.id, { resources: adjustResource(sheet, main.id, -1) }))}>
                <Minus size={13} />
              </button>
              <span className="tabular">
                {res.current}/{res.max}
              </span>
              <button type="button" className="btn-icon btn-xs" aria-label={`Mais 1 ${main.abbr} de ${c.name}`} onClick={() => update((u) => patch(u, 'sheets', sheet.id, { resources: adjustResource(sheet, main.id, 1) }))}>
                <Plus size={13} />
              </button>
            </div>
          ) : (
            <>
              <label className="fight-field">
                <span className="field-label">PV</span>
                <input className="input input-sm init-hp" aria-label={`PV de ${c.name}`} title="Vida: 7, ou 3/7 (atual/máximo)" placeholder="7/7" value={c.hp} readOnly={readOnly} onChange={(e) => setEntry({ hp: e.target.value })} />
              </label>
              <label className="fight-field">
                <span className="field-label">{defAbbr}</span>
                <input
                  className="input input-sm init-def"
                  inputMode="numeric"
                  aria-label={`${defLabel} de ${c.name}`}
                  title={`${defLabel}: o que um ataque precisa tirar para acertar`}
                  value={c.defense ?? ''}
                  readOnly={readOnly}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^\d]/g, '')
                    setEntry({ defense: v ? Number(v) : null })
                  }}
                />
              </label>
            </>
          )}
          <label className="fight-field">
            <span className="field-label">Iniciativa</span>
            <input
              className="input input-sm init-value"
              inputMode="numeric"
              aria-label={`Iniciativa de ${c.name}`}
              value={c.value}
              readOnly={readOnly}
              onChange={(e) => e.target.value.trim() && Number.isFinite(Number(e.target.value)) && setEntry({ value: Number(e.target.value) })}
            />
          </label>
          {system?.features.conditions && system.conditions.length > 0 ? (
            <Conditions session={session} entry={c} />
          ) : (
            <input className="input input-sm init-note" aria-label={`Notas de ${c.name}`} placeholder="Condições…" value={c.note} readOnly={readOnly} onChange={(e) => setEntry({ note: e.target.value })} />
          )}
          {!readOnly && (
            <button
              type="button"
              className="btn btn-ghost btn-sm fight-remove"
              onClick={() => {
                const list = initiativeOrder(session)
                const i = list.findIndex((x) => x.id === c.id)
                const turn = list.length ? session.turn % list.length : 0
                update((u) => patch(u, 'sessions', session.id, { initiative: session.initiative.filter((x) => x.id !== c.id), turn: i < turn ? Math.max(0, turn - 1) : turn }))
              }}
            >
              <X size={14} /> Tirar {c.name} do combate
            </button>
          )}
        </div>
      )}
    </li>
  )
}

/** As condições de quem luta: tocar tira; escolher uma pergunta quanto tempo dura. */
function Conditions({ session, entry: c }: { session: Session; entry: Entry }) {
  const { universe, update, readOnly } = useWorkspace()
  const { system } = useRpg()
  const [adding, setAdding] = useState<string | null>(null)
  if (!system) return null
  const current = conditionsOf(universe, c)
  return (
    <span className="init-conditions">
      {current.map((cond) => {
        const left = roundsLeft(session, c.id, cond)
        return (
          <button key={cond} type="button" className="chip chip-condition" aria-pressed="true" aria-label={`Tirar ${cond} de ${c.name}`} title="Tirar a condição" disabled={readOnly} onClick={() => update((u) => removeCondition(u, session.id, c.id, cond))}>
            {cond}
            {left !== null && <span className="cond-left">{left === 1 ? 'última rodada' : `${left} rodadas`}</span>} ×
          </button>
        )
      })}
      {!readOnly &&
        (adding ? (
          <select
            className="input select input-sm init-add-cond"
            aria-label={`Quanto tempo dura ${adding} em ${c.name}`}
            autoFocus
            value=""
            onBlur={() => setAdding(null)}
            onChange={(e) => {
              const rounds = Number(e.target.value)
              update((u) => addCondition(u, session.id, c.id, adding, rounds || null))
              setAdding(null)
            }}
          >
            <option value="" disabled>
              {adding}: por quanto tempo?
            </option>
            <option value="0">Até tirar</option>
            {[1, 2, 3, 5, 10].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? 'rodada' : 'rodadas'}
              </option>
            ))}
          </select>
        ) : (
          <select className="input select input-sm init-add-cond" aria-label={`Adicionar condição a ${c.name}`} value="" onChange={(e) => e.target.value && setAdding(e.target.value)}>
            <option value="">+ condição</option>
            {system.conditions
              .filter((x) => !current.includes(x))
              .map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
          </select>
        ))}
    </span>
  )
}

/** Pôr gente no combate: inimigos prontos (vários de uma vez), NPCs da mesa, quem ficou de fora e avulsos. */
function AddCombatants({ session }: { session: Session }) {
  const { universe, update } = useWorkspace()
  const { system, group } = useRpg()
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const [monsterId, setMonsterId] = useState('')
  const [count, setCount] = useState('1')
  const [editingMonster, setEditingMonster] = useState<string | null>(null)
  const monsters = sortedMonsters(universe)
  const inside = new Set(session.initiative.map((i) => i.sheetId))
  const sheets = universe.sheets.filter((s) => s.groupId === group.id && !inside.has(s.id) && (s.role === 'npc' || attendanceOf(session, s.id) !== 'fora'))

  return (
    <div className="init-add fight-add">
      <form
        className="inline-fields init-monsters"
        onSubmit={(e) => {
          e.preventDefault()
          const n = Math.max(1, Math.min(20, Number(count) || 1))
          if (!monsterId) return
          update((u) => addMonsters(u, session.id, monsterId, n, system))
          setCount('1')
        }}
      >
        <label htmlFor="init-monstro" className="sr-only">
          Inimigo pronto
        </label>
        <select
          id="init-monstro"
          className="input select input-sm"
          value={monsterId}
          onChange={(e) => {
            if (e.target.value === '+novo') {
              let id = ''
              update((u) => {
                const [next, m] = insert(u, 'monsters', draftMonster('Novo inimigo'))
                id = m.id
                return next
              })
              setMonsterId(id)
              setEditingMonster(id)
            } else setMonsterId(e.target.value)
          }}
        >
          <option value="">Inimigo pronto…</option>
          {monsters.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name || 'Sem nome'}
            </option>
          ))}
          <option value="+novo">+ Novo inimigo pronto</option>
        </select>
        <label htmlFor="init-qtd" className="sr-only">
          Quantos
        </label>
        <input id="init-qtd" className="input input-sm init-count" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value.replace(/[^\d]/g, '').slice(0, 2))} />
        <button type="submit" className="btn btn-sm" disabled={!monsterId}>
          <Plus size={14} /> Pôr no combate
        </button>
      </form>
      {sheets.length > 0 && (
        <select
          className="input select input-sm"
          aria-label="Pôr personagem da mesa"
          value=""
          onChange={(e) => {
            const s = sheets.find((x) => x.id === e.target.value)
            if (s) update((u) => joinFight(u, session.id, s.name, system, { sheetId: s.id, note: s.role === 'pj' && attendanceOf(session, s.id) === 'mestre' ? 'mestre conduz' : '' }))
          }}
        >
          <option value="">+ Personagem da mesa</option>
          {sheets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.role === 'npc' ? ' (NPC)' : ''}
            </option>
          ))}
        </select>
      )}
      <form
        className="inline-fields"
        onSubmit={(e) => {
          e.preventDefault()
          const v = value.trim() ? Number(value) : undefined
          if (!name.trim() || (v !== undefined && !Number.isFinite(v))) return
          update((u) => joinFight(u, session.id, name, system, {}, v))
          setName('')
          setValue('')
        }}
      >
        <label htmlFor="init-nome" className="sr-only">
          Nome
        </label>
        <input id="init-nome" className="input input-sm" placeholder="Outro (nome)" value={name} onChange={(e) => setName(e.target.value)} />
        <label htmlFor="init-valor" className="sr-only">
          Iniciativa
        </label>
        <input id="init-valor" className="input input-sm input-year" inputMode="numeric" placeholder="Rolar" title="Vazio: o Papirus rola" value={value} onChange={(e) => setValue(e.target.value)} />
        <button type="submit" className="btn btn-sm btn-ghost" disabled={!name.trim()}>
          <Plus size={14} /> Adicionar
        </button>
      </form>
      {editingMonster && <MonsterDialog monsterId={editingMonster} onClose={() => setEditingMonster(null)} />}
    </div>
  )
}
