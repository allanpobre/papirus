import { Crosshair, Skull, Swords } from 'lucide-react'
import { useState } from 'react'
import type { Session } from '../../model/schema'
import { byId, insert } from '../../model/universe'
import { baseName, monsterFromEntry } from '../../rpg/bestiary'
import { isDown } from '../../rpg/combat'
import { currentId } from '../../rpg/fight'
import { damageExpression } from '../../rpg/rolls'
import { makeSystem } from '../../rpg/systems'
import { useWorkspace } from '../../state/workspace'
import { useRpg } from './rpgContext'
import { useAttack, type AttackSpec } from './useAttack'

const FALLBACK = makeSystem('narrativo')
const signed = (n: number) => (n >= 0 ? `+${n}` : String(n))

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
