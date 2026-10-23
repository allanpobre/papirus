import { X } from 'lucide-react'
import { useState } from 'react'
import { relationDetails, VIA_ROLES } from '../logic/relations'
import { RELATION_SCOPES, type Relation } from '../model/schema'
import { entityName, manuscriptOrder, patch } from '../model/universe'
import { useWorkspace } from '../state/workspace'
import { YearInput } from '../ui/bits'
import { EntityPicker } from '../ui/EntityPicker'

const SCOPE_LABEL: Record<Relation['scope']['kind'], string> = {
  geral: 'Sempre',
  periodo: 'Num período',
  historia: 'Numa história ou arco',
  cenas: 'Em cenas',
}

/**
 * Quem está por trás (ou junto) e quando a relação vale. Vale para todas as relações
 * do grupo (mesmo tipo, mesma ficha de origem), como o canon.
 */
export function RelationDetails({ relations, exclude }: { relations: Relation[]; exclude: string[] }) {
  const { universe, update } = useWorkspace()
  const r = relations[0]
  const [role, setRole] = useState('a mando de')
  const summary = relationDetails(universe, r)
  const setAll = (c: Partial<Relation>) => update((u) => relations.reduce((acc, x) => patch(acc, 'relations', x.id, c), u))
  const setScope = (c: Partial<Relation['scope']>) => setAll({ scope: { ...r.scope, ...c } })
  const scenes = manuscriptOrder(universe)

  return (
    <details className="relation-details">
      <summary>{summary || 'Quem está por trás, quando vale'}</summary>
      <div className="relation-details-body">
        <div className="relation-via">
          <span className="field-label">Por trás ou junto</span>
          {r.via.map((v, i) => (
            <div key={i} className="relation-via-row">
              <input
                className="input input-sm"
                list="papeis-relacao"
                aria-label={`Papel de ${entityName(universe, v.entityId)}`}
                value={v.role}
                onChange={(ev) => setAll({ via: r.via.map((x, j) => (j === i ? { ...x, role: ev.target.value } : x)) })}
              />
              <span className="chip chip-entity">{entityName(universe, v.entityId)}</span>
              <button type="button" className="btn-icon btn-xs" aria-label={`Tirar ${entityName(universe, v.entityId)}`} onClick={() => setAll({ via: r.via.filter((_, j) => j !== i) })}>
                <X size={12} />
              </button>
            </div>
          ))}
          <div className="relation-via-row">
            <input className="input input-sm" list="papeis-relacao" aria-label="Papel" placeholder="a mando de" value={role} onChange={(ev) => setRole(ev.target.value)} />
            <EntityPicker
              label="Quem está por trás"
              hideLabel
              placeholder="+ quem"
              value={null}
              exclude={[...exclude, ...r.via.map((v) => v.entityId)]}
              onChange={(id) => id && setAll({ via: [...r.via, { entityId: id, role: role.trim() || 'com' }] })}
            />
          </div>
          <p className="muted tiny">Ex.: “Luan envenenou João, a mando de José”. No grafo, José aparece ligado por uma linha tracejada.</p>
        </div>

        <div className="relation-scope">
          <span className="field-label">Quando vale</span>
          <div className="segmented" role="radiogroup" aria-label="Quando vale">
            {RELATION_SCOPES.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={r.scope.kind === k} onClick={() => setScope({ kind: k })}>
                {SCOPE_LABEL[k]}
              </button>
            ))}
          </div>
          {r.scope.kind === 'periodo' && (
            <div className="inline-fields">
              <YearInput label="De (ano)" placeholder="De" value={r.scope.fromYear} onChange={(v) => setScope({ fromYear: v })} />
              <span className="muted">até</span>
              <YearInput label="Até (ano)" placeholder="Até" value={r.scope.toYear} onChange={(v) => setScope({ toYear: v })} />
            </div>
          )}
          {r.scope.kind === 'historia' &&
            (universe.stories.length ? (
              <div className="scope-choices">
                {universe.stories.map((s) => (
                  <label key={s.id} className="check">
                    <input
                      type="checkbox"
                      checked={r.scope.storyIds.includes(s.id)}
                      onChange={(ev) => setScope({ storyIds: ev.target.checked ? [...r.scope.storyIds, s.id] : r.scope.storyIds.filter((x) => x !== s.id) })}
                    />{' '}
                    {s.title || 'Sem título'}
                  </label>
                ))}
              </div>
            ) : (
              <p className="muted small">Ainda não há histórias. Crie uma em Escrever (livros, temporadas ou arcos).</p>
            ))}
          {r.scope.kind === 'cenas' &&
            (scenes.length ? (
              <div className="scope-choices scope-scenes">
                {scenes.map((s) => (
                  <label key={s.id} className="check">
                    <input
                      type="checkbox"
                      checked={r.scope.sceneIds.includes(s.id)}
                      onChange={(ev) => setScope({ sceneIds: ev.target.checked ? [...r.scope.sceneIds, s.id] : r.scope.sceneIds.filter((x) => x !== s.id) })}
                    />{' '}
                    {s.title || 'Sem título'}
                  </label>
                ))}
              </div>
            ) : (
              <p className="muted small">Ainda não há cenas.</p>
            ))}
        </div>

        <label className="relation-note">
          <span className="field-label">Nota</span>
          <textarea className="input textarea" rows={2} value={r.note} placeholder="Por quê, como, quem sabe disso…" onChange={(ev) => setAll({ note: ev.target.value })} />
        </label>
      </div>
      <datalist id="papeis-relacao">
        {VIA_ROLES.map((x) => (
          <option key={x} value={x} />
        ))}
      </datalist>
    </details>
  )
}
