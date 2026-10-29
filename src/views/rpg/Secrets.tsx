import { Eye, EyeOff, X } from 'lucide-react'
import { useState } from 'react'
import { factSentence, revelationLabel } from '../../logic/codex'
import { kindLabel } from '../../model/labels'
import { remove } from '../../model/universe'
import { deeper, keptSecrets, revealNow } from '../../rpg/reveal'
import { useWorkspace } from '../../state/workspace'
import { EntityPicker } from '../../ui/EntityPicker'
import { Modal } from '../../ui/Modal'
import { RevealForm } from './CodexTab'
import { useRpg } from './rpgContext'

const DEPTH_NOW = { nome: 'só o nome', resumo: 'o resumo', completo: 'tudo' } as const

/**
 * Os segredos à mão durante o jogo: o que a mesa ainda não sabe, com um toque para revelar.
 * Vai na hora para o Codex de cada celular, marcado como revelado nesta sessão.
 */
export function SecretsPanel() {
  const { universe, update, peek, readOnly } = useWorkspace()
  const { group, activeSession } = useRpg()
  const [other, setOther] = useState(false)
  const [entityId, setEntityId] = useState<string | null>(null)
  const kept = keptSecrets(universe, group.id)
  const sessionId = activeSession?.id ?? null
  const revealed = sessionId ? universe.revelations.filter((r) => r.groupId === group.id && r.sessionId === sessionId) : []
  const reveal = (target: 'entidade' | 'fato', id: string, depth?: 'nome' | 'resumo' | 'completo') => update((u) => revealNow(u, group.id, sessionId, target, id, depth))
  const nothing = !kept.entities.length && !kept.facts.length

  return (
    <section className="table-panel table-secrets" aria-label="Segredos">
      <h2 className="section-title">
        <EyeOff size={17} aria-hidden="true" /> Segredos e pistas
      </h2>
      <p className="muted small">Um toque e a mesa fica sabendo: o Codex de cada celular mostra na hora.</p>
      {nothing && <p className="muted small">Nenhum segredo guardado. Fichas e fatos marcados como secretos aparecem aqui.</p>}
      {!nothing && (
        <ul className="secret-list" aria-label="Ainda guardados">
          {kept.entities.map((e) => (
            <li key={e.id} className="secret-row">
              <span className="secret-name">
                <button type="button" className="link-btn" onClick={() => peek(e.id)}>
                  {e.name}
                </button>{' '}
                <span className="muted tiny">{kindLabel(e.kind)}</span>
              </span>
              {!readOnly && (
                <span className="secret-acts">
                  <button type="button" className="btn btn-ghost btn-xs" aria-label={`Revelar só o nome de ${e.name}`} onClick={() => reveal('entidade', e.id, 'nome')}>
                    Só o nome
                  </button>
                  <button type="button" className="btn btn-xs" aria-label={`Revelar ${e.name}`} onClick={() => reveal('entidade', e.id, 'resumo')}>
                    <Eye size={13} /> Revelar
                  </button>
                </span>
              )}
            </li>
          ))}
          {kept.facts.map((f) => {
            const text = factSentence(universe, f)
            return (
              <li key={f.id} className="secret-row">
                <span className="secret-name small">
                  <span className="muted">Fato:</span> {text}
                </span>
                {!readOnly && (
                  <span className="secret-acts">
                    <button type="button" className="btn btn-xs" aria-label={`Revelar o fato: ${text}`} onClick={() => reveal('fato', f.id)}>
                      <Eye size={13} /> Revelar
                    </button>
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {kept.partial.length > 0 && (
        <details className="secret-partial">
          <summary className="section-label">Conhecidos só em parte ({kept.partial.length})</summary>
          <ul className="secret-list" aria-label="Conhecidos só em parte">
            {kept.partial.map(({ entity, depth }) => {
              const next = deeper(depth)
              return (
                <li key={entity.id} className="secret-row">
                  <span className="secret-name">
                    {entity.name} <span className="muted tiny">sabem {DEPTH_NOW[depth]}</span>
                  </span>
                  {next && !readOnly && (
                    <span className="secret-acts">
                      <button type="button" className="btn btn-ghost btn-xs" aria-label={`Revelar mais de ${entity.name}`} onClick={() => reveal('entidade', entity.id, next)}>
                        Revelar mais
                      </button>
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </details>
      )}

      {!readOnly && (
        <div className="secret-any">
          <EntityPicker label="Revelar outra ficha" hideLabel placeholder="Revelar outra ficha…" value={entityId} onChange={setEntityId} allowCreate={false} />
          <button
            type="button"
            className="btn btn-sm"
            disabled={!entityId}
            onClick={() => {
              if (!entityId) return
              reveal('entidade', entityId, 'resumo')
              setEntityId(null)
            }}
          >
            Revelar
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOther(true)}>
            Fato, pista, mapa…
          </button>
        </div>
      )}

      {revealed.length > 0 && (
        <>
          <h3 className="section-label">Revelado nesta sessão</h3>
          <ul className="plain-list small secret-done" aria-label="Revelado nesta sessão">
            {revealed.map((r) => (
              <li key={r.id} className="reveal-row">
                <span>{revelationLabel(universe, r)}</span>
                {r.target === 'entidade' && <span className="muted"> ({DEPTH_NOW[r.depth]})</span>}
                {!readOnly && (
                  <button type="button" className="btn-icon btn-xs" aria-label={`Desfazer: ${revelationLabel(universe, r)}`} onClick={() => update((u) => remove(u, 'revelations', r.id))}>
                    <X size={12} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {other && (
        <Modal title="Revelar para a mesa" onClose={() => setOther(false)}>
          <p className="muted small">Fica marcado como revelado nesta sessão e aparece no Codex dos jogadores na hora.</p>
          <RevealForm group={group} sessionId={sessionId} onDone={() => setOther(false)} />
        </Modal>
      )}
    </section>
  )
}
