import { ArrowUpRight } from 'lucide-react'
import { factSentence } from '../logic/codex'
import { formatYear, kindLabel } from '../model/labels'
import { byId, entityName } from '../model/universe'
import { useWorkspace } from '../state/workspace'
import { CanonBadge, EditorialBadge } from '../ui/bits'
import { Modal } from '../ui/Modal'

/** Resumo de uma ficha num painel lateral, sem sair do que se está fazendo. */
export function PeekDrawer({ entityId, onClose }: { entityId: string; onClose: () => void }) {
  const { universe, go } = useWorkspace()
  const e = byId(universe, 'entities', entityId)
  const suffix = universe.settings.calendarSuffix

  if (!e) {
    return (
      <Modal title="Ficha não encontrada" onClose={onClose} side size="sm">
        <p>Esta ficha foi removida.</p>
      </Modal>
    )
  }

  const relations = universe.relations.filter((r) => r.fromId === e.id || r.toId === e.id)
  const facts = universe.facts.filter((f) => f.subjectId === e.id).slice(0, 6)
  const span = [formatYear(e.startYear, suffix), formatYear(e.endYear, suffix)].filter(Boolean).join(' — ')

  return (
    <Modal
      title={e.name || 'Sem nome'}
      onClose={onClose}
      side
      size="sm"
      footer={
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            onClose()
            go('fichas', e.id)
          }}
        >
          Abrir ficha <ArrowUpRight size={16} />
        </button>
      }
    >
      <div className="peek">
        <div className="peek-meta">
          <span className="eyebrow">{kindLabel(e.kind)}</span>
          <CanonBadge canon={e.canon} />
          <EditorialBadge editorial={e.editorial} />
        </div>
        {e.aliases.length > 0 && <p className="muted small">Também: {e.aliases.join(', ')}</p>}
        {span && <p className="muted small">{span}</p>}
        {e.summary ? <p className="peek-summary">{e.summary}</p> : <p className="muted">Sem resumo ainda.</p>}
        {e.description && <p className="peek-desc">{e.description}</p>}
        {e.fields.length > 0 && (
          <dl className="kv">
            {e.fields.map((f, i) => (
              <div key={i}>
                <dt>{f.key}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {relations.length > 0 && (
          <>
            <h3 className="section-label">Relações</h3>
            <ul className="plain-list">
              {relations.map((r) => (
                <li key={r.id}>
                  {r.fromId === e.id ? (
                    <>
                      {r.type} <strong>{entityName(universe, r.toId)}</strong>
                    </>
                  ) : (
                    <>
                      <strong>{entityName(universe, r.fromId)}</strong> {r.type}
                    </>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
        {facts.length > 0 && (
          <>
            <h3 className="section-label">Fatos</h3>
            <ul className="plain-list">
              {facts.map((f) => (
                <li key={f.id}>
                  {factSentence(universe, f)} <CanonBadge canon={f.canon} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Modal>
  )
}
