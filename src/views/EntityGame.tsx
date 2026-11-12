import { Dices, Swords } from 'lucide-react'
import { openSheetInMesa } from './rpg/openInMesa'
import type { ReactNode } from 'react'
import type { Entity, Sheet } from '../model/schema'
import { byId } from '../model/universe'
import { sheetsOf } from '../rpg/oneCharacter'
import { attributeOf } from '../rpg/sheets'
import { useWorkspace } from '../state/workspace'

/**
 * A aba Jogo da ficha de um personagem: a ficha de jogo dele (vida, atributos, perícias e ataques),
 * para consultar sem sair do Mundo. Mexer na ficha fica na Mesa, a um toque.
 */
export function EntityGame({ entity, modeSwitch }: { entity: Entity; modeSwitch: ReactNode }) {
  const { universe } = useWorkspace()
  const sheets = sheetsOf(universe, entity.id)
  return (
    <article className="entity-game">
      <header className="entity-game-head">
        <h2 className="entity-game-name">{entity.name || 'Sem nome'}</h2>
        {modeSwitch}
      </header>
      {sheets.map((s) => (
        <GameSheet key={s.id} sheet={s} />
      ))}
    </article>
  )
}

function GameSheet({ sheet: s }: { sheet: Sheet }) {
  const { universe, go } = useWorkspace()
  const system = s.systemId ? byId(universe, 'systems', s.systemId) : undefined
  const group = s.groupId ? byId(universe, 'groups', s.groupId) : undefined
  const skills = (system?.skills ?? []).filter((k) => (s.skills[k.id] ?? 0) > 0)
  const open = () => {
    // Abre a Mesa no Grupo, com esta ficha aberta.
    openSheetInMesa(universe.id, s.groupId, s.id)
    go('rpg')
  }
  return (
    <section className="entity-game-sheet" aria-label={`Ficha de jogo de ${s.name}`}>
      <p className="entity-game-who">
        <Dices size={15} aria-hidden="true" />
        {s.role === 'pj' ? (s.player.trim() ? `Personagem de jogador · joga ${s.player.trim()}` : 'Personagem de jogador') : 'NPC do mestre'}
        {group && <span className="muted"> · {group.name}</span>}
        {system && <span className="muted"> · {system.name}</span>}
      </p>
      {system && system.resources.length > 0 && (
        <ul className="entity-game-pools" aria-label="Recursos">
          {system.resources.map((r) => {
            const v = s.resources[r.id]
            if (!v) return null
            const pct = v.max > 0 ? Math.max(0, Math.min(100, (v.current / v.max) * 100)) : 0
            return (
              <li key={r.id}>
                <span className="entity-game-pool-label">{r.abbr || r.name}</span>
                <span className="entity-game-bar" aria-hidden="true">
                  <span style={{ width: `${pct}%` }} />
                </span>
                <span className="tabular">
                  {v.current}/{v.max}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {system && system.attributes.length > 0 && (
        <dl className="entity-game-attrs" aria-label="Atributos">
          {system.attributes.map((a) => (
            <div key={a.id}>
              <dt title={a.name}>{a.abbr || a.name}</dt>
              <dd className="tabular">{attributeOf(system, s, a.id)}</dd>
            </div>
          ))}
        </dl>
      )}
      {skills.length > 0 && (
        <p className="entity-game-line">
          <strong>Perícias treinadas:</strong> {skills.map((k) => `${k.name} +${s.skills[k.id]}`).join(', ')}
        </p>
      )}
      {s.attacks.length > 0 && (
        <p className="entity-game-line">
          <strong>Ataques:</strong> {s.attacks.map((a) => `${a.name} (${a.bonus >= 0 ? '+' : ''}${a.bonus}${a.damage ? `, ${a.damage}` : ''})`).join(' · ')}
        </p>
      )}
      {s.conditions.length > 0 && (
        <p className="entity-game-line">
          <strong>Condições:</strong> {s.conditions.join(', ')}
        </p>
      )}
      {Object.entries(s.fields).some(([, v]) => v.trim()) && (
        <dl className="kv entity-game-fields">
          {Object.entries(s.fields)
            .filter(([, v]) => v.trim())
            .map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
        </dl>
      )}
      <button type="button" className="btn btn-sm" onClick={open}>
        <Swords size={14} /> Abrir na Mesa
      </button>
    </section>
  )
}
