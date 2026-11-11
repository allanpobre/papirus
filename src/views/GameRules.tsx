import { Dices } from 'lucide-react'
import { useState } from 'react'
import type { Entity } from '../model/schema'
import { patch } from '../model/universe'
import { GAME_KINDS } from '../rpg/worldBonuses'
import { useWorkspace } from '../state/workspace'
import { Fold } from '../ui/Fold'

/** Siglas de atributo dos sistemas do universo (sem repetir), na ordem em que aparecem. */
function abbrs(systems: { attributes: { abbr: string }[] }[]): string[] {
  const seen = new Map<string, string>()
  for (const s of systems) for (const a of s.attributes) if (a.abbr.trim() && !seen.has(a.abbr.trim().toUpperCase())) seen.set(a.abbr.trim().toUpperCase(), a.abbr.trim())
  return [...seen.values()]
}

/**
 * "No jogo" numa espécie ou cultura: traços e modificadores para a Mesa, separados da história.
 * Só aparece quando o universo tem Mesa. Os personagens ligados a esta ficha recebem os bônus.
 */
export function GameRules({ entity: e }: { entity: Entity }) {
  const { universe, update } = useWorkspace()
  const [traitsText, setTraitsText] = useState((e.game?.traits ?? []).join('\n'))
  if (!GAME_KINDS.includes(e.kind) || (universe.groups.length === 0 && universe.settings.kind !== 'campanha')) return null
  const game = e.game ?? { traits: [], mods: {} }
  const set = (next: typeof game) => update((u) => patch(u, 'entities', e.id, { game: next }))
  const keys = abbrs(universe.systems)

  return (
    <Fold id="ficha-no-jogo" title="No jogo" defaultOpen={Boolean(e.game)}>
      <p className="muted small">
        <Dices size={14} aria-hidden="true" /> Para a Mesa, separado da história. Quem estiver ligado a esta ficha (por ligação ou campo) recebe os bônus na ficha de jogo, à vista.
      </p>
      {keys.length > 0 && (
        <div className="game-mods" role="group" aria-label="Modificadores">
          {keys.map((k) => (
            <label key={k} className="game-mod">
              <span>{k}</span>
              <input
                className="input tabular"
                type="number"
                aria-label={`Modificador de ${k}`}
                value={game.mods[k] ?? 0}
                onChange={(ev) => {
                  const n = Number(ev.target.value) || 0
                  const mods = { ...game.mods }
                  if (n) mods[k] = n
                  else delete mods[k]
                  set({ ...game, mods })
                }}
              />
            </label>
          ))}
        </div>
      )}
      <label className="field">
        <span className="field-label">Traços (um por linha)</span>
        <textarea
          className="input textarea"
          rows={3}
          value={traitsText}
          placeholder={'Visão no escuro\nDeslocamento 9 m'}
          onChange={(ev) => setTraitsText(ev.target.value)}
          onBlur={() => set({ ...game, traits: traitsText.split('\n').map((t) => t.trim()).filter(Boolean) })}
        />
      </label>
    </Fold>
  )
}
