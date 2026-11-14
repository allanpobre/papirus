import { useWorkspace } from '../../state/workspace'
import { isDown, lifeOf } from '../../rpg/combat'
import type { CombatTarget } from '../../rpg/rolls'
import { Modal } from '../../ui/Modal'
import { useRpg } from './rpgContext'

export function TargetPicker({ title, targets, onPick, onClose }: { title: string; targets: CombatTarget[]; onPick: (t: CombatTarget | null) => void; onClose: () => void }) {
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
