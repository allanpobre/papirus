import { Dices, Flag, Play, Plus, Send, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { factSentence, revelationLabel } from '../../logic/codex'
import { SESSION_STATUS_LABEL } from '../../model/labels'
import { SESSION_STATUSES, type Group, type Revelation, type Session } from '../../model/schema'
import { byId, draftRevelation, draftSession, insert, newId, patch, remove, removeSession } from '../../model/universe'
import { useWorkspace } from '../../state/workspace'
import { Empty, Field, Select } from '../../ui/bits'
import { ConfirmButton } from '../../ui/ConfirmButton'
import { EntityPicker } from '../../ui/EntityPicker'
import { AttendanceList } from './Attendance'
import { InitiativeTracker } from './InitiativeTracker'
import { RecapEditor } from './Journal'
import { useRpg } from './rpgContext'

export function SessionsTab() {
  const { universe, update, nav } = useWorkspace()
  const { group, system } = useRpg()
  const sessions = universe.sessions.filter((s) => s.groupId === group.id).sort((a, b) => b.number - a.number)
  const [openId, setOpenId] = useState<string | null>(
    (nav.view === 'rpg' && nav.id && sessions.some((s) => s.id === nav.id) ? nav.id : null) ?? sessions.find((s) => s.status !== 'encerrada')?.id ?? sessions[0]?.id ?? null,
  )
  const session = openId ? byId(universe, 'sessions', openId) : undefined

  const create = () => {
    const number = Math.max(0, ...sessions.map((s) => s.number)) + 1
    let id = ''
    update((u) => {
      const [next, s] = insert(u, 'sessions', draftSession(number, group.id))
      id = s.id
      return next
    })
    setOpenId(id)
  }

  return (
    <div className={`split${session ? ' has-detail' : ''}`}>
      <section className="split-list" aria-label="Sessões">
        <button type="button" className="btn btn-primary" onClick={create}>
          <Plus size={16} /> Nova sessão
        </button>
        {sessions.length === 0 ? (
          <p className="muted small">Nenhuma sessão de {group.name} ainda.</p>
        ) : (
          <ul className="entity-list">
            {sessions.map((s) => (
              <li key={s.id}>
                <button type="button" className="entity-row" aria-current={s.id === openId ? 'true' : undefined} onClick={() => setOpenId(s.id)}>
                  <span className={`session-dot session-${s.status}`} aria-hidden="true" />
                  <span className="entity-row-name">{s.title}</span>
                  <span className="entity-row-kind">{SESSION_STATUS_LABEL[s.status]}</span>
                  <span className="entity-row-summary">{new Date(s.playedOn + 'T12:00').toLocaleDateString('pt-BR')}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="split-detail" aria-label="Sessão">
        {session ? (
          <SessionDetail key={session.id} session={session} group={group} showInitiative={system ? system.features.initiative : true} onDeleted={() => setOpenId(null)} />
        ) : (
          <Empty title="Escolha ou crie uma sessão." />
        )}
      </section>
    </div>
  )
}

function SessionDetail({ session: s, group, showInitiative, onDeleted }: { session: Session; group: Group; showInitiative: boolean; onDeleted: () => void }) {
  const { universe, update, undoable } = useWorkspace()
  const { startSession, endSession } = useRpg()
  const [note, setNote] = useState('')
  const [revealId, setRevealId] = useState<string | null>(null)
  const [depth, setDepth] = useState<Revelation['depth']>('resumo')
  const [factId, setFactId] = useState('')
  // Em andamento por outro caminho (o Estado, uma nota): guarda a hora do começo também.
  const set = (c: Partial<Session>) => update((u) => patch(u, 'sessions', s.id, c.status === 'em-andamento' && !s.startedAt ? { ...c, startedAt: new Date().toISOString() } : c))
  const revelations = universe.revelations.filter((r) => r.sessionId === s.id)

  const addNote = () => {
    if (!note.trim()) return
    const at = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    // Anotar não começa a sessão: começar é um momento (a abertura e o modo sessão), pelo botão "Começar".
    set({ log: [...s.log, { id: newId(), at, text: note.trim(), kind: 'nota' }] })
    setNote('')
  }

  return (
    <article className="session">
      <header className="session-head">
        <label htmlFor="session-title" className="sr-only">
          Título da sessão
        </label>
        <input id="session-title" className="entity-name" value={s.title} onChange={(e) => set({ title: e.target.value })} />
        <div className="inline-fields">
          {s.status === 'planejada' && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => startSession(s.id)}>
              <Play size={14} /> Começar
            </button>
          )}
          {s.status === 'em-andamento' && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => endSession(s.id)}>
              <Flag size={14} /> Encerrar sessão
            </button>
          )}
          <ConfirmButton
            className="btn-icon"
            title="Apagar sessão"
            question="Apagar esta sessão?"
            confirmLabel="Apagar"
            onConfirm={() => {
              undoable('Sessão apagada', (u) => removeSession(u, s.id))
              onDeleted()
            }}
          >
            <Trash2 size={16} aria-label="Apagar sessão" />
          </ConfirmButton>
        </div>
      </header>

      <div className="form-grid">
        <Field label="Número">
          {(id) => <input id={id} className="input input-year" inputMode="numeric" value={s.number} onChange={(e) => Number.isFinite(Number(e.target.value)) && set({ number: Math.trunc(Number(e.target.value)) })} />}
        </Field>
        <Field label="Data do jogo">
          {(id) => <input id={id} type="date" className="input" value={s.playedOn} onChange={(e) => set({ playedOn: e.target.value })} />}
        </Field>
        <Field label="Estado">
          {(id) => <Select id={id} value={s.status} onChange={(v) => set({ status: v })} options={SESSION_STATUSES.map((x) => ({ value: x, label: SESSION_STATUS_LABEL[x] }))} />}
        </Field>
        <Field label="Preparação" wide hint="Só o mestre vê. Ganchos, cenas possíveis, nomes de reserva.">
          {(id) => <textarea id={id} className="input textarea" rows={4} value={s.prep} onChange={(e) => set({ prep: e.target.value })} />}
        </Field>
      </div>

      <div className="session-cols">
        <section className="session-log">
          <h2 className="section-title">Registro da mesa</h2>
          <ol className="log">
            {s.log.map((l) => (
              <li key={l.id} className={l.kind === 'rolagem' ? 'log-roll' : undefined}>
                <span className="log-at tabular">{l.at}</span>
                <span className="log-text">
                  {l.kind === 'rolagem' && <Dices size={13} aria-label="Rolagem" />} {l.text}
                </span>
                <button type="button" className="btn-icon btn-xs" aria-label="Remover nota" onClick={() => set({ log: s.log.filter((x) => x.id !== l.id) })}>
                  <X size={12} />
                </button>
              </li>
            ))}
          </ol>
          <div className="log-input">
            <label htmlFor="nota-sessao" className="sr-only">
              Nova nota
            </label>
            <input
              id="nota-sessao"
              className="input"
              placeholder="O que aconteceu? Enter registra com a hora."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addNote()}
            />
            <button type="button" className="btn-icon" aria-label="Registrar nota" onClick={addNote}>
              <Send size={16} />
            </button>
          </div>
          <p className="muted tiny">Ao encerrar, o registro vai para Ideias. Nada vira canon sem a sua revisão.</p>
        </section>

        <section className="session-attendance" aria-labelledby="sessao-chamada">
          <h2 id="sessao-chamada" className="section-title">
            Quem joga
          </h2>
          <p className="muted small">Quem não veio: o mestre conduz o personagem nesta sessão, ou ele fica de fora (não entra na iniciativa).</p>
          <AttendanceList session={s} group={group} />
        </section>

        <section className="session-journal" aria-labelledby="sessao-diario">
          <h2 id="sessao-diario" className="section-title">
            Diário (para os jogadores)
          </h2>
          <RecapEditor session={s} />
        </section>

        <section className="session-reveal">
          <h2 className="section-title">Revelado nesta sessão</h2>
          {revelations.length === 0 && <p className="muted small">Nada ainda.</p>}
          <ul className="plain-list small">
            {revelations.map((r) => (
              <li key={r.id} className="reveal-row">
                <span>{revelationLabel(universe, r)}</span>
                {r.target === 'entidade' && <span className="muted"> ({r.depth === 'nome' ? 'só nome' : r.depth})</span>}
                <button type="button" className="btn-icon btn-xs" aria-label="Desfazer revelação" onClick={() => update((u) => remove(u, 'revelations', r.id))}>
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
          <div className="reveal-add">
            <EntityPicker label="Revelar ficha" value={revealId} onChange={setRevealId} allowCreate={false} />
            <Select
              label="Quanto revelar"
              value={depth}
              onChange={setDepth}
              options={[
                { value: 'nome', label: 'Só o nome' },
                { value: 'resumo', label: 'Nome e resumo' },
                { value: 'completo', label: 'Tudo (com descrição)' },
              ]}
            />
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={!revealId}
              onClick={() => {
                if (!revealId) return
                update((u) => insert(u, 'revelations', { ...draftRevelation(group.id, 'entidade', revealId, s.id), depth })[0])
                setRevealId(null)
              }}
            >
              Revelar
            </button>
          </div>
          {universe.facts.length > 0 && (
            <div className="reveal-add">
              <Select label="Revelar fato" value={factId} onChange={setFactId} options={[{ value: '', label: 'Revelar um fato…' }, ...universe.facts.map((f) => ({ value: f.id, label: factSentence(universe, f).slice(0, 70) }))]} />
              <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={!factId}
                onClick={() => {
                  update((u) => insert(u, 'revelations', draftRevelation(group.id, 'fato', factId, s.id))[0])
                  setFactId('')
                }}
              >
                Revelar
              </button>
            </div>
          )}
        </section>
      </div>

      {showInitiative && <InitiativeTracker session={s} />}
    </article>
  )
}
