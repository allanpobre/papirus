import { Check, Crosshair, Dices, Search, Swords } from 'lucide-react'
import { useEffect, useState } from 'react'
import { fold } from '../logic/text'
import { critDamage, facesOf, resolveRoll, type RollOutcome, type RollRules } from '../rpg/rolls'
import type { TableRoll } from '../share/server'
import type { CodexRoll, CodexSnapshot } from '../share/snapshot'
import { recall, remember } from '../state/prefs'
import { Modal } from '../ui/Modal'
import { PhysicalRollDialog } from '../views/rpg/PhysicalRollDialog'

const LOOSE: RollRules = { resolution: 'total', successTarget: 0 }
const FREE = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']

/** Uma rolagem na mesa, vista do celular: a do jogador ou a de outro, com o veredito do mestre quando chega. */
export type FeedRoll = TableRoll & { checked?: boolean; mine?: boolean }

/** O nome de uma rolagem como a mesa lê: "Espada longa contra Goblin", "Espada longa (dano) em Goblin". */
export const rollLabel = (r: TableRoll) => (r.aim ? `${r.name} ${r.kind === 'dano' ? 'em' : 'contra'} ${r.aim.name}` : r.name)

interface Pending {
  roll: CodexRoll | null
  name: string
  kind: TableRoll['kind']
  expression: string
  target?: number
  critFrom?: number
}

/**
 * O jogador na mesa: escolhe quem é, rola pela própria ficha (o dado de verdade primeiro) e
 * vê as rolagens de todos. Nada muda no Codex por aqui: o mestre confere e decide.
 */
