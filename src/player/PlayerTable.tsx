import { BookOpen, Crosshair, Dices, ListChecks, Search, Swords, Theater, UserRound, type LucideIcon } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { fold } from '../logic/text'
import { bonusLabel, critDamage, facesOf, resolveRoll, type RollOutcome, type RollRules } from '../rpg/rolls'
import type { TableRoll } from '../share/server'
import type { CodexRoll, CodexSnapshot } from '../share/snapshot'
import { recall, remember } from '../state/prefs'
import { Modal } from '../ui/Modal'
import { useMediaQuery } from '../ui/useMediaQuery'
import { CombatBoard, Feed, MeCard, SceneBoard, YourTurn } from './PlayerPanels'
import { PhysicalRollDialog } from '../views/rpg/PhysicalRollDialog'

/** A hora da rolagem (fora do componente: só roda no toque). */
const nowIso = () => new Date().toISOString()
const LOOSE: RollRules = { resolution: 'total', successTarget: 0 }
const FREE = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']

type Tab = 'eu' | 'mesa' | 'codex'
const TABS: [Tab, string, LucideIcon][] = [
  ['eu', 'Eu', UserRound],
  ['mesa', 'Mesa', Theater],
  ['codex', 'Codex', BookOpen],
]

const askLabel = (r: { kind: string; name: string }) => (r.kind === 'iniciativa' ? 'Combate: role a iniciativa' : `Teste pedido: ${r.name}`)

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
  /** A resposta a um teste que o mestre pediu. */
  request?: string
}

/**
 * O jogador na mesa: escolhe quem é, rola pela própria ficha (o dado de verdade primeiro) e
 * vê as rolagens de todos. Nada muda no Codex por aqui: o mestre confere e decide.
 */
