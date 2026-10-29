import { Check, ChevronDown, ChevronLeft, ChevronRight, Dices, Flag, Minus, Plus, Smartphone, Swords, UserPlus, X } from 'lucide-react'
import { useState } from 'react'
import { roll } from '../../logic/dice'
import { INITIATIVE_MODES, type Session, type Universe } from '../../model/schema'
import { byId, insert, patch } from '../../model/universe'
import { addCondition, conditionsOf, initiativeOrder, isDown, lifeOf, removeCondition, roundsLeft } from '../../rpg/combat'
import { addMonsters, draftMonster, sortedMonsters } from '../../rpg/bestiary'
import {
  actedSide,
  autoInitiative,
  currentId,
  defineTurns,
  endFight,
  fightPhase,
  firstSide,
  joinFight,
  MODE_HINT,
  MODE_LABEL,
  nextTurn,
  passTo,
  popcornChoices,
  removeFromFight,
  setInitiative,
  setSides,
  sideOf,
  sideTurn,
  startFight,
  turnQueue,
  waitingFor,
} from '../../rpg/fight'
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
  const mode = group.initiativeMode
  return (
    <section className="initiative fight-start" aria-label="Iniciativa">
      <span className="fight-start-icon" aria-hidden="true">
        <Swords size={26} />
      </span>
      <h2 className="section-title">Nenhum combate agora</h2>
      {!readOnly && (
        <>
          <div className="segmented fight-modes" role="radiogroup" aria-label="Jeito de iniciativa">
            {INITIATIVE_MODES.map((m) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => update((u) => patch(u, 'groups', group.id, { initiativeMode: m }))}>
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>
          <p className="muted small">
            {MODE_HINT[mode]} {mode === 'classica' && (group.share ? 'Os jogadores rolam no celular.' : 'Você rola ou digita por eles.')}
          </p>
          <button type="button" className="btn btn-primary fight-go" onClick={() => update((u) => startFight(u, session.id, system, new Date(), undefined, mode))}>
            <Swords size={17} /> Combate!
          </button>
        </>
      )}
    </section>
  )
}