export function PlayerTable({ codex, me, onMe, feed, onRoll }: { codex: CodexSnapshot; me: string | null; onMe: (name: string | null) => void; feed: FeedRoll[]; onRoll: (r: TableRoll) => void }) {
  const [rolling, setRolling] = useState(false)
  const [aiming, setAiming] = useState<Pending | null>(null)
  const [asking, setAsking] = useState<{ outcome: RollOutcome; pending: Pending; aim?: TableRoll['aim'] } | null>(null)
  const [physical, setPhysical] = useState(() => recall('codex-dados') !== 'app')
  const rules = codex.rules ?? LOOSE
  const pc = me ? codex.party.find((p) => p.name === me) : undefined
  const rolls = pc?.rolls ?? []
  const combat = codex.combat
  const myTurn = Boolean(me && combat?.order.some((e) => e.current && e.pc && e.name === me))
  // A vez chegou: o celular vibra (onde dá).
  useEffect(() => {
    if (myTurn) navigator.vibrate?.(180)
  }, [myTurn])
  const others = combat?.order.filter((e) => e.name !== me) ?? []

  const send = (o: RollOutcome, p: Pending, aim?: TableRoll['aim']) => {
    onRoll({
      id: crypto.randomUUID(),
      who: me ?? 'Alguém',
      name: p.name,
      kind: p.kind,
      expression: o.expression,
      faces: facesOf(o),
      physical: Boolean(o.physical),
      ...(p.target !== undefined ? { target: p.target } : {}),
      ...(p.critFrom ? { critFrom: p.critFrom } : {}),
      ...(aim ? { aim } : {}),
      total: o.result.total,
      verdict: o.verdict,
      tone: o.tone,
      at: new Date().toISOString(),
    })
  }

  const go = (p: Pending, aim?: TableRoll['aim']) => {
    setAiming(null)
    setRolling(false)
    let o: RollOutcome
    try {
      o = resolveRoll(rules, p.name, p.expression, p.target, undefined, p.critFrom)
    } catch {
      return
    }
    if (physical) setAsking({ outcome: o, pending: p, aim })
    else send(o, p, aim)
  }

  // Ataque em combate: primeiro, em quem.
  const start = (p: Pending) => {
    setRolling(false)
    if (others.length && (p.kind === 'ataque' || p.kind === 'dano')) setAiming(p)
    else go(p)
  }

  const attackOf = (name: string) => rolls.find((r) => r.kind === 'ataque' && r.name === name)
  const last = feed.find((f) => f.mine && f.kind === 'ataque')
  const lastAttack = last && attackOf(last.name)
  const canDamage = last && feed[0] === last && lastAttack?.damage && !/^erra/i.test(last.verdict ?? '')
  const crit = last?.tone === 'critico'

  return (
    <>
      {codex.party.length > 0 && !me && (
        <section className="player-who" aria-labelledby="player-who">
          <h2 id="player-who" className="player-who-title">
            Quem é você na mesa?
          </h2>
          <p className="muted small">Para rolar pela sua ficha. As rolagens aparecem para o mestre e para o grupo.</p>
          <div className="chips">
            {codex.party.map((p) => (
              <button key={p.name} type="button" className={`chip player-who-chip${p.away ? ' is-away' : ''}`} onClick={() => onMe(p.name)}>
                {p.name}
                {p.player && <span className="player-who-player">{p.player}</span>}
                {p.away && <span className="player-who-away">{p.away === 'fora' ? 'fora hoje' : 'com o mestre hoje'}</span>}
              </button>
            ))}
          </div>
        </section>
      )}

      <aside className="player-dock" aria-label="Na mesa">
        {myTurn && (
          <p className="player-turn" role="status">
            <Swords size={15} aria-hidden="true" /> Sua vez, {me}!
          </p>
        )}
        {feed.length > 0 && (
          <ol className="player-feed" aria-label="Rolagens da mesa" aria-live="polite">
            {feed.slice(0, 3).map((r) => (
              <li key={r.id} className={`player-roll tone-${r.tone}${r.mine ? ' is-mine' : ''}`}>
                <span className="player-roll-total tabular">{r.total}</span>
                <span className="player-roll-body">
                  <span className="player-roll-label">
                    {r.mine ? 'Você' : r.who} · {rollLabel(r)}
                  </span>
                  <span className="player-roll-detail">
                    {r.verdict && (
                      <strong>
                        {r.verdict}
                        {r.checked && <Check size={12} aria-label="conferido pelo mestre" />}
                      </strong>
                    )}{' '}
                    {r.expression} [{r.faces.join(', ')}]{r.physical ? ' · dado físico' : ''}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
        {me ? (
          <div className="player-dock-actions">
            {canDamage && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() =>
                  go({ roll: lastAttack, name: `${lastAttack.name} (dano${crit ? ' crítico' : ''})`, kind: 'dano', expression: crit ? critDamage(lastAttack.damage!, lastAttack.mult ?? 2) : lastAttack.damage! }, last.aim)
                }
              >
                Rolar dano{crit ? ' crítico' : ''}
              </button>
            )}
            <button type="button" className="btn btn-primary player-roll-btn" onClick={() => setRolling(true)}>
              <Dices size={16} aria-hidden="true" /> Rolar como {me}
            </button>
          </div>
        ) : (
          codex.party.length === 0 && (
            <div className="player-dock-actions">
              <button type="button" className="btn btn-primary player-roll-btn" onClick={() => setRolling(true)}>
                <Dices size={16} aria-hidden="true" /> Rolar
              </button>
            </div>
          )
        )}
      </aside>

      {rolling && (
        <RollSheet
          me={me}
          rolls={rolls}
          physical={physical}
          onPhysical={(v) => {
            setPhysical(v)
            remember('codex-dados', v ? 'fisico' : 'app')
          }}
          onChangeMe={() => {
            setRolling(false)
            onMe(null)
          }}
          onClose={() => setRolling(false)}
          onPick={start}
        />
      )}

      {aiming && (
        <Modal title={`${aiming.name}: em quem?`} size="sm" onClose={() => setAiming(null)}>
          <ul className="target-list">
            {others.map((e) => (
              <li key={e.id}>
                <button type="button" className={`target${e.down ? ' is-down' : ''}`} onClick={() => go(aiming, { id: e.id, name: e.name })}>
                  <span className="target-name">{e.name}</span>
                  <span className="target-meta small">{e.down ? 'derrotado' : e.current ? 'na vez' : ''}</span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => go(aiming)}>
            Sem alvo
          </button>
          <p className="muted tiny">O mestre confere com a Defesa do alvo e diz se acertou.</p>
        </Modal>
      )}

      {asking && (
        <PhysicalRollDialog
          system={rules}
          outcome={asking.outcome}
          who={me ?? undefined}
          onClose={() => setAsking(null)}
          onDone={(o) => {
            setAsking(null)
            send(o, asking.pending, asking.aim)
          }}
          onDigital={() => {
            setAsking(null)
            send(asking.outcome, asking.pending, asking.aim)
          }}
        />
      )}
    </>
  )
}

function RollSheet({
  me,
  rolls,
  physical,
  onPhysical,
  onChangeMe,
  onClose,
  onPick,
}: {
  me: string | null
  rolls: CodexRoll[]
  physical: boolean
  onPhysical: (v: boolean) => void
  onChangeMe: () => void
  onClose: () => void
  onPick: (p: Pending) => void
}) {
  const [query, setQuery] = useState('')
  const attacks = rolls.filter((r) => r.kind === 'ataque')
  const attrs = rolls.filter((r) => r.kind === 'atributo')
  const skills = rolls.filter((r) => r.kind === 'pericia')
  const shown = query ? skills.filter((k) => fold(k.name).includes(fold(query))) : skills.filter((k) => k.trained)
  const pick = (r: CodexRoll) => onPick({ roll: r, name: r.name, kind: r.kind, expression: r.expression, target: r.target, critFrom: r.critFrom })

  return (
    <Modal title={me ? `Rolar como ${me}` : 'Rolar'} size="sm" onClose={onClose} help="rolar">
      <div className="player-sheet">
        <div className="segmented" role="radiogroup" aria-label="Dados">
          {(
            [
              [true, 'Dado de verdade'],
              [false, 'No celular'],
            ] as const
          ).map(([v, label]) => (
            <button key={label} type="button" role="radio" aria-checked={physical === v} onClick={() => onPhysical(v)}>
              {label}
            </button>
          ))}
        </div>

        {attacks.length > 0 && (
          <section aria-labelledby="ps-atq">
            <h3 id="ps-atq" className="player-sheet-h">
              Ataques
            </h3>
            <ul className="player-sheet-attacks">
              {attacks.map((a) => (
                <li key={a.name}>
                  <span className="sp-item-name">{a.name}</span>
                  {a.expression && (
                    <button type="button" className="sp-roll" aria-label={`Atacar com ${a.name}`} onClick={() => pick(a)}>
                      <Crosshair size={13} aria-hidden="true" /> {a.expression.replace(/^1d20/, '')}
                    </button>
                  )}
                  {a.damage && (
                    <button type="button" className="sp-roll sp-roll-damage" aria-label={`Dano de ${a.name}: ${a.damage}`} onClick={() => onPick({ roll: a, name: `${a.name} (dano)`, kind: 'dano', expression: a.damage! })}>
                      {a.damage}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {attrs.length > 0 && (
          <section aria-labelledby="ps-atr">
            <h3 id="ps-atr" className="player-sheet-h">
              Atributos
            </h3>
            <div className="chips">
              {attrs.map((a) => (
                <button key={a.name} type="button" className="chip" onClick={() => pick(a)}>
                  {a.name}
                </button>
              ))}
            </div>
          </section>
        )}

        {skills.length > 0 && (
          <section aria-labelledby="ps-per">
            <h3 id="ps-per" className="player-sheet-h">
              Perícias
            </h3>
            <label className="sp-search">
              <Search size={14} aria-hidden="true" />
              <input className="input input-sm" aria-label="Procurar perícia" placeholder="Procurar perícia…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <div className="chips">
              {shown.map((k) => (
                <button key={k.name} type="button" className="chip" onClick={() => pick(k)}>
                  {k.name}
                </button>
              ))}
              {shown.length === 0 && <span className="muted small">{query ? 'Nenhuma perícia com esse nome.' : 'Procure qualquer perícia acima.'}</span>}
            </div>
          </section>
        )}

        <section aria-labelledby="ps-dados">
          <h3 id="ps-dados" className="player-sheet-h">
            Dado livre
          </h3>
          <div className="chips">
            {FREE.map((d) => (
              <button key={d} type="button" className="chip" onClick={() => onPick({ roll: null, name: d, kind: 'livre', expression: d })}>
                {d}
              </button>
            ))}
          </div>
        </section>

        {me && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onChangeMe}>
            Não sou {me}
          </button>
        )}
      </div>
    </Modal>
  )
}
