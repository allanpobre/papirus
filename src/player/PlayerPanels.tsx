import { Check, Crosshair, Dices, Swords, X } from 'lucide-react'
import { Picture } from '../images/Picture'
import { bonusLabel } from '../rpg/rolls'
import type { CodexRoll, CodexSnapshot } from '../share/snapshot'
import { ClockFace } from '../ui/ClockFace'
import { RollingDie } from '../ui/RollingDie'
import { PartyCard } from '../views/rpg/CodexDoc'
import type { FeedRoll } from './PlayerTable'
import { rollLabel } from './PlayerTable'

type Pc = CodexSnapshot['party'][number]
type Combat = NonNullable<CodexSnapshot['combat']>

/** "Goblin das falésias 2" → "G2"; "Brisa" → "B". */
export const initials = (name: string) => (name.trim()[0] ?? '?').toUpperCase() + (name.match(/(\d+)$/)?.[1] ?? '')

/**
 * O cartão do personagem (a aba "Eu"): a vida grande, a defesa, os ataques e os testes a um toque.
 * É a ficha que se usa jogando; a ficha completa fica recolhida embaixo.
 */
export function MeCard({ pc, rolls, onRoll, onAll, onChange }: { pc: Pc; rolls: CodexRoll[]; onRoll: (r: CodexRoll) => void; onAll: () => void; onChange: () => void }) {
  const attacks = rolls.filter((r) => r.kind === 'ataque')
  const skills = rolls.filter((r) => r.kind === 'pericia' && r.trained)
  const attrs = rolls.filter((r) => r.kind === 'atributo')
  const [main, ...pools] = pc.pools ?? []
  return (
    <div className="me-card">
      <div className="me-head">
        {pc.image ? (
          <Picture value={pc.image} alt={`Retrato de ${pc.name}`} className="me-portrait" />
        ) : (
          <span className="me-portrait is-letter" aria-hidden="true">
            {initials(pc.name)}
          </span>
        )}
        <div className="me-who">
          <h2 className="me-name">{pc.name}</h2>
          <p className="muted small">{[pc.player, ...pc.fields.map(([, v]) => v)].filter(Boolean).join(' · ')}</p>
          {pc.away && <p className="codex-pc-away small">{pc.away === 'fora' ? 'Fora desta sessão' : 'Com o mestre nesta sessão'}</p>}
        </div>
        <button type="button" className="btn btn-ghost btn-xs" onClick={onChange}>
          Trocar
        </button>
      </div>

      {main && <Pool pool={main} big />}
      {(pools.length > 0 || (pc.values?.length ?? 0) > 0) && (
        <div className="me-stats">
          {pools.map((p) => (
            <Pool key={p[0]} pool={p} />
          ))}
          {pc.values?.map(([abbr, v]) => (
            <span key={abbr} className="me-stat">
              <strong className="tabular">{v}</strong>
              <small>{abbr}</small>
            </span>
          ))}
        </div>
      )}
      {(pc.conditions?.length ?? 0) > 0 && (
        <p className="me-conds">
          {pc.conditions!.map((c) => (
            <span key={c} className="codex-order-tag is-cond">
              {c}
            </span>
          ))}
        </p>
      )}

      {attacks.length > 0 && (
        <section className="me-section" aria-labelledby="me-atacar">
          <h3 id="me-atacar" className="me-label">
            Atacar
          </h3>
          {attacks.map((a) => (
            <button key={a.name} type="button" className="me-attack" disabled={!a.expression} onClick={() => onRoll(a)}>
              <Crosshair size={16} aria-hidden="true" />
              <span className="me-attack-name">
                <strong>{a.name}</strong>
                {a.damage && <span className="muted small">dano {a.damage}</span>}
              </span>
              {a.expression && <span className="me-attack-num tabular">{bonusLabel(a.expression)}</span>}
            </button>
          ))}
        </section>
      )}

      {(skills.length > 0 || attrs.length > 0) && (
        <section className="me-section" aria-labelledby="me-testes">
          <h3 id="me-testes" className="me-label">
            Testes
          </h3>
          <div className="chips">
            {[...skills, ...attrs].map((r) => (
              <button key={`${r.kind}-${r.name}`} type="button" className="chip me-test" onClick={() => onRoll(r)}>
                {r.name} <span className="tabular muted">{bonusLabel(r.expression)}</span>
              </button>
            ))}
          </div>
        </section>
      )}
      <button type="button" className="btn btn-ghost btn-sm me-all" onClick={onAll}>
        <Dices size={15} /> Todas as rolagens
      </button>

      <details className="me-sheet">
        <summary>Ficha completa</summary>
        <PartyCard s={pc} />
      </details>
    </div>
  )
}

function Pool({ pool: [abbr, cur, max], big = false }: { pool: [string, number, number]; big?: boolean }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0
  return (
    <div className={`me-pool${big ? ' is-big' : ''}${pct <= 25 ? ' is-low' : ''}`}>
      <span className="me-pool-label">
        <span>{abbr}</span>
        <strong className="tabular">
          {cur}/{max}
        </strong>
      </span>
      <span className="resource-bar" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </span>
    </div>
  )
}

