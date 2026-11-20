import { BookOpen, Plus, Sparkles, Users, X } from 'lucide-react'
import { useState } from 'react'
import { answerOf } from '../logic/kindQuestions'
import { BELIEVES, GOD_OF, pantheonOf, skyLayout } from '../logic/pantheon'
import type { Entity } from '../model/schema'
import { draftEntity, draftRelation, entityName, insert, patch, remove } from '../model/universe'
import { useWorkspace } from '../state/workspace'
import { EntityPicker } from '../ui/EntityPicker'
import { Fold } from '../ui/Fold'

/**
 * Panteão e crenças de uma religião: os deuses como estrelas (filhos ligados aos pais), o domínio de cada um,
 * as lendas, quem acredita e o que a fé promete e proíbe. Tudo vira ligação comum entre fichas.
 */
export function PantheonPanel({ entity: rel }: { entity: Entity }) {
  const { universe, update, go, toast } = useWorkspace()
  const [picked, setPicked] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [domain, setDomain] = useState('')
  if (rel.kind !== 'religiao') return null
  const p = pantheonOf(universe, rel.id)
  const pos = skyLayout(p.gods)
  const god = p.gods.find((g) => g.entity.id === picked)
  const link = (fromId: string, toId: string, type: string, note = '') => update((u) => insert(u, 'relations', { ...draftRelation(fromId, toId, type), note })[0])
  const newMyth = (aboutId: string, aboutName: string) => {
    let id = ''
    update((u) => {
      const [u1, doc] = insert(u, 'entities', { ...draftEntity('documento', `Lenda de ${aboutName}`), fields: [{ key: 'Forma', value: 'Um mito' }] })
      id = doc.id
      return insert(u1, 'relations', draftRelation(doc.id, aboutId, 'conta sobre'))[0]
    })
    toast('Lenda criada. Escreva o mito nela.', { action: { label: 'Abrir', run: () => go('fichas', id) } })
  }
  const faith = (['Promete', 'Proíbe', 'Ritual'] as const).map((k) => [k, answerOf(rel.fields, k).trim()] as const).filter(([, v]) => v)
  return (
    <div className="pantheon">
      <Fold id="ficha-panteao" title={`Panteão e crenças${p.gods.length ? ` (${p.gods.length})` : ''}`} defaultOpen={p.gods.length > 0 || p.believers.length > 0}>
        {p.gods.length > 0 ? (
          <div className="pantheon-sky" role="group" aria-label={`Panteão de ${rel.name}`}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {p.gods.flatMap((g) =>
                g.parents.map((pid) => {
                  const a = pos.get(pid)
                  const b = pos.get(g.entity.id)
                  return a && b ? <line key={`${pid}${g.entity.id}`} x1={a.x * 100} y1={a.y * 100} x2={b.x * 100} y2={b.y * 100} vectorEffect="non-scaling-stroke" /> : null
                }),
              )}
            </svg>
            {p.gods.map((g) => {
              const at = pos.get(g.entity.id)!
              return (
                <button
                  key={g.entity.id}
                  type="button"
                  className={`pantheon-star${g.entity.id === picked ? ' is-on' : ''}`}
                  style={{ left: `${at.x * 100}%`, top: `${at.y * 100}%` }}
                  aria-pressed={g.entity.id === picked}
                  onClick={() => setPicked(g.entity.id === picked ? null : g.entity.id)}
                >
                  <Sparkles size={16} aria-hidden="true" />
                  <span>{g.entity.name}</span>
                </button>
              )
            })}
          </div>
        ) : (
          <p className="muted small">Nenhum deus ainda. Junte os deuses desta fé: cada um vira uma estrela.</p>
        )}

        {god && (
          <section className="pantheon-card" aria-label={god.entity.name}>
            <h4>{god.entity.name}</h4>
            <label className="small">
              Domínio
              <input
                className="input"
                placeholder="o mar e os afogados"
                value={god.relation.note}
                onChange={(ev) => update((u) => patch(u, 'relations', god.relation.id, { note: ev.target.value }))}
              />
            </label>
            {god.parents.length > 0 && <p className="small">Filho de {god.parents.map((id) => entityName(universe, id)).join(' e ')}.</p>}
            <EntityPicker
              label="Filho de (outro deus)"
              value={null}
              exclude={[god.entity.id, ...god.parents]}
              allowCreate={false}
              placeholder="Escolher o pai ou a mãe…"
              onChange={(id) => {
                if (!id) return
                if (p.gods.some((g) => g.entity.id === id)) link(god.entity.id, id, 'filho de')
                else toast('Escolha um deus deste panteão.')
              }}
            />
            <p className="small">
              <BookOpen size={13} aria-hidden="true" /> Lendas:{' '}
              {god.myths.length ? god.myths.map((m, i) => (
                <span key={m.id}>
                  {i > 0 && ', '}
                  <button type="button" className="link-btn" onClick={() => go('fichas', m.id)}>
                    {m.name}
                  </button>
                </span>
              )) : <span className="muted">nenhuma ainda</span>}
            </p>
            <div className="row pantheon-actions">
              <button type="button" className="btn btn-sm" onClick={() => newMyth(god.entity.id, god.entity.name)}>
                <Plus size={13} aria-hidden="true" /> Nova lenda
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => go('fichas', god.entity.id)}>
                Abrir ficha
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  update((u) => remove(u, 'relations', god.relation.id))
                  setPicked(null)
                }}
              >
                <X size={13} aria-hidden="true" /> Tirar do panteão
              </button>
            </div>
          </section>
        )}

        {adding ? (
          <div className="pantheon-add" role="group" aria-label="Novo deus">
            <input className="input" aria-label="Domínio do deus" placeholder="Domínio (o mar, a colheita…)" value={domain} onChange={(ev) => setDomain(ev.target.value)} />
            <EntityPicker
              label="Deus ou deusa"
              value={null}
              kinds={['personagem', 'conceito', 'especie']}
              exclude={[rel.id, ...p.gods.map((g) => g.entity.id)]}
              placeholder="Buscar ou criar…"
              onChange={(id) => {
                if (!id) return
                link(id, rel.id, GOD_OF, domain.trim())
                setDomain('')
                setAdding(false)
                setPicked(id)
              }}
            />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(false)}>
              Cancelar
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-sm" onClick={() => setAdding(true)}>
            <Plus size={13} aria-hidden="true" /> Deus ou deusa
          </button>
        )}

        <h4 className="lang-h">
          <Users size={14} aria-hidden="true" /> Quem acredita
        </h4>
        {p.believers.length > 0 && (
          <div className="chips" aria-label="Quem acredita">
            {p.believers.map((b) => (
              <span key={b.relation.id} className="chip">
                <button type="button" className="link-btn" onClick={() => go('fichas', b.entity.id)}>
                  {b.entity.name}
                </button>
                <button type="button" className="link-btn" aria-label={`Tirar ${b.entity.name}`} onClick={() => update((u) => remove(u, 'relations', b.relation.id))}>
                  <X size={12} aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        )}
        <EntityPicker
          label="Junte um povo, grupo ou pessoa"
          value={null}
          kinds={['cultura', 'especie', 'faccao', 'reino', 'personagem']}
          exclude={[rel.id, ...p.believers.map((b) => b.entity.id)]}
          placeholder="Quem acredita nesta fé…"
          onChange={(id) => id && link(id, rel.id, BELIEVES)}
        />
        {faith.length > 0 && (
          <dl className="pantheon-faith small">
            {faith.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className="row pantheon-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => newMyth(rel.id, rel.name)}>
            <BookOpen size={13} aria-hidden="true" /> Lenda da criação
          </button>
          {p.myths.length > 0 && <span className="small muted">Lendas da fé: {p.myths.map((m) => m.name).join(', ')}</span>}
        </div>
      </Fold>
    </div>
  )
}
