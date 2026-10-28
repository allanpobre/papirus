import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { codexFor } from '../../logic/codex'
import { kindLabel, SESSION_STATUS_LABEL } from '../../model/labels'
import { draftGroup, draftSession, insert, patch, removeGroup } from '../../model/universe'
import { systemFromTemplate } from '../../rpg/systems'
import { useWorkspace } from '../../state/workspace'
import { Select } from '../../ui/bits'
import { ConfirmButton } from '../../ui/ConfirmButton'
import type { RpgTab } from './RpgView'
import { isPool } from '../../rpg/sheets'
import { useRpg } from './rpgContext'

/** Visão rápida do mestre: sistema, grupo, próxima sessão, segredos guardados, mistérios, elenco. */
export function GmTab({ onGo }: { onGo: (t: RpgTab) => void }) {
  const { universe, update, go, peek, undoable } = useWorkspace()
  const { group, system } = useRpg()
  const [newGroup, setNewGroup] = useState('')
  const sessions = universe.sessions.filter((s) => s.groupId === group.id).sort((a, b) => a.number - b.number)
  const next = sessions.find((s) => s.status !== 'encerrada')
  const last = [...sessions].reverse().find((s) => s.status === 'encerrada')
  const codex = codexFor(universe, group.id)
  const revealed = new Set(codex.entries.map((e) => e.entity.id))
  const secrets = universe.entities.filter((e) => (e.canon === 'secreto' || e.canon === 'desconhecido') && !revealed.has(e.id))
  const revealedFacts = new Set(codex.facts.map((f) => f.id))
  const secretFacts = universe.facts.filter((f) => f.canon === 'secreto' && !revealedFacts.has(f.id))
  const partially = codex.entries.filter((e) => e.depth !== 'completo')
  const mysteries = universe.seeds.filter((s) => s.kind === 'misterio' && s.status !== 'resolvida' && s.status !== 'abandonada')
  const party = universe.sheets.filter((s) => s.groupId === group.id && s.role === 'pj')
  const main = system?.resources.find(isPool)

  const newSession = () => {
    const number = (sessions.at(-1)?.number ?? 0) + 1
    update((u) => insert(u, 'sessions', draftSession(number, group.id))[0])
    onGo('sessoes')
  }

  const chooseSystem = (value: string) => {
    if (value.startsWith('modelo:')) {
      update((u) => {
        const [next, s] = insert(u, 'systems', systemFromTemplate(value.slice(7)))
        return patch(next, 'groups', group.id, { systemId: s.id })
      })
    } else update((u) => patch(u, 'groups', group.id, { systemId: value || null }))
  }

  return (
    <div className="gm">
      <section className="gm-card gm-next">
        <h2 className="section-title">Próxima sessão</h2>
        {next ? (
          <>
            <p className="gm-session-title">{next.title}</p>
            <p className="muted small">
              {SESSION_STATUS_LABEL[next.status]} · {new Date(next.playedOn + 'T12:00').toLocaleDateString('pt-BR')}
            </p>
            {next.prep ? <p className="gm-prep">{next.prep}</p> : <p className="muted small">Sem preparação ainda.</p>}
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onGo('sessoes')}>
              Abrir sessão
            </button>
          </>
        ) : (
          <>
            <p className="muted small">{last ? `Última: ${last.title}.` : 'Nenhuma sessão ainda.'}</p>
            <button type="button" className="btn btn-primary btn-sm" onClick={newSession}>
              <Plus size={14} /> Planejar sessão {(sessions.at(-1)?.number ?? 0) + 1}
            </button>
          </>
        )}
      </section>

      <section className="gm-card">
        <h2 className="section-title">Sistema da mesa</h2>
        <Select
          label="Sistema da mesa"
          value={group.systemId ?? ''}
          onChange={chooseSystem}
          options={[
            { value: '', label: 'Sem sistema' },
            ...universe.systems.map((s) => ({ value: s.id, label: s.name })),
            { value: 'modelo:d20-5e', label: '+ Novo: estilo D&D 5e' },
            { value: 'modelo:t20', label: '+ Novo: estilo Tormenta 20' },
            { value: 'modelo:op', label: '+ Novo: estilo Ordem Paranormal' },
            { value: 'modelo:d100', label: '+ Novo: estilo Call of Cthulhu' },
            { value: 'modelo:parada', label: '+ Novo: parada de dados d10' },
            { value: 'modelo:narrativo', label: '+ Novo: sem regras (narrativo)' },
          ]}
        />
        <p className="muted small">
          {system
            ? `${system.attributes.length} atributos, ${system.resources.length} recursos, ${system.skills.length} perícias. Iniciativa: ${system.initiativeFormula}.`
            : 'Sem sistema, a mesa usa d20 simples e fichas só com anotações.'}
        </p>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onGo('sistemas')}>
          Editar sistemas
        </button>
      </section>

      <section className="gm-card">
        <h2 className="section-title">Grupo ({party.length})</h2>
        {party.length === 0 ? (
          <p className="muted small">Nenhum personagem de jogador ainda.</p>
        ) : (
          <ul className="party">
            {party.map((p) => {
              const r = main ? (p.resources[main.id] ?? { current: main.default, max: main.default }) : null
              const pct = r && r.max > 0 ? Math.max(0, Math.min(100, (r.current / r.max) * 100)) : 0
              return (
                <li key={p.id} className="party-member">
                  <span className="party-name">{p.name}</span>
                  <span className="muted tiny">{p.player}</span>
                  {r && main && (
                    <span className="party-res" title={`${main.name}: ${r.current}/${r.max}`}>
                      <span className="resource-bar" aria-hidden="true">
                        <span style={{ width: `${pct}%` }} />
                      </span>
                      <span className="tabular tiny">
                        {main.abbr} {r.current}/{r.max}
                      </span>
                    </span>
                  )}
                  {p.conditions.length > 0 && <span className="party-cond tiny">{p.conditions.join(', ')}</span>}
                </li>
              )
            })}
          </ul>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onGo('personagens')}>
          Fichas dos personagens
        </button>
      </section>

      <section className="gm-card">
        <h2 className="section-title">
          <EyeOff size={15} aria-hidden="true" /> Segredos ainda guardados
        </h2>
        {secrets.length === 0 && secretFacts.length === 0 ? (
          <p className="muted small">Nada secreto escondido desta mesa.</p>
        ) : (
          <ul className="plain-list small">
            {secrets.map((e) => (
              <li key={e.id}>
                <button type="button" className="link-btn" onClick={() => peek(e.id)}>
                  {e.name}
                </button>{' '}
                <span className="muted">{kindLabel(e.kind)}</span>
              </li>
            ))}
            {secretFacts.map((f) => (
              <li key={f.id}>
                <span className="muted">Fato:</span> {[universe.entities.find((e) => e.id === f.subjectId)?.name, f.predicate, f.objectId ? universe.entities.find((e) => e.id === f.objectId)?.name : f.value].filter(Boolean).join(' ')}
              </li>
            ))}
          </ul>
        )}
        {partially.length > 0 && (
          <>
            <h3 className="section-label">Conhecidos só em parte</h3>
            <ul className="plain-list small">
              {partially.map(({ entity, depth }) => (
                <li key={entity.id}>
                  {entity.name} <span className="muted">— só {depth === 'nome' ? 'o nome' : 'o resumo'}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onGo('codex')}>
          <Eye size={14} /> Gerenciar revelações
        </button>
      </section>

      <section className="gm-card">
        <h2 className="section-title">Mistérios em jogo</h2>
        {mysteries.length === 0 ? (
          <p className="muted small">Nenhum mistério aberto.</p>
        ) : (
          <ul className="plain-list small">
            {mysteries.map((m) => (
              <li key={m.id}>
                <button type="button" className="link-btn" onClick={() => go('tramas', m.id)}>
                  {m.title}
                </button>{' '}
                <span className="muted">{m.clues.length} pistas</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="gm-card">
        <h2 className="section-title">Mesas</h2>
        <ul className="plain-list">
          {universe.groups.map((g) => (
            <li key={g.id} className="group-row">
              <input className="input input-sm" aria-label="Nome da mesa" value={g.name} onChange={(e) => update((u) => patch(u, 'groups', g.id, { name: e.target.value }))} />
              <ConfirmButton className="btn-icon btn-sm" title="Apagar mesa" question="Apagar a mesa e suas revelações?" confirmLabel="Apagar" onConfirm={() => undoable('Mesa apagada', (u) => removeGroup(u, g.id))}>
                <Trash2 size={14} aria-label="Apagar mesa" />
              </ConfirmButton>
            </li>
          ))}
        </ul>
        <form
          className="inline-fields"
          onSubmit={(e) => {
            e.preventDefault()
            if (!newGroup.trim()) return
            update((u) => insert(u, 'groups', draftGroup(newGroup.trim(), group.systemId))[0])
            setNewGroup('')
          }}
        >
          <label htmlFor="grupo-extra" className="sr-only">
            Nova mesa
          </label>
          <input id="grupo-extra" className="input input-sm" placeholder="Outra mesa…" value={newGroup} onChange={(e) => setNewGroup(e.target.value)} />
          <button type="submit" className="btn btn-ghost btn-sm">
            <Plus size={14} /> Mesa
          </button>
        </form>
        <p className="muted tiny">Cada mesa tem o próprio sistema, personagens e Codex: duas mesas no mesmo mundo podem saber coisas diferentes.</p>
      </section>
    </div>
  )
}
