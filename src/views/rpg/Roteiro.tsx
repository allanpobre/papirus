import { Check, Play, Plus, ScrollText, Skull, Users, X } from 'lucide-react'
import { useState } from 'react'
import type { Session } from '../../model/schema'
import { patch } from '../../model/universe'
import { sortedMonsters } from '../../rpg/bestiary'
import { addBeat, editBeat, playBeat, removeBeat, toggleBeat } from '../../rpg/stage'
import { defenseLabel } from '../../rpg/sheets'
import { useWorkspace } from '../../state/workspace'
import { Fold } from '../../ui/Fold'
import { monsterLine } from './Bestiary'
import { useRpg } from './rpgContext'
import { SecretsPanel } from './Secrets'

/**
 * O roteiro do mestre (o primeiro painel do escudo): a folha de preparação do "mestre preguiçoso".
 * Início forte, as cenas possíveis (tocar começa a cena; riscar passa para a próxima) e os
 * segredos e pistas, para revelar num toque. O resto fica recolhido.
 */
export function Roteiro({ session, onSheet }: { session: Session; onSheet: (sheetId: string) => void }) {
  const { universe, update, readOnly } = useWorkspace()
  const { group, system } = useRpg()
  const [title, setTitle] = useState('')
  const set = (c: Partial<Session>) => update((u) => patch(u, 'sessions', session.id, c))
  const npcs = universe.sheets.filter((s) => s.groupId === group.id && s.role === 'npc')
  const monsters = sortedMonsters(universe)
  const done = session.beats.filter((b) => b.done).length

  return (
    <section className="shield-panel shield-roteiro" aria-label="Roteiro">
      <header className="shield-head">
        <h2 className="shield-title">Roteiro</h2>
        <span className="muted tiny">só você vê</span>
      </header>

      <div className="shield-card">
        <label className="shield-label" htmlFor="sm-inicio">
          Início forte
        </label>
        <textarea
          id="sm-inicio"
          className="input textarea shield-start"
          rows={3}
          readOnly={readOnly}
          placeholder="A primeira cena, já com algo acontecendo: um corvo pousa na mesa com uma chave no bico…"
          value={session.strongStart}
          onChange={(e) => set({ strongStart: e.target.value })}
        />
      </div>

      <div className="shield-card" role="group" aria-label="Cenas">
        <p className="shield-label">
          Cenas{' '}
          {session.beats.length > 0 && (
            <span className="muted">
              · {done} de {session.beats.length} jogadas
            </span>
          )}
        </p>
        {session.beats.length === 0 && <p className="muted small">As cenas que podem acontecer. Não precisa de ordem: toque na que começar.</p>}
        <ul className="beat-list">
          {session.beats.map((b) => {
            const now = b.id === session.beatId
            return (
              <li key={b.id} className={`beat${b.done ? ' is-done' : ''}${now ? ' is-now' : ''}`}>
                <button type="button" className="beat-check" aria-pressed={b.done} aria-label={`${b.done ? 'Desriscar' : 'Riscar'} ${b.title}`} disabled={readOnly} onClick={() => update((u) => toggleBeat(u, session.id, b.id))}>
                  {b.done && <Check size={12} aria-hidden="true" />}
                </button>
                <button
                  type="button"
                  className="beat-title"
                  aria-current={now ? 'step' : undefined}
                  aria-label={now ? `${b.title} (agora)` : `Começar a cena: ${b.title}`}
                  disabled={readOnly || now}
                  onClick={() => update((u) => playBeat(u, session.id, b.id))}
                >
                  {b.title}
                  {now ? (
                    <span className="beat-now">agora</span>
                  ) : (
                    !b.done &&
                    !readOnly && (
                      <span className="beat-play" aria-hidden="true">
                        <Play size={11} />
                      </span>
                    )
                  )}
                </button>
                {!readOnly && (
                  <button type="button" className="btn-icon btn-xs" aria-label={`Tirar a cena ${b.title}`} onClick={() => update((u) => removeBeat(u, session.id, b.id))}>
                    <X size={12} />
                  </button>
                )}
                {now && !readOnly && (
                  <input
                    className="input input-sm beat-mood"
                    aria-label={`Clima da cena ${b.title}`}
                    placeholder="O clima, para os jogadores: vento forte, pedra molhada…"
                    value={b.mood}
                    onChange={(e) => update((u) => editBeat(u, session.id, b.id, { mood: e.target.value.slice(0, 160) }))}
                  />
                )}
              </li>
            )
          })}
        </ul>
        {!readOnly && (
          <form
            className="inline-fields beat-add"
            onSubmit={(e) => {
              e.preventDefault()
              if (!title.trim()) return
              update((u) => addBeat(u, session.id, title))
              setTitle('')
            }}
          >
            <label htmlFor="sm-cena" className="sr-only">
              Nova cena
            </label>
            <input id="sm-cena" className="input input-sm" placeholder="Nova cena…" value={title} onChange={(e) => setTitle(e.target.value)} />
            <button type="submit" className="btn btn-sm" disabled={!title.trim()}>
              <Plus size={14} /> Cena
            </button>
          </form>
        )}
      </div>

      <SecretsPanel />

      <Fold id="sm-preparacao" title="Preparação livre" defaultOpen={Boolean(session.prep.trim())}>
        <label htmlFor="sm-prep" className="sr-only">
          Preparação da sessão
        </label>
        <textarea id="sm-prep" className="input textarea" rows={4} readOnly={readOnly} placeholder="Ganchos, nomes de reserva, o que mais quiser à mão…" value={session.prep} onChange={(e) => set({ prep: e.target.value })} />
      </Fold>

      <Fold
        id="sm-npcs"
        defaultOpen={false}
        title={
          <>
            <Users size={15} aria-hidden="true" /> NPCs da mesa <span className="fold-count">{npcs.length}</span>
          </>
        }
      >
        {npcs.length === 0 ? (
          <p className="muted small">Nenhum NPC com ficha nesta mesa. Crie em Personagens, como "NPC do mestre".</p>
        ) : (
          <ul className="plain-list shield-rows">
            {npcs.map((n) => (
              <li key={n.id}>
                <span>{n.name}</span>
                <button type="button" className="btn btn-ghost btn-xs" aria-label={`Ficha de ${n.name}`} onClick={() => onSheet(n.id)}>
                  <ScrollText size={13} /> Ficha
                </button>
              </li>
            ))}
          </ul>
        )}
      </Fold>

      <Fold
        id="sm-inimigos"
        defaultOpen={false}
        title={
          <>
            <Skull size={15} aria-hidden="true" /> Inimigos prontos <span className="fold-count">{monsters.length}</span>
          </>
        }
      >
        {monsters.length === 0 ? (
          <p className="muted small">Nenhum ainda. Crie em Dados e tabelas, ou na hora do combate.</p>
        ) : (
          <ul className="plain-list shield-rows">
            {monsters.map((m) => (
              <li key={m.id}>
                <span>
                  <strong>{m.name}</strong> <span className="muted tiny">{monsterLine(m, defenseLabel(system))}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Fold>
    </section>
  )
}
