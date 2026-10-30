import { NameIdeas } from './NameIdeas'
import { ArrowLeft, BookMarked, BookOpen, ImagePlus, Loader2, PenLine, Plus, Trash2, X } from 'lucide-react'
import { Picture } from '../images/Picture'
import { useImagePicker } from '../images/useImagePicker'
import { useMemo, useRef, useState } from 'react'
import { factSentence } from '../logic/codex'
import { fold, snippet } from '../logic/text'
import { involvements, scopeLabel } from '../logic/relations'
import { RelationDetails } from './RelationDetails'
import { CANON_HINT, formatYear, KIND_LABEL, KNOWLEDGE_LABEL, kindLabel, kindPlural, SEED_STATUS_LABEL } from '../model/labels'
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
import { recall, remember } from '../state/prefs'
import { useWorkspace } from '../state/workspace'
import { appearancesOf, sceneCounts } from '../logic/appearances'
import { EntityReader } from './EntityReader'
import { KindQuestions } from './KindQuestions'
import { MapGlimpse } from './MapGlimpse'
import { answer, askedKey, isBlank } from '../logic/kindQuestions'
import { CanonBadge, CanonSelect, EditorialSelect, Empty, Field, Select, TagInput, YearInput } from '../ui/bits'
import { Fold } from '../ui/Fold'
import { ArcCard } from './ArcCard'
import { ConfirmButton } from '../ui/ConfirmButton'
import { SecretTextarea } from '../ui/SecretText'
import { RevealPicker } from '../ui/RevealPicker'
import { EntityPicker } from '../ui/EntityPicker'
import { FactDialog } from '../ui/FactDialog'
import { AreaHead } from './AreaModes'

