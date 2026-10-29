import { Crosshair, Skull, Swords } from 'lucide-react'
import { useState } from 'react'
import type { Session } from '../../model/schema'
import { byId, insert } from '../../model/universe'
import { baseName, monsterFromEntry } from '../../rpg/bestiary'
import { combatTargets, isDown, lifeOf } from '../../rpg/combat'
import { currentId } from '../../rpg/fight'
import { aimAt, damageExpression, resolveRoll, type CombatTarget } from '../../rpg/rolls'
import { critFrom, critMult } from '../../rpg/sheets'
import { makeSystem } from '../../rpg/systems'
import { useWorkspace } from '../../state/workspace'
import { Modal } from '../../ui/Modal'
import { useRpg } from './rpgContext'

const FALLBACK = makeSystem('narrativo')
const signed = (n: number) => (n >= 0 ? `+${n}` : String(n))

/** Um ataque pronto para rolar: bônus do teste (sem teste em sistemas sem d20) e o dano já com os números. */
export interface AttackSpec {
  name: string
  bonus: number | null
  damage: string
  critical: string
}

/**
 * Rola um ataque. Em combate, pergunta antes em quem: com a Defesa do alvo, o teste diz
 * se acerta, e o dano pode sair direto da vida dele.
 */
export function useAttack() {
  const { universe, toast } = useWorkspace()
  const { system, activeSession, report } = useRpg()
  const [asking, setAsking] = useState<{ title: string; targets: CombatTarget[]; run: (t: CombatTarget | null) => void } | null>(null)

  const attack = (who: string, a: AttackSpec, part: 'teste' | 'dano', self: { sheetId?: string | null; entryId?: string | null }) => {
    const sys = system ?? FALLBACK
    const name = a.name || 'Ataque'
    const run = (target: CombatTarget | null) => {
      try {
        const o = part === 'teste' ? resolveRoll(sys, name, `1d20${signed(a.bonus ?? 0)}`, undefined, undefined, critFrom(a.critical)) : resolveRoll(sys, `${name} (dano)`, a.damage)
        const damage = a.damage.trim() ? { expression: a.damage, mult: critMult(a.critical) } : undefined
        report(target ? aimAt(o, part === 'teste' ? { target, damage } : { target, hurts: true }) : o, who)
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Rolagem inválida.', { tone: 'erro' })
      }
    }
    const targets = activeSession ? combatTargets(universe, activeSession, system, self) : []
    if (!targets.length) return run(null)
    setAsking({ title: part === 'teste' ? `${name}: em quem?` : `Dano de ${name}: em quem?`, targets, run })
  }

  const picker = asking && (
    <TargetPicker
      title={asking.title}
      targets={asking.targets}
      onClose={() => setAsking(null)}
      onPick={(t) => {
        setAsking(null)
        asking.run(t)
      }}
    />
  )
  return { attack, picker }
}

