import { ArrowUpRight } from 'lucide-react'
import { factSentence } from '../logic/codex'
import { derivedValue } from '../logic/derivedFields'
import { relationDetails } from '../logic/relations'
import { isPast, listsOf, membersOf, membershipsOf } from '../model/lists'
import { formatYear, kindLabel } from '../model/labels'
import { byId, entityName } from '../model/universe'
import { useWorkspace } from '../state/workspace'
import { CanonBadge, EditorialBadge } from '../ui/bits'
import { Modal } from '../ui/Modal'
import { SecretAwareText } from '../ui/SecretText'
import { Picture } from '../images/Picture'

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

  // As ligações de lista aparecem como listas ("Membros: …") e em "Faz parte de", não uma a uma.
  const relations = universe.relations.filter((r) => (r.fromId === e.id || r.toId === e.id) && !r.listId)
  const lists = listsOf(e)
    .map((l) => ({ list: l, members: membersOf(universe, e.id, l.id).filter((m) => !isPast(m.relation)) }))
    .filter((x) => x.members.length > 0)
  const partOf = membershipsOf(universe, e.id).filter((m) => !isPast(m.relation))
  // Campo vazio não aparece, a não ser que as ligações (ou o nascimento) já respondam.
  const fields = e.fields.flatMap((f) => {
    if (!f.key.trim() && !f.value.trim()) return []
    if (f.value.trim()) return [{ key: f.key || 'Campo', value: f.value }]
    const derived = f.key.trim() ? derivedValue(universe, e, f.key) : null
    return derived ? [{ key: f.key, value: derived.text }] : []
  })
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
        {e.image && <Picture value={e.image} alt={`Imagem de ${e.name}`} className="peek-portrait" />}
        <div className="peek-meta">
          <span className="eyebrow">{kindLabel(e.kind)}</span>
          <CanonBadge canon={e.canon} />
          <EditorialBadge editorial={e.editorial} />
        </div>
        {e.aliases.length > 0 && <p className="muted small">Também: {e.aliases.join(', ')}</p>}
        {span && <p className="muted small">{span}</p>}
        {e.summary ? <p className="peek-summary">{e.summary}</p> : <p className="muted">Sem resumo ainda.</p>}
        {e.description && <SecretAwareText className="peek-desc" text={e.description} />}
        {(fields.length > 0 || lists.length > 0 || partOf.length > 0) && (
          <dl className="kv">
            {fields.map((f, i) => (
              <div key={`campo-${i}`}>
                <dt>{f.key}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
            {lists.map(({ list, members }) => (
              <div key={list.id}>
                <dt>{list.name}</dt>
                <dd>{members.map((m) => `${m.member.name}${m.relation.role ? ` (${m.relation.role})` : ''}`).join(', ')}</dd>
              </div>
            ))}
            {partOf.length > 0 && (
              <div>
                <dt>Faz parte de</dt>
                <dd>{partOf.map((m) => `${m.owner.name} · ${m.list.name}`).join(', ')}</dd>
              </div>
            )}
          </dl>
        )}
        {relations.length > 0 && (
          <>
            <h3 className="section-label">Ligações</h3>
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
                  {relationDetails(universe, r) && <span className="muted"> · {relationDetails(universe, r)}</span>}
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