/** A cena que o mestre escolheu, com o clima, e os relógios que ele mostra. */
export function SceneBoard({ codex }: { codex: CodexSnapshot }) {
  const clocks = codex.clocks ?? []
  if (!codex.scene && !clocks.length) return null
  return (
    <>
      {codex.scene && (
        <div className="stage-card" role="group" aria-label="Cena">
          <span className="stage-kick">Cena</span>
          <strong className="stage-title">{codex.scene.title}</strong>
          {codex.scene.mood && <span className="stage-mood">{codex.scene.mood}</span>}
        </div>
      )}
      {clocks.length > 0 && (
        <ul className="clocks plain-list" aria-label="Relógios">
          {clocks.map((c) => (
            <li key={c.id} className={`clock-chip${c.filled >= c.size ? ' is-full' : ''}`}>
              <ClockFace size={c.size} filled={c.filled} />
              <span className="clock-text">
                <strong>{c.name}</strong>
                <span className="muted tiny">
                  {c.filled} de {c.size}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

/** O combate visto do celular: a fila de turnos, com você marcado. */
export function CombatBoard({ combat, me }: { combat: Combat; me: string | null }) {
  const heroes = combat.mode === 'lados' && combat.side === 'herois'
  return (
    <section className="player-combat" aria-labelledby="pc-combate">
      <h2 id="pc-combate" className="me-label">
        <Swords size={14} aria-hidden="true" /> Combate · Rodada {combat.round}
        {heroes && <span className="muted"> · vez dos heróis</span>}
        {combat.mode === 'lados' && combat.side === 'inimigos' && <span className="muted"> · vez dos inimigos</span>}
      </h2>
      <ol className="turn-queue" aria-label="Fila de turnos">
        {combat.order.map((e) => (
          <li
            key={e.id}
            className={`tq is-${e.pc ? 'herois' : 'inimigos'}${e.current ? ' is-now' : ''}${e.acted ? ' is-done' : ''}${e.down ? ' is-down' : ''}${e.name === me ? ' is-me' : ''}`}
            aria-current={e.current ? 'step' : undefined}
          >
            <span className="tq-btn">
              <span className="tq-face" aria-hidden="true">
                {initials(e.name)}
                {(e.conditions?.length ?? 0) > 0 && <span className="tq-cond" />}
              </span>
              <span className="tq-name">{e.name === me ? 'Você' : e.name}</span>
              {e.current && !heroes && <span className="sr-only">na vez</span>}
              {e.down && <span className="sr-only">derrotado</span>}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** As últimas rolagens da mesa (a sua e as dos outros), a mais nova no d20 que gira. */
export function Feed({ feed }: { feed: FeedRoll[] }) {
  if (!feed.length) return null
  return (
    <ol className="player-feed" aria-label="Rolagens da mesa" aria-live="polite">
      {feed.slice(0, 4).map((r, i) => (
        <li key={r.id} className={`player-roll tone-${r.tone}${r.mine ? ' is-mine' : ''}`}>
          {i === 0 ? <RollingDie value={r.total} fresh className="player-roll-total" /> : <span className="player-roll-total tabular">{r.total}</span>}
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
  )
}

/**
 * A sua vez, no meio da tela: os seus ataques a um toque e "Terminei". Na pipoca, quem
 * terminou escolhe quem vem depois.
 */
export function YourTurn({
  me,
  combat,
  attacks,
  onAttack,
  onOther,
  onDone,
  onClose,
}: {
  me: string
  combat: Combat
  attacks: CodexRoll[]
  onAttack: (r: CodexRoll) => void
  onOther: () => void
  onDone: (to?: string) => void
  onClose: () => void
}) {
  const popcorn = combat.mode === 'pipoca'
  const left = combat.order.filter((e) => !e.current && !e.acted && !e.down)
  const next = left.length ? left : combat.order.filter((e) => !e.down)
  return (
    <div className="player-moment player-ask player-turn-now" role="dialog" aria-modal="true" aria-label={`Sua vez, ${me}`}>
      <button type="button" className="btn-icon player-ask-close" aria-label="Fechar" onClick={onClose}>
        <X size={18} />
      </button>
      <p className="player-moment-kicker">
        <Swords size={15} aria-hidden="true" /> Rodada {combat.round}
        {combat.mode === 'lados' ? ' · vez dos heróis' : ''}
      </p>
      <p className="player-moment-title">Sua vez, {me}!</p>
      {attacks.length > 0 && (
        <div className="player-turn-acts">
          {attacks.map((a) => (
            <button key={a.name} type="button" className="btn btn-primary player-ask-roll" disabled={!a.expression} onClick={() => onAttack(a)}>
              <Crosshair size={18} /> {a.name} {a.expression && <span className="tabular">{bonusLabel(a.expression)}</span>}
            </button>
          ))}
        </div>
      )}
      <button type="button" className="btn btn-sm" onClick={onOther}>
        <Dices size={15} /> Outra rolagem
      </button>
      {popcorn ? (
        <div className="player-pass" role="group" aria-label="Terminei: quem vem agora?">
          <p className="player-moment-sub">{left.length ? 'Terminei: quem vem agora?' : 'Todos agiram. Quem começa a próxima rodada?'}</p>
          <div className="chips">
            {next.map((e) => (
              <button key={e.id} type="button" className={`chip popcorn-pick is-${e.pc ? 'herois' : 'inimigos'}`} onClick={() => onDone(e.id)}>
                {e.name === me ? 'Eu' : e.name}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn-ghost player-done" onClick={() => onDone()}>
          <Check size={16} /> Terminei
        </button>
      )}
    </div>
  )
}
