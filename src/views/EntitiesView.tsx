import { ArrowLeft, BookMarked, Plus, Trash2, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { factSentence } from '../logic/codex'
import { MentionMatcher } from '../logic/detection'
import { mentionIdsInDoc } from '../logic/doc'
import { fold, snippet } from '../logic/text'
import { involvements, scopeLabel } from '../logic/relations'
import { RelationDetails } from './RelationDetails'
import { formatYear, KIND_LABEL, KNOWLEDGE_LABEL, kindLabel, kindPlural, SEED_STATUS_LABEL } from '../model/labels'
import { ENTITY_KINDS, KNOWLEDGE_STATES, type Entity, type KnowledgeState } from '../model/schema'
import {
  byId,
  draftEntity,
  draftKnowledge,
  draftRelation,
  entityName,
  insert,
  manuscriptOrder,
  namesOf,
  patch,
  remove,
  removeEntity,
} from '../model/universe'
import { useWorkspace } from '../state/workspace'
import { CanonBadge, CanonSelect, EditorialBadge, EditorialSelect, Empty, Field, Select, TagInput, YearInput } from '../ui/bits'
import { Fold } from '../ui/Fold'
import { ArcCard } from './ArcCard'
import { ConfirmButton } from '../ui/ConfirmButton'
import { SecretTextarea } from '../ui/SecretText'
import { RevealPicker } from '../ui/RevealPicker'
import { EntityPicker } from '../ui/EntityPicker'
import { FactDialog } from '../ui/FactDialog'

export default function EntitiesView() {
  const { universe, update, nav, go } = useWorkspace()
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<string>('todos')
  const [newName, setNewName] = useState('')
  const [newKind, setNewKind] = useState('personagem')

  const selectedId = nav.view === 'fichas' ? (nav.id ?? null) : null
  const selected = selectedId ? byId(universe, 'entities', selectedId) : undefined

  const kinds = useMemo(() => {
    const all = new Set([...ENTITY_KINDS.filter((k) => universe.entities.some((e) => e.kind === k)), ...universe.entities.map((e) => e.kind)])
    return [...all]
  }, [universe.entities])

  const list = useMemo(() => {
    const q = fold(query.trim())
    return universe.entities
      .filter((e) => kind === 'todos' || e.kind === kind)
      .filter((e) => !q || namesOf(e).some((n) => fold(n).includes(q)) || fold(e.summary).includes(q) || e.tags.some((t) => fold(t).includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt'))
  }, [universe.entities, kind, query])

  const create = (e: React.FormEvent) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    let id = ''
    update((u) => {
      const [next, ent] = insert(u, 'entities', draftEntity(newKind, name))
      id = ent.id
      return next
    })
    setNewName('')
    go('fichas', id)
  }

  return (
    <div className={`view split${selected ? ' has-detail' : ''}`}>
      <section className="split-list" aria-label="Lista de fichas">
        <header className="view-head">
          <h1>Fichas</h1>
          <span className="muted">{universe.entities.length}</span>
        </header>
        <form className="quick-create" onSubmit={create}>
          <label htmlFor="nova-ficha" className="sr-only">
            Nome da nova ficha
          </label>
          <input id="nova-ficha" className="input" placeholder="Nova ficha…" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Select label="Tipo da nova ficha" value={newKind} onChange={setNewKind} options={ENTITY_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))} />
          <button type="submit" className="btn btn-primary" aria-label="Criar ficha">
            <Plus size={16} />
          </button>
        </form>
        <input className="input" data-livre aria-label="Filtrar fichas" placeholder="Filtrar por nome, apelido, etiqueta…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="filter-chips" role="radiogroup" aria-label="Tipo">
          <button type="button" role="radio" aria-checked={kind === 'todos'} className="chip" onClick={() => setKind('todos')}>
            Todas
          </button>
          {kinds.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} className="chip" onClick={() => setKind(k)}>
              {kindPlural(k)}
            </button>
          ))}
        </div>
        {list.length === 0 ? (
          <Empty icon={<BookMarked size={28} />} title={universe.entities.length ? 'Nada com esse filtro.' : 'Nenhuma ficha ainda.'}>
            {!universe.entities.length && <p>Crie uma acima, ou selecione um nome no texto e escolha “Ficha”.</p>}
          </Empty>
        ) : (
          <ul className="entity-list">
            {list.map((e) => (
              <li key={e.id}>
                <button type="button" className="entity-row" aria-current={e.id === selectedId ? 'true' : undefined} onClick={() => go('fichas', e.id)}>
                  <span className={`kind-dot kind-${e.kind}`} aria-hidden="true" />
                  <span className="entity-row-name">{e.name || 'Sem nome'}</span>
                  <span className="entity-row-kind">{kindLabel(e.kind)}</span>
                  {e.summary && <span className="entity-row-summary">{e.summary}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="split-detail" aria-label="Ficha">
        {selected ? (
          <EntityDetail key={selected.id} entity={selected} />
        ) : (
          <Empty icon={<BookMarked size={32} />} title="Escolha uma ficha">
            <p>Fichas podem ser mínimas: um nome basta. O resto vem quando for útil.</p>
          </Empty>
        )}
      </section>
    </div>
  )
}

function EntityDetail({ entity: e }: { entity: Entity }) {
  const { universe, update, go, peek, undoable } = useWorkspace()
  const [factFor, setFactFor] = useState<boolean>(false)
  const set = (changes: Partial<Entity>) => update((u) => patch(u, 'entities', e.id, changes))
  const summaryRef = useRef<HTMLInputElement>(null)
  const suffix = universe.settings.calendarSuffix

  const outgoing = universe.relations.filter((r) => r.fromId === e.id)
  const incoming = universe.relations.filter((r) => r.toId === e.id)
  const children = universe.entities.filter((x) => x.parentId === e.id)
  const facts = universe.facts.filter((f) => f.subjectId === e.id || f.objectId === e.id)
  const knows = universe.knowledge.filter((k) => k.holderId === e.id)
  const events = universe.events.filter((ev) => ev.entityIds.includes(e.id) || ev.placeId === e.id).sort((a, b) => a.year - b.year)
  const seeds = universe.seeds.filter((s) => s.entityIds.includes(e.id))

  const appearances = useMemo(() => {
    const matcher = new MentionMatcher([e])
    return manuscriptOrder(universe)
      .map((s) => {
        const found = matcher.find(s.text)
        const roles = [
          s.povId === e.id && 'POV',
          s.presentIds.includes(e.id) && 'presente',
          s.placeId === e.id && 'local',
          (found.length > 0 || mentionIdsInDoc(s.doc).has(e.id)) && 'mencionado',
        ].filter(Boolean) as string[]
        return { scene: s, roles, found }
      })
      .filter((a) => a.roles.length > 0)
  }, [universe, e])

  return (
    <article className="entity">
      <header className="entity-head">
        <button type="button" className="btn-icon back-btn" aria-label="Voltar para a lista" onClick={() => go('fichas', null)}>
          <ArrowLeft size={18} />
        </button>
        <div className="entity-title-wrap">
          <label htmlFor="entity-name" className="sr-only">
            Nome
          </label>
          <input id="entity-name" className="entity-name" value={e.name} placeholder="Sem nome" onChange={(ev) => set({ name: ev.target.value })} />
          <div className="entity-badges">
            <span className="eyebrow">{kindLabel(e.kind)}</span>
            <CanonBadge canon={e.canon} />
            <EditorialBadge editorial={e.editorial} />
          </div>
        </div>
        <ConfirmButton
          className="btn-icon"
          title="Apagar ficha"
          question="Apagar a ficha? Cenas e fatos ficam, sem o vínculo."
          confirmLabel="Apagar ficha"
          onConfirm={() => {
            undoable(`Ficha “${e.name}” apagada`, (u) => removeEntity(u, e.id))
            go('fichas', null)
          }}
        >
          <Trash2 size={17} aria-label="Apagar ficha" />
        </ConfirmButton>
      </header>

      <div className="entity-body">
        <div className="entity-main">
          <div className="form-grid">
            <Field label="Tipo" hint="Escolha ou digite um tipo próprio">
              {(id) => (
<KindInput id={id} value={e.kind} onChange={(kind) => set({ kind })} />
              )}
            </Field>
            <EntityPicker label="Dentro de" value={e.parentId} exclude={[e.id]} onChange={(v) => set({ parentId: v })} placeholder="Lugar, facção, reino…" />
            <Field label="Canon" hint="Natureza no universo">
              {(id) => <CanonSelect id={id} value={e.canon} onChange={(v) => set({ canon: v })} />}
            </Field>
            <Field label="Estado editorial" hint="Maturidade para você">
              {(id) => <EditorialSelect id={id} value={e.editorial} onChange={(v) => set({ editorial: v })} />}
            </Field>
            <div className="field">
              <span className="field-label">{e.kind === 'personagem' ? 'Nascimento — morte' : 'Início — fim'}</span>
              <div className="inline-fields">
                <YearInput label="Ano de início" value={e.startYear} onChange={(v) => set({ startYear: v })} placeholder="Início" />
                <span className="muted">—</span>
                <YearInput label="Ano de fim" value={e.endYear} onChange={(v) => set({ endYear: v })} placeholder="Fim" />
              </div>
            </div>
            <div className="field-wide">
              <TagInput label="Outros nomes, títulos, identidades" value={e.aliases} onChange={(v) => set({ aliases: v })} placeholder="Pale Man, o Herdeiro…" />
            </div>
            <Field label="Resumo" wide>
              {(id) => (
                <div className="with-reveal">
                  <input ref={summaryRef} id={id} className="input" value={e.summary} placeholder="Uma linha sobre esta ficha" onChange={(ev) => set({ summary: ev.target.value })} />
                  <RevealPicker label="Resumo" value={e.summary} inputRef={summaryRef} onChange={(v) => set({ summary: v })} />
                </div>
              )}
            </Field>
            <Field label="Descrição" wide>
              {(id) => (
                <SecretTextarea id={id} value={e.description} placeholder="Escreva livremente." onChange={(v) => set({ description: v })} />
              )}
            </Field>
            <div className="field-wide">
              <TagInput label="Etiquetas" value={e.tags} onChange={(v) => set({ tags: v })} />
            </div>
          </div>

          <Fold id="ficha-campos" title="Campos">
            {e.fields.map((f, i) => (
              <div key={i} className="kv-row">
                <input className="input" aria-label="Campo" placeholder="Campo" value={f.key} onChange={(ev) => set({ fields: e.fields.map((x, j) => (j === i ? { ...x, key: ev.target.value } : x)) })} />
                <FieldValue value={f.value} label={f.key || 'Valor'} onChange={(v) => set({ fields: e.fields.map((x, j) => (j === i ? { ...x, value: v } : x)) })} />
                <button type="button" className="btn-icon btn-sm" aria-label="Remover campo" onClick={() => set({ fields: e.fields.filter((_, j) => j !== i) })}>
                  <X size={14} />
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ fields: [...e.fields, { key: '', value: '' }] })}>
              <Plus size={14} /> Campo
            </button>
          </Fold>

          <RelationsSection entity={e} outgoing={outgoing} incoming={incoming} />

          {universe.scenes.length > 0 && <ArcCard entity={e} />}

          <section className="entity-section">
            <div className="section-head">
              <h2 className="section-title">Fatos</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFactFor(true)}>
                <Plus size={14} /> Fato
              </button>
            </div>
            {facts.length === 0 ? (
              <p className="muted small">Nenhum fato registrado. Selecione um trecho no texto e escolha “Fato”.</p>
            ) : (
              <ul className="fact-list">
                {facts.map((f) => (
                  <li key={f.id}>
                    <span>{factSentence(universe, f)}</span>
                    <CanonBadge canon={f.canon} />
                    {f.speakerId && <span className="muted small">segundo {entityName(universe, f.speakerId)}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <KnowledgeSection entity={e} entries={knows} />
        </div>

        <aside className="entity-side">
          <Fold id="ficha-apari-es" title="Aparições">
            {appearances.length === 0 ? (
              <p className="muted small">Ainda não aparece no manuscrito.</p>
            ) : (
              <ul className="appearances">
                {appearances.map(({ scene, roles, found }) => (
                  <li key={scene.id}>
                    <button type="button" className="link-btn" onClick={() => go('escrever', scene.id)}>
                      {scene.title || 'Sem título'}
                    </button>
                    <span className="muted small"> {roles.join(' · ')}</span>
                    {found[0] && <p className="appearance-snippet">{snippet(scene.text, found[0].from, found[0].to, 50)}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Fold>

          {children.length > 0 && (
            <Fold id="ficha-cont-m" title="Contém">
              <div className="chips">
                {children.map((c) => (
                  <button key={c.id} type="button" className="chip chip-entity" onClick={() => go('fichas', c.id)}>
                    {c.name}
                  </button>
                ))}
              </div>
            </Fold>
          )}

          <Fold id="ficha-linha-do-tempo" title="Linha do tempo">
            {events.length === 0 && e.startYear === null && e.endYear === null ? (
              <p className="muted small">Nenhum evento ligado.</p>
            ) : (
              <ol className="mini-timeline">
                {e.startYear !== null && (
                  <li>
                    <span className="mini-year">{formatYear(e.startYear, suffix)}</span> {e.kind === 'personagem' ? 'Nascimento' : 'Início'}
                  </li>
                )}
                {events.map((ev) => (
                  <li key={ev.id}>
                    <button type="button" className="link-btn" onClick={() => go('timeline', ev.id)}>
                      <span className="mini-year">{formatYear(ev.year, suffix)}</span> {ev.title}
                    </button>
                  </li>
                ))}
                {e.endYear !== null && (
                  <li>
                    <span className="mini-year">{formatYear(e.endYear, suffix)}</span> {e.kind === 'personagem' ? 'Morte' : 'Fim'}
                  </li>
                )}
              </ol>
            )}
          </Fold>

          {seeds.length > 0 && (
            <Fold id="ficha-tramas" title="Tramas">
              <ul className="plain-list small">
                {seeds.map((s) => (
                  <li key={s.id}>
                    <button type="button" className="link-btn" onClick={() => go('tramas', s.id)}>
                      {s.title}
                    </button>{' '}
                    <span className={`seed-status seed-${s.status}`}>{SEED_STATUS_LABEL[s.status]}</span>
                  </li>
                ))}
              </ul>
            </Fold>
          )}

          <button type="button" className="btn btn-ghost btn-sm" onClick={() => go('relacoes', e.id)}>
            Ver no grafo de relações
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => peek(e.id)}>
            Espiar
          </button>
        </aside>
      </div>

      {factFor && <FactDialog initial={{ subjectId: e.id }} onClose={() => setFactFor(false)} />}
    </article>
  )
}

/** Tipo de ficha: um dos tipos comuns ou um tipo próprio. Vazio volta ao anterior. */
function KindInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const [draft, setDraft] = useState(value)
  const commit = () => {
    const v = draft.trim()
    if (v) onChange(v)
    else setDraft(value)
  }
  return (
    <>
      <input
        id={id}
        className="input"
        list="tipos-ficha"
        value={draft}
        onChange={(ev) => setDraft(ev.target.value)}
        onBlur={commit}
        onKeyDown={(ev) => ev.key === 'Enter' && commit()}
      />
      <datalist id="tipos-ficha">
        {ENTITY_KINDS.map((k) => (
          <option key={k} value={k}>
            {KIND_LABEL[k]}
          </option>
        ))}
      </datalist>
    </>
  )
}

const RELATION_TYPES = [
  'pai de', 'mãe de', 'filho de', 'filha de', 'irmão de', 'irmã de', 'casado com', 'aliado de', 'rival de', 'inimigo de',
  'serve a', 'governa', 'membro de', 'líder de', 'fundou', 'criou', 'causou', 'participou de', 'vive em', 'nasceu em', 'carrega', 'ama', 'teme',
]

function RelationsSection({ entity: e, outgoing, incoming }: { entity: Entity; outgoing: Universe['relations']; incoming: Universe['relations'] }) {
  const { universe, update, peek } = useWorkspace()
  const [type, setType] = useState('')
  const [targets, setTargets] = useState<string[]>([])
  const involved = involvements(universe, e.id)

  const add = () => {
    if (!targets.length || !type.trim()) return
    update((u) => targets.reduce((acc, t) => insert(acc, 'relations', draftRelation(e.id, t, type.trim()))[0], u))
    setType('')
    setTargets([])
  }

  // Relações do mesmo tipo ficam numa linha só: "criado por Allan, Bia".
  const group = (list: Universe['relations']) => {
    const map = new Map<string, Universe['relations']>()
    for (const r of list) {
      // Mesmo tipo, mesmos envolvidos e mesmo tempo: uma linha só.
      const k = `${fold(r.type.trim())}|${JSON.stringify(r.via)}|${JSON.stringify(r.scope)}`
      map.set(k, [...(map.get(k) ?? []), r])
    }
    return [...map.values()]
  }

  const names = (rs: Universe['relations'], side: 'fromId' | 'toId', editable: boolean) =>
    rs.map((r) => (
      <span key={r.id} className="chip chip-entity">
        <button type="button" className="chip-link" onClick={() => peek(r[side])}>
          {entityName(universe, r[side]) || 'Ficha removida'}
        </button>
        {editable && (
          <button type="button" className="chip-x" aria-label={`Tirar ${entityName(universe, r[side])} desta relação`} onClick={() => update((u) => remove(u, 'relations', r.id))}>
            <X size={12} />
          </button>
        )}
      </span>
    ))

  const groupControls = (rs: Universe['relations']) => (
    <>
      <CanonSelect value={rs[0].canon} onChange={(v) => update((u) => rs.reduce((acc, r) => patch(acc, 'relations', r.id, { canon: v }), u))} />
      <button
        type="button"
        className="btn-icon btn-sm relation-remove"
        aria-label={rs.length > 1 ? 'Remover estas relações' : 'Remover relação'}
        onClick={() => update((u) => rs.reduce((acc, r) => remove(acc, 'relations', r.id), u))}
      >
        <X size={14} />
      </button>
    </>
  )

  const outRow = (rs: Universe['relations']) => (
    <li key={rs[0].id} className="relation-row">
      <span className="muted">{e.name}</span>
      <input
        className="input input-sm relation-type"
        aria-label="Tipo da relação"
        value={rs[0].type}
        onChange={(ev) => update((u) => rs.reduce((acc, r) => patch(acc, 'relations', r.id, { type: ev.target.value }), u))}
      />
      <span className="chips relation-targets">
        {names(rs, 'toId', true)}
        <EntityPicker
          label={`Mais alguém: ${rs[0].type}`}
          hideLabel
          placeholder="+ nome"
          value={null}
          exclude={[e.id, ...rs.map((r) => r.toId)]}
          onChange={(t) => t && update((u) => insert(u, 'relations', { ...draftRelation(e.id, t, rs[0].type), canon: rs[0].canon, via: rs[0].via, scope: rs[0].scope })[0])}
        />
      </span>
      {groupControls(rs)}
      <RelationDetails relations={rs} exclude={[e.id, ...rs.map((r) => r.toId)]} />
    </li>
  )

  const inRow = (rs: Universe['relations']) => (
    <li key={rs[0].id} className="relation-row">
      <span className="chips relation-targets">{names(rs, 'fromId', true)}</span>
      <span className="relation-type-text">{rs[0].type}</span>
      <span className="muted">{e.name}</span>
      {groupControls(rs)}
      <RelationDetails relations={rs} exclude={[e.id, ...rs.map((r) => r.fromId)]} />
    </li>
  )

  return (
    <Fold id="ficha-rela-es" title="Relações">
      {outgoing.length + incoming.length === 0 && <p className="muted small">Nenhuma relação ainda.</p>}
      <ul className="relation-list">
        {group(outgoing).map(outRow)}
        {group(incoming).map(inRow)}
      </ul>
      {involved.length > 0 && (
        <div className="relation-involved">
          <h3 className="section-label">Envolvido em</h3>
          <ul className="plain-list small">
            {involved.map(({ relation, role }) => (
              <li key={relation.id + role}>
                <strong>{role || 'com'}</strong>:{' '}
                <button type="button" className="link-btn" onClick={() => peek(relation.fromId)}>
                  {entityName(universe, relation.fromId)}
                </button>{' '}
                {relation.type}{' '}
                <button type="button" className="link-btn" onClick={() => peek(relation.toId)}>
                  {entityName(universe, relation.toId)}
                </button>
                {scopeLabel(universe, relation) && <span className="muted"> · {scopeLabel(universe, relation)}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="relation-add">
        <span className="muted small">{e.name || 'Esta ficha'}</span>
        <input className="input input-sm" aria-label="Nova relação" list="tipos-relacao" placeholder="é irmão de…" value={type} onChange={(ev) => setType(ev.target.value)} />
        {targets.length > 0 && (
          <span className="chips">
            {targets.map((t) => (
              <span key={t} className="chip chip-entity">
                {entityName(universe, t)}
                <button type="button" className="chip-x" aria-label={`Tirar ${entityName(universe, t)}`} onClick={() => setTargets(targets.filter((x) => x !== t))}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </span>
        )}
        <EntityPicker
          label="Com"
          hideLabel
          placeholder={targets.length ? '+ mais alguém' : 'Com quem…'}
          value={null}
          exclude={[e.id, ...targets]}
          onChange={(t) => t && setTargets([...targets, t])}
        />
        <button type="button" className="btn btn-sm btn-primary" disabled={!targets.length || !type.trim()} onClick={add}>
          Adicionar
        </button>
      </div>
      <p className="muted tiny">Escolha quantas fichas quiser: “criado por Allan, Bia”. No grafo, cada uma vira uma ligação.</p>
      <datalist id="tipos-relacao">
        {RELATION_TYPES.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
    </Fold>
  )
}

function KnowledgeSection({ entity: e, entries }: { entity: Entity; entries: Universe['knowledge'] }) {
  const { universe, update } = useWorkspace()
  const [factId, setFactId] = useState('')
  const order = manuscriptOrder(universe)
  const factOptions = universe.facts.map((f) => ({ value: f.id, label: factSentence(universe, f).slice(0, 80) }))

  return (
    <Fold id="ficha-o-que-x-sabe" title={<>O que {e.name || 'esta ficha'} sabe</>}>
      {entries.length === 0 && <p className="muted small">Nada registrado. Útil para pontos de vista, segredos e mentiras.</p>}
      <ul className="knowledge-list">
        {entries.map((k) => {
          const f = byId(universe, 'facts', k.factId)
          return (
            <li key={k.id} className="knowledge-row">
              <Select<KnowledgeState>
                label="Estado"
                value={k.state}
                onChange={(v) => update((u) => patch(u, 'knowledge', k.id, { state: v }))}
                options={KNOWLEDGE_STATES.map((s) => ({ value: s, label: KNOWLEDGE_LABEL[s] }))}
              />
              <span className="knowledge-fact">{f ? factSentence(universe, f) : 'Fato removido'}</span>
              <Select
                label="Desde a cena"
                value={k.sinceSceneId ?? ''}
                onChange={(v) => update((u) => patch(u, 'knowledge', k.id, { sinceSceneId: v || null }))}
                options={[{ value: '', label: 'Desde sempre' }, ...order.map((s) => ({ value: s.id, label: `Desde “${s.title || 'Sem título'}”` }))]}
              />
              <button type="button" className="btn-icon btn-sm" aria-label="Remover" onClick={() => update((u) => remove(u, 'knowledge', k.id))}>
                <X size={14} />
              </button>
            </li>
          )
        })}
      </ul>
      {factOptions.length > 0 ? (
        <div className="inline-fields">
          <Select label="Fato" value={factId} onChange={setFactId} options={[{ value: '', label: 'Escolha um fato…' }, ...factOptions]} />
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            disabled={!factId}
            onClick={() => {
              update((u) => insert(u, 'knowledge', draftKnowledge(e.id, factId))[0])
              setFactId('')
            }}
          >
            <Plus size={14} /> Sabe disso
          </button>
        </div>
      ) : (
        <p className="muted small">Registre fatos primeiro.</p>
      )}
    </Fold>
  )
}

type Universe = ReturnType<typeof useWorkspace>['universe']

/** Valor de um campo livre, com a marcação de spoiler para o modo leitor. */
function FieldValue({ value, label, onChange }: { value: string; label: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="with-reveal">
      <input ref={ref} className="input" aria-label="Valor" placeholder="Valor" value={value} onChange={(ev) => onChange(ev.target.value)} />
      <RevealPicker label={label} value={value} inputRef={ref} onChange={onChange} />
    </div>
  )
}