function TargetPicker({ title, targets, onPick, onClose }: { title: string; targets: CombatTarget[]; onPick: (t: CombatTarget | null) => void; onClose: () => void }) {
  const { universe } = useWorkspace()
  const { activeSession } = useRpg()
  const label = targets[0]?.defenseLabel ?? 'Defesa'
  return (
    <Modal title={title} size="sm" onClose={onClose}>
      <ul className="target-list">
        {targets.map((t) => {
          const entry = activeSession?.initiative.find((e) => e.id === t.id)
          const life = entry ? lifeOf(universe, entry) : null
          const down = entry ? isDown(universe, entry) : false
          return (
            <li key={t.id}>
              <button type="button" className={`target${down ? ' is-down' : ''}`} onClick={() => onPick(t)}>
                <span className="target-name">{t.name}</span>
                <span className="target-meta small">
                  {t.defenseLabel} {t.defense ?? '?'}
                  {life && ` · ${life.abbr} ${life.current}${life.max !== null ? `/${life.max}` : ''}`}
                  {down && ' · derrotado'}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onPick(null)}>
        Sem alvo
      </button>
      <p className="muted tiny">Com a {label} do alvo, o Papirus diz se acerta. Anote a de quem não tem ficha na iniciativa.</p>
    </Modal>
  )
}

/**
 * A vez de quem joga agora: os ataques da ficha a um toque; para quem não tem ficha
 * (o goblin anotado na hora), um ataque rápido com bônus e dano.
 */
export function TurnPanel({ session, entryId }: { session: Session; entryId?: string | null }) {
  const { universe, update, toast, readOnly } = useWorkspace()
  const { system } = useRpg()
  const { attack, picker } = useAttack()
  // Quem age: o da vez, ou (por lados, na vez dos heróis) quem o mestre tocou.
  const id = entryId ?? currentId(session)
  const entry = session.initiative.find((e) => e.id === id)
  if (!entry) return null
  const sheet = entry.sheetId ? byId(universe, 'sheets', entry.sheetId) : undefined
  const sheetSystem = sheet ? universe.systems.find((s) => s.id === sheet.systemId) : undefined
  const usesD20 = (system ?? FALLBACK).resolution === 'total'
  // Os ataques da ficha, ou os do inimigo pronto (o dano já vem com os números).
  const attacks = (sheet ? sheet.attacks : entry.attacks).filter((a) => usesD20 || a.damage.trim())
  const self = { sheetId: sheet?.id, entryId: entry.id }
  const saved = entry.monsterId ? universe.monsters.some((m) => m.id === entry.monsterId) : false
  const keep = (attack: { bonus: number; damage: string } | null) => {
    update((u) => insert(u, 'monsters', monsterFromEntry(entry, attack))[0])
    toast(`${baseName(entry.name)} está no bestiário (Dados e tabelas).`)
  }

  return (
    <section className="turn-panel" aria-label={`Vez de ${entry.name}`}>
      <p className="turn-who">
        <Swords size={15} aria-hidden="true" /> Vez de <strong>{entry.name}</strong>
        {isDown(universe, entry) && <span className="init-down">derrotado</span>}
      </p>
      {attacks.length > 0 ? (
        <div className="turn-attacks">
          {attacks.map((a) => {
            const damage = sheet ? damageExpression(sheetSystem ?? system, sheet, a.damage) : a.damage
            const spec = { name: a.name, bonus: a.bonus, damage, critical: a.critical }
            return (
              <button
                key={a.id}
                type="button"
                className="btn btn-sm turn-attack"
                aria-label={usesD20 ? `Atacar com ${a.name} (${signed(a.bonus)})` : `Dano de ${a.name} (${damage})`}
                onClick={() => attack(entry.name, spec, usesD20 ? 'teste' : 'dano', self)}
              >
                <Crosshair size={14} aria-hidden="true" /> {a.name} <span className="tabular turn-attack-num">{usesD20 ? signed(a.bonus) : damage}</span>
              </button>
            )
          })}
        </div>
      ) : (
        <QuickAttack key={entry.id} usesD20={usesD20} onAttack={(spec) => attack(entry.name, spec, usesD20 ? 'teste' : 'dano', self)} onKeep={!sheet && !saved && !readOnly ? keep : undefined} />
      )}
      {!sheet && !saved && attacks.length > 0 && !readOnly && (
        <button type="button" className="btn btn-ghost btn-xs turn-keep" onClick={() => keep(null)}>
          <Skull size={13} /> Guardar {baseName(entry.name)} no bestiário
        </button>
      )}
      {picker}
    </section>
  )
}

function QuickAttack({ usesD20, onAttack, onKeep }: { usesD20: boolean; onAttack: (a: AttackSpec) => void; onKeep?: (a: { bonus: number; damage: string }) => void }) {
  const [bonus, setBonus] = useState('')
  const [damage, setDamage] = useState('')
  return (
    <form
      className="turn-quick"
      onSubmit={(e) => {
        e.preventDefault()
        if (!usesD20 && !damage.trim()) return
        onAttack({ name: 'Ataque', bonus: Number(bonus) || 0, damage: damage.replace(/\s+/g, ''), critical: '' })
      }}
    >
      {usesD20 && (
        <label className="turn-quick-field">
          <span className="muted tiny">Bônus</span>
          <input className="input input-sm" inputMode="numeric" aria-label="Bônus do ataque" placeholder="+4" value={bonus} onChange={(e) => setBonus(e.target.value.replace(/[^\d-]/g, ''))} />
        </label>
      )}
      <label className="turn-quick-field">
        <span className="muted tiny">Dano</span>
        <input className="input input-sm" aria-label="Dano do ataque" placeholder="1d6+2" spellCheck={false} value={damage} onChange={(e) => setDamage(e.target.value)} />
      </label>
      <button type="submit" className="btn btn-sm">
        <Crosshair size={14} aria-hidden="true" /> {usesD20 ? 'Atacar' : 'Dano'}
      </button>
      {onKeep && (
        <button type="button" className="btn btn-ghost btn-xs turn-keep" title="Guarda a vida, a Defesa e este ataque para os próximos combates" onClick={() => onKeep({ bonus: Number(bonus) || 0, damage: damage.replace(/\s+/g, '') })}>
          <Skull size={13} /> Guardar no bestiário
        </button>
      )}
    </form>
  )
}