function RollingInitiative({ session }: { session: Session }) {
  const { universe, update, readOnly } = useWorkspace()
  const { system, group } = useRpg()
  const [open, setOpen] = useState<string | null>(null)
  const [heroes, setHeroes] = useState('')
  const [foes, setFoes] = useState('')
  const [startId, setStartId] = useState('')
  const mode = session.fightMode
  const waiting = waitingFor(session)
  const pcs = session.initiative.filter((e) => sideOf(universe, e) === 'herois')
  const others = (mode === 'classica' ? initiativeOrder(session) : session.initiative).filter((e) => !pcs.includes(e))
  const ready = session.initiative.length > 0 && waiting.length === 0 && (mode !== 'lados' || session.sides !== null) && (mode !== 'pipoca' || session.initiative.some((e) => e.id === startId))
  const names = waiting.map((e) => e.name)
  // Quem está com o Codex aberto rola no celular; para os outros, o mestre rola ou digita.
  const online = new Set(useTablePresence(group.share ? group.id : undefined).map((p) => p.name))
  const d20 = () => roll('1d20').total
  const sides = (h: string, f: string) => {
    setHeroes(h)
    setFoes(f)
    if (h && f) update((u) => setSides(u, session.id, Number(h), Number(f)))
  }
  const status = !session.initiative.length
    ? 'Ninguém no combate ainda.'
    : waiting.length
      ? `Esperando ${names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} e ${names.at(-1)}`} rolar.${group.share ? '' : ' Sem o link da mesa, role ou digite por eles.'}`
      : mode === 'lados'
        ? session.sides
          ? `Começam os ${firstSide(session) === 'herois' ? 'heróis' : 'inimigos'}.`
          : 'Falta rolar um dado para cada lado.'
        : mode === 'pipoca'
          ? startId
            ? 'Pronto: quem começa escolhe o próximo.'
            : 'Escolha quem começa.'
          : 'Todos rolaram. A ordem sai do maior para o menor.'

  return (
    <section className="initiative fight" aria-label="Iniciativa">
      <div className="fight-head">
        <h2 className="section-title">Iniciativa</h2>
        <span className="round-pill">{MODE_LABEL[mode]}</span>
      </div>

      <h3 className="section-label">Heróis</h3>
      {pcs.length === 0 && <p className="muted small">Nenhum personagem de jogador nesta sessão.</p>}
      <ol className="fight-list">
        {pcs.map((e) => (
          <Combatant key={e.id} session={session} entry={e} onPhone={online.has(e.name)} open={open === e.id} onToggle={() => setOpen(open === e.id ? null : e.id)} />
        ))}
      </ol>

      <h3 className="section-label">Inimigos</h3>
      {others.length === 0 && (
        <p className="muted small">
          Ponha quem vai lutar contra eles
          {mode === 'classica' ? '. O Papirus rola a iniciativa deles' : ''}.
        </p>
      )}
      <ol className="fight-list">
        {others.map((e) => (
          <Combatant key={e.id} session={session} entry={e} open={open === e.id} onToggle={() => setOpen(open === e.id ? null : e.id)} />
        ))}
      </ol>
      {!readOnly && <AddCombatants session={session} />}

      {!readOnly && mode === 'lados' && (
        <div className="fight-sides" role="group" aria-label="Um dado para cada lado">
          {(
            [
              ['Heróis', heroes, (v: string) => sides(v, foes)],
              ['Inimigos', foes, (v: string) => sides(heroes, v)],
            ] as const
          ).map(([label, value, set]) => (
            <div key={label} className="fight-side">
              <RollingDie value={value ? Number(value) : null} />
              <label className="fight-side-label">
                <span>{label}</span>
                <input className="input input-sm" inputMode="numeric" aria-label={`Dado dos ${label.toLowerCase()}`} placeholder="d20" value={value} onChange={(e) => set(e.target.value.replace(/[^\d]/g, '').slice(0, 2))} />
              </label>
              <button type="button" className="btn btn-sm btn-ghost" aria-label={`Rolar para os ${label.toLowerCase()}`} onClick={() => set(String(d20()))}>
                <Dices size={14} /> Rolar
              </button>
            </div>
          ))}
        </div>
      )}
      {!readOnly && mode === 'pipoca' && (
        <div className="fight-sides">
          <label className="field">
            <span className="field-label">Quem começa?</span>
            <select className="input select input-sm" value={startId} onChange={(e) => setStartId(e.target.value)}>
              <option value="">Escolha…</option>
              {session.initiative.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn-sm btn-ghost" disabled={!session.initiative.length} onClick={() => setStartId(session.initiative[Math.floor(Math.random() * session.initiative.length)].id)}>
            <Dices size={14} /> Sortear
          </button>
        </div>
      )}

      {!readOnly && (
        <div className="fight-foot">
          <button type="button" className="btn btn-primary fight-go" disabled={!ready} onClick={() => update((u) => defineTurns(u, session.id, new Date(), startId || undefined))}>
            <Swords size={17} /> Definir turnos
          </button>
          <p className="muted small" role="status">
            {status}
          </p>
          <ConfirmButton className="btn btn-ghost btn-sm" question="Cancelar o combate?" confirmLabel="Cancelar combate" onConfirm={() => update((u) => endFight(u, session.id))}>
            <X size={14} /> Cancelar
          </ConfirmButton>
        </div>
      )}
      {system && mode === 'classica' && <p className="muted tiny">Iniciativa do sistema: {system.initiativeFormula}</p>}
    </section>
  )
}

/** A fila de turnos, como num jogo: os retratos em fila, quem age em destaque, a vida embaixo. */
function Queue({ session, onPick }: { session: Session; onPick: (id: string) => void }) {
  const { universe } = useWorkspace()
  const queue = turnQueue(universe, session)
  return (
    <ol className="turn-queue" aria-label="Fila de turnos">
      {queue.map(({ entry: e, state, side }) => {
        const life = lifeOf(universe, e)
        const pct = life && life.max ? Math.max(0, Math.min(100, (life.current / life.max) * 100)) : null
        const down = isDown(universe, e)
        const conds = conditionsOf(universe, e)
        return (
          <li key={e.id} className={`tq is-${side}${state === 'agora' ? ' is-now' : ''}${state === 'agiu' ? ' is-done' : ''}${down ? ' is-down' : ''}`}>
            <button type="button" className="tq-btn" aria-label={`${e.name}${state === 'agora' ? ' (agindo)' : state === 'agiu' ? ' (já agiu)' : ''}${conds.length ? `, ${conds.join(', ')}` : ''}`} onClick={() => onPick(e.id)}>
              <span className="tq-face" aria-hidden="true">
                {initials(e.name)}
                {conds.length > 0 && <span className="tq-cond" />}
              </span>
              <span className="tq-name" aria-hidden="true">
                {e.name}
              </span>
              {pct !== null && (
                <span className={`tq-hp${pct <= 25 ? ' is-low' : ''}`} aria-hidden="true">
                  <span style={{ width: `${pct}%` }} />
                </span>
              )}
            </button>
          </li>
        )
      })}
    </ol>
  )
}

/** "Goblin das falésias 2" → "G2"; "Brisa" → "B". */
const initials = (name: string) => {
  const n = name.match(/(\d+)$/)?.[1] ?? ''
  return (name.trim()[0] ?? '?').toUpperCase() + n
}

function Turns({ session }: { session: Session }) {
  const { universe, update, readOnly } = useWorkspace()
  const [open, setOpen] = useState<string | null>(null)
  // Por lados, na vez dos heróis, o mestre toca em quem vai agir para ver os ataques dele.
  const [acting, setActing] = useState<string | null>(null)
  const mode = session.fightMode
  const now = currentId(session)
  const side = mode === 'lados' ? sideTurn(universe, session) : null
  const heroesTurn = side?.side === 'herois'
  const list = turnQueue(universe, session).map((q) => q.entry)
  const next = mode === 'classica' ? turnQueue(universe, nextTurnSession(universe, session)).at(0)?.entry : undefined
  const choices = mode === 'pipoca' ? popcornChoices(universe, session) : null
  const actor = heroesTurn ? (side.pending.some((e) => e.id === acting) ? acting : null) : now

  return (
    <section className="initiative fight" aria-label="Iniciativa">
      <div className="fight-head">
        <h2 className="section-title">Combate</h2>
        <span className="round-pill">Rodada {session.round}</span>
        <span className="muted tiny">{MODE_LABEL[mode]}</span>
        {!readOnly && (
          <ConfirmButton className="btn btn-ghost btn-sm fight-end" question="Encerrar o combate?" confirmLabel="Encerrar" onConfirm={() => update((u) => endFight(u, session.id))}>
            <Flag size={14} /> Encerrar combate
          </ConfirmButton>
        )}
      </div>

      <Queue session={session} onPick={(id) => (heroesTurn && side.pending.some((e) => e.id === id) ? setActing(id) : setOpen(open === id ? null : id))} />

      {heroesTurn && (
        <div className="turn-panel heroes-turn" role="group" aria-label="Vez dos heróis">
          <p className="turn-who">
            <Swords size={15} aria-hidden="true" /> Vez dos heróis: <span className="muted small">eles escolhem a ordem.</span>
          </p>
          <div className="chips">
            {side.pending.map((e) => (
              <span key={e.id} className="hero-pending">
                <button type="button" className={`chip${acting === e.id ? ' is-on' : ''}`} aria-pressed={acting === e.id} onClick={() => setActing(acting === e.id ? null : e.id)}>
                  {e.name}
                </button>
                {!readOnly && (
                  <button type="button" className="btn btn-xs" aria-label={`${e.name} agiu`} onClick={() => update((u) => actedSide(u, session.id, [e.id]))}>
                    <Check size={12} /> agiu
                  </button>
                )}
              </span>
            ))}
          </div>
          {!readOnly && side.pending.length > 1 && (
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() =>
                update((u) =>
                  actedSide(
                    u,
                    session.id,
                    side.pending.map((e) => e.id),
                  ),
                )
              }
            >
              Todos os heróis agiram
            </button>
          )}
        </div>
      )}
      {actor && <TurnPanel session={session} entryId={actor} />}

      {!readOnly && mode === 'classica' && (
        <div className="fight-step">
          <button type="button" className="btn-icon" aria-label="Vez anterior" onClick={() => update((u) => nextTurn(u, session.id, -1))}>
            <ChevronLeft size={18} />
          </button>
          <button type="button" className="btn btn-primary fight-next" onClick={() => update((u) => nextTurn(u, session.id, 1))}>
            <span>Próxima vez{next ? ` → ${next.name}` : ''}</span> <ChevronRight size={16} />
          </button>
        </div>
      )}
      {!readOnly && mode === 'lados' && side?.side === 'inimigos' && now && (
        <div className="fight-step">
          <button type="button" className="btn btn-primary fight-next" onClick={() => update((u) => actedSide(u, session.id, [now]))}>
            <span>{side.pending.length > 1 ? `Próximo inimigo → ${side.pending[1].name}` : 'Fim da vez dos inimigos'}</span> <ChevronRight size={16} />
          </button>
        </div>
      )}
      {!readOnly && choices && (
        <div className="popcorn" role="group" aria-label="Passar a vez">
          <p className="muted small">{choices.newRound ? 'Todos agiram. Quem começa a próxima rodada?' : `${list.find((e) => e.id === now)?.name ?? 'Quem agiu'} passa a vez para:`}</p>
          <div className="chips">
            {choices.next.map((e) => (
              <button key={e.id} type="button" className={`chip popcorn-pick is-${sideOf(universe, e)}`} onClick={() => update((u) => passTo(u, session.id, e.id))}>
                {e.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <details className="fight-more" open={open !== null}>
        <summary>Vida, Defesa e condições</summary>
        <ol className="fight-list" aria-label="Ordem dos turnos">
          {list.map((e) => (
            <Combatant key={e.id} session={session} entry={e} current={e.id === now} open={open === e.id} onToggle={() => setOpen(open === e.id ? null : e.id)} />
          ))}
        </ol>
      </details>
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

/** Como fica a sessão depois de "Próxima vez" (para mostrar quem vem). */
const nextTurnSession = (u: Universe, s: Session): Session => byId(nextTurn(u, s.id), 'sessions', s.id) ?? s

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
  const res =
    sheet && main
      ? (sheet.resources[main.id] ?? {
          current: main.default,
          max: main.default,
        })
      : null
  const down = isDown(universe, c)
  const life = lifeOf(universe, c)
  const pct = life && life.max ? Math.max(0, Math.min(100, (life.current / life.max) * 100)) : null
  const defLabel = defenseLabel(system)
  const defAbbr = defenseResource(system)?.abbr ?? 'DEF'
  const conds = conditionsOf(universe, c)
  const setEntry = (x: Partial<Entry>) =>
    update((u) =>
      patch(u, 'sessions', session.id, {
        initiative: session.initiative.map((e) => (e.id === c.id ? { ...e, ...x } : e)),
      }),
    )
  const gm = sheet && attendanceOf(session, sheet.id) === 'mestre'
  const classic = session.fightMode === 'classica'

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
        ) : (
          !readOnly && (
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
          )
        )}
      </li>
    )
  }

  return (
    <li className={`fight-row${current ? ' current' : ''}${down ? ' down' : ''}${open ? ' is-open' : ''}`} aria-current={current ? 'step' : undefined}>
      <button
        type="button"
        className="fight-line"
        aria-expanded={open}
        aria-label={`${c.name}: ${[classic ? `iniciativa ${c.value}` : '', life ? `${life.abbr} ${life.current}${life.max ? `/${life.max}` : ''}` : '', ...conds].filter(Boolean).join(', ')}`}
        onClick={onToggle}
      >
        {classic ? (
          <RollingDie value={c.value} />
        ) : (
          <span className={`tq-face is-${sideOf(universe, c)}`} aria-hidden="true">
            {initials(c.name)}
          </span>
        )}
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
              <button
                type="button"
                className="btn-icon btn-xs"
                aria-label={`Menos 1 ${main.abbr} de ${c.name}`}
                onClick={() =>
                  update((u) =>
                    patch(u, 'sheets', sheet.id, {
                      resources: adjustResource(sheet, main.id, -1),
                    }),
                  )
                }
              >
                <Minus size={13} />
              </button>
              <span className="tabular">
                {res.current}/{res.max}
              </span>
              <button
                type="button"
                className="btn-icon btn-xs"
                aria-label={`Mais 1 ${main.abbr} de ${c.name}`}
                onClick={() =>
                  update((u) =>
                    patch(u, 'sheets', sheet.id, {
                      resources: adjustResource(sheet, main.id, 1),
                    }),
                  )
                }
              >
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
          {classic && (
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
          )}
          {system?.features.conditions && system.conditions.length > 0 ? (
            <Conditions session={session} entry={c} />
          ) : (
            <input className="input input-sm init-note" aria-label={`Notas de ${c.name}`} placeholder="Condições…" value={c.note} readOnly={readOnly} onChange={(e) => setEntry({ note: e.target.value })} />
          )}
          {!readOnly && (
            <button type="button" className="btn btn-ghost btn-sm fight-remove" onClick={() => update((u) => removeFromFight(u, session.id, c.id))}>
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
          <button
            key={cond}
            type="button"
            className="chip chip-condition"
            aria-pressed="true"
            aria-label={`Tirar ${cond} de ${c.name}`}
            title="Tirar a condição"
            disabled={readOnly}
            onClick={() => update((u) => removeCondition(u, session.id, c.id, cond))}
          >
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
            if (s)
              update((u) =>
                joinFight(u, session.id, s.name, system, {
                  sheetId: s.id,
                  note: s.role === 'pj' && attendanceOf(session, s.id) === 'mestre' ? 'mestre conduz' : '',
                }),
              )
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
