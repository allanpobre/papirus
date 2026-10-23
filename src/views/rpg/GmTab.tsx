import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { codexFor } from '../../logic/codex'
import { kindLabel, SESSION_STATUS_LABEL } from '../../model/labels'
import type { Group } from '../../model/schema'
import { draftGroup, draftSession, insert, patch, removeGroup } from '../../model/universe'
import { useWorkspace } from '../../state/workspace'
import { ConfirmButton } from '../../ui/ConfirmButton'

/** Visão rápida do mestre: próxima sessão, segredos guardados, mistérios abertos, elenco. */
export function GmTab({ group, onGo }: { group: Group; onGo: (t: 'sessoes' | 'codex') => void }) {
  const { universe, update, go, peek, undoable } = useWorkspace()
  const [newGroup, setNewGroup] = useState('')
  const sessions = universe.sessions.filter((s) => s.groupId === group.id).sort((a, b) => a.number - b.number)
  const next = sessions.find((s) => s.status !== 'encerrada')
  const last = [...sessions].reverse().find((s) => s.status === 'encerrada')
  const codex = codexFor(universe, group.id)
  const revealed = new Set(codex.entries.map((e) => e.entity.id))
  const secrets = universe.entities.filter((e) => (e.canon === 'secreto' || e.canon === 'desconhecido') && !revealed.has(e.id))
  const partially = codex.entries.filter((e) => e.depth !== 'completo')
  const mysteries = universe.seeds.filter((s) => s.kind === 'misterio' && s.status !== 'resolvida' && s.status !== 'abandonada')
  const npcs = universe.entities.filter((e) => e.kind === 'personagem')

  const newSession = () => {
    const number = (sessions.at(-1)?.number ?? 0) + 1
    update((u) => insert(u, 'sessions', draftSession(number, group.id))[0])
    onGo('sessoes')
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
        <h2 className="section-title">
          <EyeOff size={15} aria-hidden="true" /> Segredos ainda guardados
        </h2>
        {secrets.length === 0 ? (
          <p className="muted small">Nenhuma ficha secreta escondida desta mesa.</p>
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
        <h2 className="section-title">Elenco ({npcs.length})</h2>
        <div className="chips">
          {npcs.map((e) => (
            <button key={e.id} type="button" className="chip chip-entity" onClick={() => peek(e.id)}>
              {e.name}
            </button>
          ))}
        </div>
      </section>

      <section className="gm-card">
        <h2 className="section-title">Grupos</h2>
        <ul className="plain-list">
          {universe.groups.map((g) => (
            <li key={g.id} className="group-row">
              <input className="input input-sm" aria-label="Nome do grupo" value={g.name} onChange={(e) => update((u) => patch(u, 'groups', g.id, { name: e.target.value }))} />
              <ConfirmButton className="btn-icon btn-sm" title="Apagar grupo" question="Apagar grupo e suas revelações?" confirmLabel="Apagar" onConfirm={() => undoable('Grupo apagado', (u) => removeGroup(u, g.id))}>
                <Trash2 size={14} aria-label="Apagar grupo" />
              </ConfirmButton>
            </li>
          ))}
        </ul>
        <form
          className="inline-fields"
          onSubmit={(e) => {
            e.preventDefault()
            if (!newGroup.trim()) return
            update((u) => insert(u, 'groups', draftGroup(newGroup.trim()))[0])
            setNewGroup('')
          }}
        >
          <label htmlFor="grupo-extra" className="sr-only">
            Novo grupo
          </label>
          <input id="grupo-extra" className="input input-sm" placeholder="Outro grupo…" value={newGroup} onChange={(e) => setNewGroup(e.target.value)} />
          <button type="submit" className="btn btn-ghost btn-sm">
            <Plus size={14} /> Grupo
          </button>
        </form>
        <p className="muted tiny">Cada grupo tem o próprio Codex: duas mesas no mesmo mundo podem saber coisas diferentes.</p>
      </section>
    </div>
  )
}