export default function EntitiesView() {
  const { universe, update, nav, go, readOnly } = useWorkspace()
  // Ler ou editar: a ficha abre para ler, e a escolha fica lembrada; quem só pode ler, lê.
  const [mode, setMode] = useState<'ler' | 'editar'>(() => (!readOnly && recall('ficha-modo') === 'editar' ? 'editar' : 'ler'))
  // A ficha que acabou de nascer aqui abre para editar.
  const [fresh, setFresh] = useState<string | null>(null)
  const changeMode = (m: 'ler' | 'editar') => {
    setMode(m)
    setFresh(null)
    remember('ficha-modo', m)
  }
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

  // Em quantas cenas cada ficha aparece: o que a história usa e o que está só nas notas (sem cobrança).
  const counts = useMemo(() => sceneCounts(universe), [universe])
  const hasScenes = universe.scenes.some((sc) => sc.text.trim())
  const [where, setWhere] = useState<'tudo' | 'cenas' | 'notas'>('tudo')
  const inScenes = universe.entities.filter((e) => counts.get(e.id)).length

  const list = useMemo(() => {
    const q = fold(query.trim())
    return universe.entities
      .filter((e) => kind === 'todos' || e.kind === kind)
      .filter((e) => where === 'tudo' || (where === 'cenas') === Boolean(counts.get(e.id)))
      .filter((e) => !q || namesOf(e).some((n) => fold(n).includes(q)) || fold(e.summary).includes(q) || e.tags.some((t) => fold(t).includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt'))
  }, [universe.entities, kind, query, where, counts])

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
    setFresh(id)
    go('fichas', id)
  }

  return (
    <div className={`view split fichas-view${selected ? ' has-detail' : ''}`}>
      <AreaHead current="fichas" tour="fichas" />
      <section className="split-list" aria-label="Lista de fichas">
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
        <NameIdeas kind={newKind} onPick={setNewName} />
        <input className="input" data-livre aria-label="Filtrar fichas" placeholder="Filtrar por nome, apelido, etiqueta…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="filter-chips" role="radiogroup" aria-label="Tipo">
          <button type="button" role="radio" aria-checked={kind === 'todos'} className="chip" onClick={() => setKind('todos')}>
            Todas <span className="chip-count">{universe.entities.length}</span>
          </button>
          {kinds.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} className="chip" onClick={() => setKind(k)}>
              {kindPlural(k)}
            </button>
          ))}
        </div>
        {hasScenes && universe.entities.length > 0 && (
          <div className="filter-chips where-chips" role="group" aria-label="Onde aparece">
            <button type="button" className="chip" aria-pressed={where === 'cenas'} onClick={() => setWhere(where === 'cenas' ? 'tudo' : 'cenas')}>
              Nas cenas <span className="chip-count">{inScenes}</span>
            </button>
            <button type="button" className="chip" aria-pressed={where === 'notas'} onClick={() => setWhere(where === 'notas' ? 'tudo' : 'notas')}>
              Só nas notas <span className="chip-count">{universe.entities.length - inScenes}</span>
            </button>
          </div>
        )}
        {list.length === 0 ? (
          <Empty icon={<BookMarked size={28} />} title={universe.entities.length ? 'Nada com esse filtro.' : 'Nenhuma ficha ainda.'}>
            {!universe.entities.length && <p>Crie uma acima, ou selecione um nome no texto e escolha “Ficha”.</p>}
          </Empty>
        ) : (
          <ul className="entity-list">
            {list.map((e) => (
              <li key={e.id}>
                <button type="button" className="entity-row" aria-current={e.id === selectedId ? 'true' : undefined} onClick={() => go('fichas', e.id)}>
                  {e.image ? <Picture value={e.image} className="entity-row-pic" /> : <span className={`kind-dot kind-${e.kind}`} aria-hidden="true" />}
                  <span className="entity-row-name">{e.name || 'Sem nome'}</span>
                  {hasScenes ? <SceneCount n={counts.get(e.id) ?? 0} /> : <span className="entity-row-kind">{kindLabel(e.kind)}</span>}
                  <span className="entity-row-summary">
                    {hasScenes && <span className="entity-row-kindtext">{kindLabel(e.kind)}</span>}
                    {hasScenes && e.summary && ' · '}
                    {e.summary}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="split-detail" aria-label="Ficha">
        {selected ? (
          (fresh === selected.id ? 'editar' : mode) === 'ler' || readOnly ? (
            <EntityReader
              key={selected.id}
              entity={selected}
              order={list}
              modeSwitch={!readOnly && <ModeSwitch mode="ler" onChange={changeMode} />}
              onEdit={readOnly ? undefined : () => setFresh(selected.id)}
            />
          ) : (
            <EntityDetail key={selected.id} entity={selected} modeSwitch={<ModeSwitch mode="editar" onChange={changeMode} />} />
          )
        ) : universe.entities.length ? (
          <WorldOverview counts={counts} hasScenes={hasScenes} />
        ) : (
          <Empty icon={<BookMarked size={32} />} title="Escolha uma ficha">
            <p>Fichas podem ser mínimas: um nome basta. O resto vem quando for útil.</p>
          </Empty>
        )}
      </section>
    </div>
  )
}

/**
 * Sem ficha aberta (no computador): o mundo em resumo. O que a história mais usa, o que está
 * só nas notas (a parte do iceberg embaixo d'água, que não precisa entrar no livro) e o que
 * ainda é só um nome.
 */
function WorldOverview({ counts, hasScenes }: { counts: Map<string, number>; hasScenes: boolean }) {
  const { universe, go } = useWorkspace()
  const ents = universe.entities
  const kinds = [...new Set(ents.map((e) => e.kind))].map((k) => [k, ents.filter((e) => e.kind === k).length] as const).sort((a, b) => b[1] - a[1])
  const top = ents
    .filter((e) => counts.get(e.id))
    .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))
    .slice(0, 6)
  const notes = ents.filter((e) => !counts.get(e.id))
  const blank = ents.filter(isBlank)
  const chips = (list: Entity[]) => (
    <div className="chips">
      {list.slice(0, 12).map((e) => (
        <button key={e.id} type="button" className="chip chip-entity" onClick={() => go('fichas', e.id)}>
          {e.name || 'Sem nome'}
        </button>
      ))}
      {list.length > 12 && <span className="muted small">e mais {list.length - 12}</span>}
    </div>
  )
  return (
    <section className="world-overview" aria-label="O mundo em resumo">
      <header>
        <h2 className="section-title">O mundo até aqui</h2>
        <p className="muted">
          {ents.length} {ents.length === 1 ? 'ficha' : 'fichas'}: {kinds.map(([k, n]) => `${n} ${(n === 1 ? kindLabel(k) : kindPlural(k)).toLowerCase()}`).join(', ')}. Escolha uma na lista para ler.
        </p>
      </header>
      {hasScenes && top.length > 0 && (
        <div className="world-overview-part">
          <h3 className="section-label">Mais presentes nas cenas</h3>
          <ol className="world-overview-top">
            {top.map((e) => (
              <li key={e.id}>
                <button type="button" className="link-btn" onClick={() => go('fichas', e.id)}>
                  {e.name || 'Sem nome'}
                </button>
                <span className="muted small"> · {counts.get(e.id)} {counts.get(e.id) === 1 ? 'cena' : 'cenas'}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {hasScenes && notes.length > 0 && (
        <div className="world-overview-part">
          <h3 className="section-label">Só nas notas</h3>
          <p className="muted small">Ainda não aparecem nas cenas. Tudo bem: parte do mundo fica embaixo d'água, como num iceberg.</p>
          {chips(notes)}
        </div>
      )}
      {blank.length > 0 && (
        <div className="world-overview-part">
          <h3 className="section-label">Só com o nome</h3>
          <p className="muted small">Abra uma e responda as perguntas do tipo dela, se quiser.</p>
          {chips(blank)}
        </div>
      )}
    </section>
  )
}

/** "6 cenas" ou "só nas notas": quanto a história já usa desta ficha. */
function SceneCount({ n }: { n: number }) {
  return <span className={`entity-row-count${n ? '' : ' is-notes'}`}>{n ? `${n} ${n === 1 ? 'cena' : 'cenas'}` : 'só nas notas'}</span>
}

/** O retrato (ou imagem) da ficha: toque para escolher; com imagem, dá para trocar ou tirar. */
function PortraitButton({ entity: e, onChange }: { entity: Entity; onChange: (image: string | null) => void }) {
  const { toast } = useWorkspace()
  const picker = useImagePicker('retrato', (ref) => onChange(ref), (m) => toast(m, { tone: 'erro' }))
  return (
    <div className={`portrait-edit${e.image ? ' has-image' : ''}`}>
      {picker.field}
      <button type="button" className="portrait-btn" onClick={picker.open} disabled={picker.busy} aria-label={e.image ? 'Trocar a imagem da ficha' : 'Escolher uma imagem para a ficha'} title={e.image ? 'Trocar a imagem' : 'Pôr uma imagem (retrato, foto do lugar…)'}>
        {e.image ? <Picture value={e.image} alt={`Imagem de ${e.name}`} /> : picker.busy ? <Loader2 size={20} className="spin" /> : <ImagePlus size={20} />}
      </button>
      {e.image && (
        <button type="button" className="portrait-remove" aria-label="Tirar a imagem da ficha" title="Tirar a imagem" onClick={() => onChange(null)}>
          <X size={12} />
        </button>
      )}
    </div>
  )
}

/** Alternar entre ler a ficha como uma página e editá-la. */
function ModeSwitch({ mode, onChange }: { mode: 'ler' | 'editar'; onChange: (m: 'ler' | 'editar') => void }) {
  return (
    <div className="mode-switch" role="group" aria-label="Modo da ficha">
      <button type="button" aria-pressed={mode === 'ler'} onClick={() => onChange('ler')}>
        <BookOpen size={15} aria-hidden="true" /> Ler
      </button>
      <button type="button" aria-pressed={mode === 'editar'} onClick={() => onChange('editar')}>
        <PenLine size={15} aria-hidden="true" /> Editar
      </button>
    </div>
  )
}

function EntityDetail({ entity: e, modeSwitch }: { entity: Entity; modeSwitch: React.ReactNode }) {
  const { universe, update, go, goBack, peek, undoable } = useWorkspace()
  const [factFor, setFactFor] = useState<boolean>(false)
  const set = (changes: Partial<Entity>) => update((u) => patch(u, 'entities', e.id, changes))
  const summaryRef = useRef<HTMLInputElement>(null)
  const suffix = universe.settings.calendarSuffix
  // Ficha vazia: perguntas do tipo dela para começar (até sair da ficha, mesmo depois da primeira resposta).
  const [asking, setAsking] = useState(() => isBlank(e) && !skippedQuestions().includes(e.id))

  const outgoing = universe.relations.filter((r) => r.fromId === e.id)
  const incoming = universe.relations.filter((r) => r.toId === e.id)
  const children = universe.entities.filter((x) => x.parentId === e.id)
  const facts = universe.facts.filter((f) => f.subjectId === e.id || f.objectId === e.id)
  const knows = universe.knowledge.filter((k) => k.holderId === e.id)
  const events = universe.events.filter((ev) => ev.entityIds.includes(e.id) || ev.placeId === e.id).sort((a, b) => a.year - b.year)
  const seeds = universe.seeds.filter((s) => s.entityIds.includes(e.id))

  const appearances = useMemo(() => appearancesOf(universe, e), [universe, e])

  return (
    <article className="entity">
      <header className="entity-head">
        <button type="button" className="btn-icon back-btn" aria-label="Voltar para a lista" onClick={() => goBack('fichas', null)}>
          <ArrowLeft size={18} />
        </button>
        <PortraitButton entity={e} onChange={(image) => set({ image })} />
        <div className="entity-title-wrap">
          <label htmlFor="entity-name" className="sr-only">
            Nome
          </label>
          <input id="entity-name" className="entity-name" value={e.name} placeholder="Sem nome" onChange={(ev) => set({ name: ev.target.value })} />
          <span className="eyebrow">{kindLabel(e.kind)}</span>
        </div>
        {modeSwitch}
        <ConfirmButton
          className="btn-icon"
          title="Apagar ficha"
          question="Apagar a ficha? Cenas e fatos ficam, sem o vínculo."
          confirmLabel="Apagar ficha"
          onConfirm={() => {
            undoable(`Ficha “${e.name}” apagada`, (u) => removeEntity(u, e.id))
            go('fichas', null, { replace: true })
          }}
        >
          <Trash2 size={17} aria-label="Apagar ficha" />
        </ConfirmButton>
      </header>

      <div className="entity-body">
        <div className="entity-main">
          {asking && (
            <KindQuestions
              entity={e}
              onAnswer={(key, value) => set({ fields: answer(e.fields, key, value) })}
              onSkip={() => {
                skipQuestions(e.id)
                setAsking(false)
              }}
            />
          )}

          <div className="form-grid">
            <Field label="Resumo" wide>
              {(id) => (
                <div className="with-reveal">
                  <input ref={summaryRef} id={id} className="input" value={e.summary} placeholder="Uma linha sobre esta ficha" onChange={(ev) => set({ summary: ev.target.value })} />
                  <RevealPicker label="Resumo" value={e.summary} inputRef={summaryRef} onChange={(v) => set({ summary: v })} />
                </div>
              )}
            </Field>
            <Field label="Tipo">{(id) => <KindSelect id={id} value={e.kind} onChange={(kind) => set({ kind })} />}</Field>
            <Field label="É verdade no mundo?" hint={e.canon === 'estabelecido' ? undefined : CANON_HINT[e.canon]}>
              {(id) => <CanonSelect id={id} value={e.canon} onChange={(v) => set({ canon: v })} />}
            </Field>
            <Field label="Quão pronta">{(id) => <EditorialSelect id={id} value={e.editorial} onChange={(v) => set({ editorial: v })} />}</Field>
          </div>

          <Field label="Descrição" wide>
            {(id) => <SecretTextarea id={id} value={e.description} placeholder="Escreva livremente." onChange={(v) => set({ description: v })} />}
          </Field>

          <Fold id="ficha-campos" title="Campos">
            {e.fields.map((f, i) =>
              // As respostas às perguntas ficam nas perguntas enquanto elas estão na tela.
              asking && askedKey(e.kind, f.key) ? null : (
                <div key={i} className="kv-row">
                  <input className="input" aria-label="Campo" placeholder="Campo" value={f.key} onChange={(ev) => set({ fields: e.fields.map((x, j) => (j === i ? { ...x, key: ev.target.value } : x)) })} />
                  <FieldValue value={f.value} label={f.key || 'Valor'} onChange={(v) => set({ fields: e.fields.map((x, j) => (j === i ? { ...x, value: v } : x)) })} />
                  <button type="button" className="btn-icon btn-sm" aria-label="Remover campo" onClick={() => set({ fields: e.fields.filter((_, j) => j !== i) })}>
                    <X size={14} />
                  </button>
                </div>
              ),
            )}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ fields: [...e.fields, { key: '', value: '' }] })}>
              <Plus size={14} /> Campo
            </button>
          </Fold>

          <Fold id="ficha-mais-detalhes" title="Mais detalhes" defaultOpen={false}>
            <div className="form-grid">
              <EntityPicker label="Fica dentro de" value={e.parentId} exclude={[e.id]} onChange={(v) => set({ parentId: v })} placeholder="Lugar, facção, reino…" />
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
              <div className="field-wide">
                <TagInput label="Etiquetas" value={e.tags} onChange={(v) => set({ tags: v })} />
              </div>
            </div>
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
          <MapGlimpse entity={e} />
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
            Ver nas Ligações
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

/** Tipo de ficha: um dos tipos comuns (pelo nome de verdade) ou um tipo próprio, em “Outro…”. */
function KindSelect({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const { universe } = useWorkspace()
  const known = (ENTITY_KINDS as readonly string[]).includes(value)
  const [typing, setTyping] = useState(false)
  const [draft, setDraft] = useState(known ? '' : value)
  // Os tipos próprios que já existem no universo também entram na lista.
  const own = [...new Set(universe.entities.map((x) => x.kind))].filter((k) => !(ENTITY_KINDS as readonly string[]).includes(k)).sort((a, b) => a.localeCompare(b, 'pt'))
  const commit = () => {
    const v = draft.trim()
    if (v) onChange(v)
    setTyping(false)
  }
  if (typing)
    return (
      <input
        id={id}
        className="input"
        autoFocus
        placeholder="Nome do tipo: navio, doença, idioma…"
        value={draft}
        onChange={(ev) => setDraft(ev.target.value)}
        onBlur={commit}
        onKeyDown={(ev) => {
          if (ev.key === 'Enter') commit()
          if (ev.key === 'Escape') setTyping(false)
        }}
      />
    )
  return (
    <select
      id={id}
      className="input select"
      value={value}
      onChange={(ev) => {
        if (ev.target.value === '__outro') {
          setDraft('')
          setTyping(true)
        } else onChange(ev.target.value)
      }}
    >
      {ENTITY_KINDS.map((k) => (
        <option key={k} value={k}>
          {KIND_LABEL[k]}
        </option>
      ))}
      {own.map((k) => (
        <option key={k} value={k}>
          {k}
        </option>
      ))}
      <option value="__outro">Outro…</option>
    </select>
  )
}

const SKIPPED = 'perguntas-puladas'

/** As fichas em que a pessoa pulou as perguntas (neste navegador). */
function skippedQuestions(): string[] {
  try {
    return JSON.parse(recall(SKIPPED) ?? '[]') as string[]
  } catch {
    return []
  }
}

function skipQuestions(id: string) {
  remember(SKIPPED, JSON.stringify([...skippedQuestions(), id].slice(-300)))
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
    <Fold id="ficha-rela-es" title="Ligações">
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