export function PlayerTable({
  codex,
  me,
  onMe,
  feed,
  onRoll,
  onTurn,
  live,
  codexView,
}: {
  codex: CodexSnapshot
  me: string | null
  onMe: (name: string | null) => void
  feed: FeedRoll[]
  onRoll: (r: TableRoll) => void
  /** "Terminei" (na pipoca, com quem vem depois). */
  onTurn: (to?: string) => void
  /** Quem está na mesa e o último aviso, no alto da aba Mesa. */
  live: ReactNode
  /** O Codex (a aba Codex). */
  codexView: ReactNode
}) {
  const wide = useMediaQuery('(min-width: 960px)')
  const [tab, setTab] = useState<Tab>(() => {
    const saved = recall('codex-aba')
    return saved === 'eu' || saved === 'codex' ? saved : 'mesa'
  })
  const choose = (t: Tab) => {
    setTab(t)
    remember('codex-aba', t)
    scrollTo({ top: 0 })
  }
  // A vez que o jogador já fechou (ou terminou): o aviso não volta até a próxima.
  const [closedTurn, setClosedTurn] = useState<string | null>(null)
  const [rolling, setRolling] = useState(false)
  const [aiming, setAiming] = useState<Pending | null>(null)
  const [asking, setAsking] = useState<{ outcome: RollOutcome; pending: Pending; aim?: TableRoll['aim'] } | null>(null)
  const [physical, setPhysical] = useState(() => recall('codex-dados') !== 'app')
  // Os testes pedidos que este celular já respondeu (some da tela antes do mestre confirmar).
  const [answered, setAnswered] = useState<string[]>([])
  // Os pedidos que o jogador deixou para depois (saem do meio da tela e ficam no alto).
  const [later, setLater] = useState<string[]>([])
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
    if (p.request) setAnswered((a) => [...a, p.request!])
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
      ...(p.request ? { request: p.request } : {}),
      total: o.result.total,
      verdict: o.verdict,
      tone: o.tone,
      at: nowIso(),
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

  // Os testes que o mestre pediu para mim (ou para todos) e eu ainda não rolei, já com a rolagem da ficha.
  const asks = (codex.requests ?? [])
    .filter((r) => me && pc?.away !== 'fora' && (!r.who.length || r.who.includes(me)) && !r.done.includes(me) && !answered.includes(r.id))
    .map((r) => {
      const fromSheet = r.kind === 'livre' ? undefined : rolls.find((x) => x.kind === r.kind && x.name === r.name)
      return { r, fromSheet, expression: r.kind === 'livre' ? r.expression : fromSheet?.expression }
    })
  const ask = asks.find((a) => !later.includes(a.r.id))
  const rollAsked = ({ r, fromSheet, expression }: (typeof asks)[number]) =>
    expression && go({ roll: fromSheet ?? null, name: r.name, kind: r.kind === 'livre' ? 'livre' : r.kind, expression, target: fromSheet?.target, request: r.id })
  // Chegou um pedido: o celular vibra (onde dá).
  const askId = ask?.r.id
  useEffect(() => {
    if (askId) navigator.vibrate?.([90, 60, 90])
  }, [askId])

  const pick = (r: CodexRoll): Pending => ({ roll: r, name: r.name, kind: r.kind, expression: r.expression, target: r.target, critFrom: r.critFrom })
  const attacks = rolls.filter((r) => r.kind === 'ataque')
  const turnKey = myTurn && combat ? `${combat.round}-${combat.order.find((e) => e.current && e.name === me)?.id}` : null
  const showTurn = Boolean(turnKey && turnKey !== closedTurn && !ask && !aiming && !asking && !rolling)
  const done = (to?: string) => {
    setClosedTurn(turnKey)
    onTurn(to)
  }

  const whoAmI = (
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
  )

  // A pessoa ainda não disse quem é: a aba "Eu" vem primeiro.
  const shown: Tab = !me && codex.party.length > 0 && tab === 'mesa' ? 'eu' : tab
  // No celular, as abas fora de vista continuam montadas (só escondidas): o Codex não perde o que estava aberto.
  const off = (t: Tab) => !wide && shown !== t

  const panels: Record<Tab, ReactNode> = {
    eu: (
      <section key="eu" className="player-panel player-eu" aria-label="Eu" hidden={off('eu')}>
        {pc && me ? (
          <MeCard pc={pc} rolls={rolls} onRoll={(r) => start(pick(r))} onAll={() => setRolling(true)} onChange={() => onMe(null)} />
        ) : codex.party.length > 0 ? (
          whoAmI
        ) : (
          <p className="muted small">Esta mesa ainda não tem fichas no Codex. Role pelo botão "Rolar".</p>
        )}
      </section>
    ),
    mesa: (
      <section key="mesa" className="player-panel player-live-board" aria-label="Mesa" hidden={off('mesa')}>
        {live}
        <SceneBoard codex={codex} />
        {combat && <CombatBoard combat={combat} me={me} />}
        {myTurn && (
          <p className="player-turn" role="status">
            <Swords size={15} aria-hidden="true" /> Sua vez, {me}!
          </p>
        )}
        <Feed feed={feed} />
        {!codex.scene && !combat && !feed.length && <p className="muted small player-quiet">Nada acontecendo na mesa agora. As rolagens, a cena e o combate aparecem aqui.</p>}
      </section>
    ),
    codex: (
      <section key="codex" className="player-panel player-codex" aria-label="Codex" hidden={off('codex')}>
        {codexView}
      </section>
    ),
  }

  return (
    <>
      {/* O pedido do mestre no meio da tela, com o botão de rolar; "Depois" guarda no alto. */}
      {ask && !aiming && !asking && (
        <div className={`player-moment player-ask${ask.r.kind === 'iniciativa' ? ' tone-perigo' : ''}`} role="dialog" aria-modal="true" aria-label={askLabel(ask.r)}>
          <p className="player-moment-kicker">
            {ask.r.kind === 'iniciativa' ? (
              <>
                <Swords size={15} aria-hidden="true" /> Combate!
              </>
            ) : (
              <>
                <ListChecks size={15} aria-hidden="true" /> O mestre pede um teste
              </>
            )}
          </p>
          <p className="player-moment-title">{ask.r.kind === 'iniciativa' ? 'Role a iniciativa' : ask.r.name}</p>
          {ask.expression ? (
            <button type="button" className="btn btn-primary player-ask-roll" autoFocus onClick={() => rollAsked(ask)}>
              <Dices size={20} /> Rolar {ask.r.name} ({ask.r.kind === 'livre' ? ask.expression : bonusLabel(ask.expression)})
            </button>
          ) : (
            <p className="player-moment-sub">Sua ficha no Codex não tem essa rolagem: role na mesa e diga o resultado ao mestre.</p>
          )}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLater((l) => [...l, ask.r.id])}>
            Depois
          </button>
        </div>
      )}
      {asks
        .filter((a) => later.includes(a.r.id))
        .map((a) => (
          <section key={a.r.id} className={`player-request${a.r.kind === 'iniciativa' ? ' is-fight' : ''}`} aria-label={askLabel(a.r)}>
            <p className="player-request-h">
              {a.r.kind === 'iniciativa' ? <Swords size={16} aria-hidden="true" /> : <ListChecks size={16} aria-hidden="true" />} {a.r.kind === 'iniciativa' ? 'Combate!' : 'O mestre pede um teste'}
            </p>
            {a.expression ? (
              <button type="button" className="btn btn-primary" onClick={() => rollAsked(a)}>
                <Dices size={16} /> Rolar {a.r.name} ({a.r.kind === 'livre' ? a.expression : bonusLabel(a.expression)})
              </button>
            ) : (
              <p className="muted small">Sua ficha no Codex não tem essa rolagem: role na mesa e diga o resultado ao mestre.</p>
            )}
          </section>
        ))}

      <div className={wide ? 'player-grid' : 'player-stack'}>{(['eu', 'mesa', 'codex'] as Tab[]).map((t) => panels[t])}</div>

      <div className="player-bottom">
        {(me || codex.party.length === 0) && (
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
              <Dices size={16} aria-hidden="true" /> {me ? `Rolar como ${me}` : 'Rolar'}
            </button>
          </div>
        )}
        {!wide && (
          <nav className="player-tabs" aria-label="Partes do Codex">
            {TABS.map(([t, label, Icon]) => (
              <button key={t} type="button" aria-current={shown === t ? 'page' : undefined} onClick={() => choose(t)}>
                <Icon size={19} aria-hidden="true" />
                <span>{label}</span>
                {t === 'mesa' && myTurn && shown !== 'mesa' && <span className="player-tab-dot" aria-label="sua vez" />}
              </button>
            ))}
          </nav>
        )}
      </div>

      {showTurn && me && combat && (
        <YourTurn me={me} combat={combat} attacks={attacks} onAttack={(r) => start(pick(r))} onOther={() => setRolling(true)} onDone={done} onClose={() => setClosedTurn(turnKey)} />
      )}

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
