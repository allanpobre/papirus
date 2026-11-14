import { useState } from 'react'
import { combatTargets } from '../../rpg/combat'
import { aimAt, resolveRoll, type CombatTarget } from '../../rpg/rolls'
import { critFrom, critMult } from '../../rpg/sheets'
import { makeSystem } from '../../rpg/systems'
import { useWorkspace } from '../../state/workspace'
import { useRpg } from './rpgContext'
import { TargetPicker } from './TargetPicker'

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
