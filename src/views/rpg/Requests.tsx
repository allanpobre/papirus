import { Check, Dices, ListChecks, X } from 'lucide-react'
import { useState } from 'react'
import { askRoll, closeRequest, openRequests, recordResult, requestLabel, requestTargets, rollFor, type RollRequest } from '../../rpg/requests'
import { attendanceOf, partyOf } from '../../rpg/sessionLife'
import { makeSystem } from '../../rpg/systems'
import { useWorkspace } from '../../state/workspace'
import { Modal } from '../../ui/Modal'
import { useRpg } from './rpgContext'

const FALLBACK = makeSystem('narrativo')

/**
 * "Todos rolem Percepção": o mestre escolhe o quê, para quem e a dificuldade (que só ele vê).
 * O pedido aparece no celular de cada um, com o botão que já rola pela ficha.
 */
export function AskRollDialog({ onClose }: { onClose: () => void }) {
  const { universe, update, toast } = useWorkspace()
  const { group, system, activeSession } = useRpg()
  const rules = system ?? FALLBACK
  const skills = system?.skills ?? []
  const attrs = system?.attributes ?? []
  const [what, setWhat] = useState(() => (skills[0] ? `pericia:${skills[0].name}` : attrs[0] ? `atributo:${attrs[0].name}` : 'livre:'))
  const [expression, setExpression] = useState('1d20')
  const [freeName, setFreeName] = useState('')
  const [dc, setDc] = useState('')
  const [who, setWho] = useState<string[]>([])
  if (!activeSession) return null
  const party = partyOf(universe, group.id).filter((p) => attendanceOf(activeSession, p.id) !== 'fora')
  const [kind, name] = what.split(/:(.*)/s) as [RollRequest['kind'], string]
  const dcLabel = rules.resolution === 'sucessos' ? 'Sucessos necessários (só você vê)' : 'Dificuldade (só você vê)'

  const send = () => {
    let sent: RollRequest | null = null
    update((u) => {
      const [next, r] = askRoll(u, activeSession.id, {
        kind,
        name: kind === 'livre' ? freeName.trim() || 'Rolagem' : name,
        expression: kind === 'livre' ? expression : '',
        dc: dc.trim() && Number.isFinite(Number(dc)) ? Math.trunc(Number(dc)) : null,
        sheetIds: who,
      })
      sent = r
      return next
    })
    if (!sent) return
    toast(group.share ? 'Teste pedido. Os celulares já mostram.' : 'Teste pedido. Sem o link da mesa, role por eles aqui.')
    onClose()
  }

  return (
    <Modal
      title="Pedir teste"
      onClose={onClose}
      help="pedir-teste"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" disabled={kind === 'livre' && !expression.trim()} onClick={send}>
            <ListChecks size={16} /> Pedir
          </button>
        </>
      }
    >
      <p className="muted small">Aparece no celular de cada um, com o botão que rola pela ficha. Os resultados chegam aqui na mesa.</p>
      <div className="field">
        <label className="field-label" htmlFor="pedir-o-que">
          O que rolar
        </label>
        <select id="pedir-o-que" className="input select" value={what} onChange={(e) => setWhat(e.target.value)}>
          {skills.length > 0 && (
            <optgroup label="Perícias">
              {skills.map((k) => (
                <option key={k.id} value={`pericia:${k.name}`}>
                  {k.name}
                </option>
              ))}
            </optgroup>
          )}
          {attrs.length > 0 && (
            <optgroup label="Atributos">
              {attrs.map((a) => (
                <option key={a.id} value={`atributo:${a.name}`}>
                  {a.name}
                </option>
              ))}
            </optgroup>
          )}
          <option value="livre:">Rolagem livre…</option>
        </select>
      </div>
      {kind === 'livre' && (
        <div className="inline-fields ask-free">
          <label className="sr-only" htmlFor="pedir-nome">
            Nome da rolagem
          </label>
          <input id="pedir-nome" className="input" placeholder="Sorte, Sanidade…" value={freeName} onChange={(e) => setFreeName(e.target.value)} />
          <label className="sr-only" htmlFor="pedir-dados">
            Dados
          </label>
          <input id="pedir-dados" className="input input-year" spellCheck={false} value={expression} onChange={(e) => setExpression(e.target.value)} />
        </div>
      )}
      <div className="ask-who" role="group" aria-label="Para quem">
        <span className="field-label">Para quem</span>
        <button type="button" className="chip" aria-pressed={who.length === 0} onClick={() => setWho([])}>
          Todos
        </button>
        {party.map((p) => (
          <button key={p.id} type="button" className="chip" aria-pressed={who.includes(p.id)} onClick={() => setWho((w) => (w.includes(p.id) ? w.filter((x) => x !== p.id) : [...w, p.id]))}>
            {p.name}
          </button>
        ))}
      </div>
      {rules.resolution !== 'abaixo' && (
        <div className="field">
          <label className="field-label" htmlFor="pedir-cd">
            {dcLabel}
          </label>
          <input id="pedir-cd" className="input input-year" inputMode="numeric" placeholder={rules.resolution === 'sucessos' ? '1' : '15'} value={dc} onChange={(e) => setDc(e.target.value.replace(/[^\d]/g, ''))} />
          <span className="field-hint">{rules.resolution === 'sucessos' ? 'Sem número, basta um sucesso.' : 'Sem número, você vê os totais e decide.'}</span>
        </div>
      )}
    </Modal>
  )
}

/** Os testes pedidos, na mesa: quem passou, quem falhou, quem falta (e o mestre rola por quem ele conduz). */
export function RequestsPanel() {
  const { universe, update, readOnly } = useWorkspace()
  const { group, system, activeSession } = useRpg()
  // A iniciativa aparece no próprio combate, não aqui.
  const open = openRequests(activeSession).filter((r) => r.kind !== 'iniciativa')
  if (!activeSession || !open.length) return null
  const rules = system ?? FALLBACK

  return (
    <section className="requests" aria-label="Testes pedidos">
      {open.map((r) => {
        const targets = requestTargets(universe, activeSession, r)
        const done = targets.filter((t) => r.results.some((x) => x.sheetId === t.id)).length
        return (
          <article key={r.id} className="request-card" aria-label={`Teste: ${r.name}`}>
            <header className="request-head">
              <ListChecks size={16} aria-hidden="true" />
              <strong>{requestLabel(r, rules)}</strong>
              <span className="muted small">
                {done} de {targets.length}
              </span>
              {!readOnly && (
                <button type="button" className="btn btn-ghost btn-xs request-close" onClick={() => update((u) => closeRequest(u, activeSession.id, r.id))}>
                  <X size={13} /> Encerrar
                </button>
              )}
            </header>
            <ul className="request-list">
              {targets.map((t) => {
                const res = r.results.find((x) => x.sheetId === t.id)
                const gm = attendanceOf(activeSession, t.id) === 'mestre'
                return (
                  <li key={t.id} className={`request-row${res ? (res.pass === true ? ' is-pass' : res.pass === false ? ' is-fail' : ' is-done') : ''}`}>
                    <span className="request-who">{t.name}</span>
                    {res ? (
                      <span className="request-res">
                        <strong className="tabular">{res.total}</strong>
                        {res.pass === true && (
                          <span className="request-tag">
                            <Check size={12} aria-hidden="true" /> passou
                          </span>
                        )}
                        {res.pass === false && <span className="request-tag">falhou</span>}
                        {res.pass === null && res.verdict && <span className="request-tag">{res.verdict}</span>}
                      </span>
                    ) : (
                      <span className="request-res">
                        <span className="muted small">{gm ? 'o mestre conduz' : 'esperando'}</span>
                        {!readOnly && (
                          <button
                            type="button"
                            className="btn btn-xs"
                            aria-label={`Rolar por ${t.name}`}
                            onClick={() => {
                              const o = rollFor(universe.systems.find((x) => x.id === t.systemId) ?? system, t, r)
                              if (o) update((u) => recordResult(u, activeSession.id, r.id, t, o, 'mestre', rules))
                            }}
                          >
                            <Dices size={13} /> Rolar
                          </button>
                        )}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
            {!targets.length && <p className="muted small">Ninguém na mesa para este teste.</p>}
            {group.share ? null : <p className="muted tiny">Sem o link da mesa, os jogadores não veem o pedido: role por eles aqui.</p>}
          </article>
        )
      })}
    </section>
  )
}
