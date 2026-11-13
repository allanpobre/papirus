import { OriginChip } from './AUBanner'
import { PassesEditor, WhoIsEditor } from './WhoIs'
import { whoIsKeys } from '../logic/definers'
import { NameIdeas } from './NameIdeas'
import { ArrowLeft, BookMarked, BookOpen, Check, Copy, Dices, ImagePlus, ListPlus, Loader2, PenLine, Pencil, Plus, Stamp, Trash2, X } from 'lucide-react'
import { Picture } from '../images/Picture'
import { useImagePicker } from '../images/useImagePicker'
import { useMemo, useRef, useState } from 'react'
import { factSentence } from '../logic/codex'
import { fold, snippet } from '../logic/text'
import { involvements, scopeLabel } from '../logic/relations'
import { RelationDetails } from './RelationDetails'
import { CANON_HINT, formatYear, KIND_LABEL, KNOWLEDGE_LABEL, kindLabel, kindPlural, SEED_STATUS_LABEL } from '../model/labels'
import { ENTITY_KINDS, FIELD_TYPES, KNOWLEDGE_STATES, type Entity, type KnowledgeState } from '../model/schema'
import {
  bookOnly,
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
import { worldLevel } from '../model/kind'
import { GameRules } from './GameRules'
import { TogetherHere } from './TogetherHere'
import { appearancesOf, sceneCounts } from '../logic/appearances'
import { EntityGame } from './EntityGame'
import { EntityReader } from './EntityReader'
import { KindQuestions } from './KindQuestions'
import { MapGlimpse } from './MapGlimpse'
import { derivedHint, onlyName } from '../logic/derivedFields'
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
import { findRanges } from '../editor/find'
import { openBookReplace } from './write/replaceEvents'
import { BulkCreateDialog, NewEntityDialog } from './EntityCreate'
import { InheritedRows, ListsSection, MembershipChips } from './EntityLists'
import { SelectionBar } from './EntitySelection'
import { EntityTable } from './EntityTable'
import { createFromTemplate, saveAsTemplate, templatesOf } from '../model/entityTemplates'
import { MoreMenu } from '../ui/MoreMenu'
import { listsOf, listTemplatesFor, PLACE_KINDS } from '../model/lists'
import { useKindOptions } from './kindOptions'
import { useMediaQuery } from '../ui/useMediaQuery'

export default function EntitiesView() {
  const { universe, update, nav, go, readOnly, peek, bookId, toast } = useWorkspace()
  // O que foi criado nesta visita fica na lista mesmo com um livro escolhido (ainda não aparece no texto dele).
  const [since] = useState(() => new Date().toISOString())
  // Ler ou editar: a ficha abre para ler, e a escolha fica lembrada; quem só pode ler, lê.
  const [mode, setMode] = useState<FichaMode>(() => {
    const saved = recall('ficha-modo')
    return !readOnly && (saved === 'editar' || saved === 'jogo') ? saved : 'ler'
  })
  // A ficha que acabou de nascer aqui abre para editar.
  const [fresh, setFresh] = useState<string | null>(null)
  const changeMode = (m: FichaMode) => {
    setMode(m)
    setFresh(null)
    remember('ficha-modo', m)
  }
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<string>('todos')
  const [newName, setNewName] = useState('')
  const [newKind, setNewKind] = useState('personagem')
  const kindOptions = useKindOptions()
  const phone = useMediaQuery('(max-width: 760px)')
  // Criar uma (no celular, numa janela que não sai da lista) ou várias de uma vez.
  const [creating, setCreating] = useState<null | 'uma' | 'varias'>(null)
  // Selecionar várias: pôr numa lista, etiqueta, tipo ou apagar de uma vez.
  const [picked, setPicked] = useState<Set<string> | null>(null)
  // Lista ou tabela (no computador): a tabela mostra as fichas lado a lado, com os campos em colunas.
  const [layout, setLayout] = useState<'lista' | 'tabela'>(() => (recall('mundo-vista') === 'tabela' ? 'tabela' : 'lista'))
  const changeLayout = (l: 'lista' | 'tabela') => {
    setLayout(l)
    remember('mundo-vista', l)
    setPicked(null)
  }
  const table = layout === 'tabela' && !phone
  const templates = templatesOf(universe)
  const fromTemplate = (t: (typeof templates)[number]) => {
    let id = ''
    update((u) => {
      const [next, ent] = createFromTemplate(u, t, newName.trim())
      id = ent.id
      return next
    })
    setNewName('')
    setFresh(id)
    go('fichas', id)
  }
  const togglePick = (id: string) => setPicked((p) => (p ? (p.has(id) ? new Set([...p].filter((x) => x !== id)) : new Set([...p, id])) : p))
  type Order = 'nome' | 'cenas' | 'recentes'
  const [order, setOrder] = useState<Order>(() => {
    const o = recall('fichas-ordem')
    return o === 'cenas' || o === 'recentes' ? o : 'nome'
  })
  const changeOrder = (o: Order) => {
    setOrder(o)
    remember('fichas-ordem', o)
  }

  const selectedId = nav.view === 'fichas' ? (nav.id ?? null) : null
  const selected = selectedId ? byId(universe, 'entities', selectedId) : undefined
  // A aba Jogo: só num personagem com ficha de jogo (na Mesa).
  const hasGame = Boolean(selected && universe.sheets.some((x) => x.entityId === selected.id))
  const shownMode: FichaMode = selected && fresh === selected.id ? 'editar' : mode === 'jogo' && !hasGame ? 'ler' : mode

  const kinds = useMemo(() => {
    const all = new Set([...ENTITY_KINDS.filter((k) => universe.entities.some((e) => e.kind === k)), ...universe.entities.map((e) => e.kind)])
    return [...all]
  }, [universe.entities])

  // Em quantas cenas cada ficha aparece: o que a história usa e o que está só nas notas (sem cobrança).
  // Com um livro escolhido no alto, conta só as cenas dele, e a lista mostra só quem aparece nele.
  const counts = useMemo(() => sceneCounts(bookOnly(universe, bookId)), [universe, bookId])
  const book = bookId ? byId(universe, 'stories', bookId) : undefined
  const [everyone, setEveryone] = useState(false)
  const onlyBook = Boolean(book) && !everyone
  const hasScenes = universe.scenes.some((sc) => sc.text.trim())
  const [where, setWhere] = useState<'tudo' | 'cenas' | 'notas'>('tudo')
  const inScenes = universe.entities.filter((e) => counts.get(e.id)).length

  const list = useMemo(() => {
    const q = fold(query.trim())
    return universe.entities
      .filter((e) => kind === 'todos' || e.kind === kind)
      .filter((e) => where === 'tudo' || (where === 'cenas') === Boolean(counts.get(e.id)))
      // A ficha recém-criada fica na lista mesmo antes de aparecer no livro.
      .filter((e) => !onlyBook || Boolean(counts.get(e.id)) || e.id === fresh || e.createdAt >= since)
      .filter(
        (e) =>
          !q ||
          namesOf(e).some((n) => fold(n).includes(q)) ||
          fold(e.summary).includes(q) ||
          e.tags.some((t) => fold(t).includes(q)) ||
          // Também nos campos ("Espécie: elfo") e na descrição.
          e.fields.some((f) => fold(`${f.key} ${f.value}`).includes(q)) ||
          fold(e.description).includes(q),
      )
      .sort((a, b) =>
        order === 'cenas'
          ? (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || a.name.localeCompare(b.name, 'pt')
          : order === 'recentes'
            ? b.updatedAt.localeCompare(a.updatedAt)
            : a.name.localeCompare(b.name, 'pt'),
      )
  }, [universe.entities, kind, query, where, counts, order, onlyBook, fresh, since])

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
    <div className={`view split fichas-view${selected ? ' has-detail' : ''}${table ? ' is-table' : ''}`}>
      <AreaHead current="fichas" tour="fichas" />
      <section className="split-list" aria-label="Lista de fichas">
        {/* No celular, a lista vem primeiro: criar fica no botão redondo. */}
        {!phone && !readOnly && (
          <>
            <form className="quick-create" onSubmit={create}>
              <label htmlFor="nova-ficha" className="sr-only">
                Nome da nova ficha
              </label>
              <input id="nova-ficha" className="input" placeholder="Nova ficha…" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <Select label="Tipo da nova ficha" value={newKind} onChange={setNewKind} options={kindOptions} />
              <button type="submit" className="btn btn-primary" aria-label="Criar ficha">
                <Plus size={16} />
              </button>
              <button type="button" className="btn btn-ghost" aria-label="Criar várias de uma vez" title="Criar várias de uma vez (colar uma lista de nomes)" onClick={() => setCreating('varias')}>
                <ListPlus size={16} />
              </button>
              {templates.length > 0 && (
                <MoreMenu label="Criar a partir de um modelo" buttonClass="btn btn-ghost" button={<Stamp size={16} aria-label="Criar a partir de um modelo" />}>
                  {(close) => (
                    <>
                      <span className="more-menu-label">Nova ficha a partir de</span>
                      {templates.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          className="more-menu-item"
                          onClick={() => {
                            close()
                            fromTemplate(t)
                          }}
                        >
                          <Copy size={15} /> {t.name}
                        </button>
                      ))}
                    </>
                  )}
                </MoreMenu>
              )}
              <NameIdeas kind={newKind} onPick={setNewName} compact />
            </form>
          </>
        )}
        {/* Sem nenhuma ficha, não há o que procurar nem selecionar. */}
        {universe.entities.length > 0 && (
          <>
        <div className="list-tools">
          <input className="input" data-livre aria-label="Filtrar fichas" placeholder="Procurar…" title="Procura no nome, nos campos e na descrição" value={query} onChange={(e) => setQuery(e.target.value)} />
          <Select
            label="Filtrar por tipo"
            value={kind}
            onChange={setKind}
            options={[{ value: 'todos', label: `Todas (${onlyBook ? inScenes : universe.entities.length})` },...kinds.map((k) => ({ value: k, label: kindPlural(k) }))]}
          />
          <Select<Order>
            label="Ordem da lista"
            value={order}
            onChange={changeOrder}
            options={[
              { value: 'nome', label: 'A–Z' },
              { value: 'cenas', label: phone ? 'Cenas' : 'Mais nas cenas' },
              { value: 'recentes', label: 'Recentes' },
            ]}
          />
        </div>
        <div className="list-modes">
          {!phone && (
            <div className="segmented" role="radiogroup" aria-label="Vista do Mundo">
              <button type="button" role="radio" aria-checked={!table} onClick={() => changeLayout('lista')}>
                Lista
              </button>
              <button type="button" role="radio" aria-checked={table} onClick={() => changeLayout('tabela')}>
                Tabela
              </button>
            </div>
          )}
          {!readOnly && !table && (
            <button type="button" className="btn btn-ghost btn-sm" aria-pressed={picked !== null} onClick={() => setPicked(picked ? null : new Set())}>
              {picked ? 'Pronto' : 'Selecionar'}
            </button>
          )}
        </div>
          </>
        )}
        {book && (
          <p className="book-filter-note small">
            {onlyBook ? (
              <>
                Só quem aparece em “{book.title || 'Sem título'}”.{' '}
                <button type="button" className="link-btn" onClick={() => setEveryone(true)}>
                  Ver todas as fichas
                </button>
              </>
            ) : (
              <>
                Todas as fichas do mundo.{' '}
                <button type="button" className="link-btn" onClick={() => setEveryone(false)}>
                  Só as deste livro
                </button>
              </>
            )}
          </p>
        )}
        {hasScenes && universe.entities.length > 0 && !phone && !onlyBook && (
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
            {!universe.entities.length && <p>{phone ? 'Toque no + para criar uma' : 'Crie uma acima'}, ou selecione um nome no texto e escolha “Ficha”.</p>}
          </Empty>
        ) : (
          <ul className="entity-list">
            {list.map((e) => (
              <li key={e.id}>
                {picked ? (
                  <label className={`entity-row is-picking${picked.has(e.id) ? ' is-picked' : ''}`}>
                    <input type="checkbox" checked={picked.has(e.id)} onChange={() => togglePick(e.id)} aria-label={`Marcar ${e.name || 'Sem nome'}`} />
                    <span className="entity-row-name">{e.name || 'Sem nome'}</span>
                    <span className="entity-row-kind">{kindLabel(e.kind)}</span>
                  </label>
                ) : (
                <button type="button" className="entity-row" aria-current={e.id === selectedId ? 'true' : undefined} onClick={() => go('fichas', e.id)}>
                  {e.image ? <Picture value={e.image} className="entity-row-pic" /> : <span className={`kind-dot kind-${e.kind}`} aria-hidden="true" />}
                  <span className="entity-row-name">
                    {e.name || 'Sem nome'}
                    <OriginChip item={e} />
                  </span>
                  {hasScenes ? <SceneCount n={counts.get(e.id) ?? 0} /> : <span className="entity-row-kind">{kindLabel(e.kind)}</span>}
                  <span className="entity-row-summary">
                    {hasScenes && <span className="entity-row-kindtext">{kindLabel(e.kind)}</span>}
                    {hasScenes && e.summary && ' · '}
                    {e.summary}
                  </span>
                </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {picked && (
          <>
            <button type="button" className="link-btn small" onClick={() => setPicked(new Set(list.map((x) => x.id)))}>
              Marcar as {list.length} da lista
            </button>
            <SelectionBar ids={[...picked]} onClear={() => setPicked(null)} />
          </>
        )}
        {phone && !readOnly && !picked && (
          <button type="button" className="fab" aria-label="Nova ficha" onClick={() => setCreating('uma')}>
            <Plus size={22} />
          </button>
        )}
        {creating === 'uma' && (
          <NewEntityDialog
            initialKind={kind !== 'todos' ? kind : newKind}
            onClose={() => setCreating(null)}
            onMany={() => setCreating('varias')}
            onOpen={(id) => {
              setCreating(null)
              setFresh(id)
              go('fichas', id)
            }}
          />
        )}
        {creating === 'varias' && (
          <BulkCreateDialog
            initialKind={kind !== 'todos' ? kind : newKind}
            onClose={() => setCreating(null)}
            onDone={(k) => {
              setCreating(null)
              setKind(k)
              setQuery('')
              if (onlyBook && book) toast(`Fichas criadas no mundo. Elas entram em “${book.title || 'Sem título'}” quando o texto citar o nome; até lá, ficam aqui na lista.`)
            }}
          />
        )}
      </section>

      <section className="split-detail" aria-label={table ? 'Tabela de fichas' : 'Ficha'}>
        {table ? (
          <EntityTable rows={list} kind={kind} counts={counts} onOpen={(id) => peek(id)} />
        ) : selected ? (
          shownMode === 'jogo' && !readOnly ? (
            <EntityGame key={selected.id} entity={selected} modeSwitch={<ModeSwitch mode="jogo" game onChange={changeMode} />} />
          ) : shownMode === 'ler' || readOnly ? (
            <EntityReader
              key={selected.id}
              entity={selected}
              order={list}
              modeSwitch={!readOnly && <ModeSwitch mode="ler" game={hasGame} onChange={changeMode} />}
              onEdit={
                readOnly
                  ? undefined
                  : () => {
                      // "Responder" traz as perguntas de volta, mesmo que tenham sido puladas antes.
                      unskipQuestions(selected.id)
                      setFresh(selected.id)
                    }
              }
            />
          ) : (
            <EntityDetail key={selected.id} entity={selected} modeSwitch={<ModeSwitch mode="editar" game={hasGame} onChange={changeMode} />} />
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
  // Só o nome: nem texto, nem ligação, nem lista (uma facção com membros não está em branco).
  const blank = ents.filter((e) => onlyName(universe, e))
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

type FichaMode = 'ler' | 'editar' | 'jogo'

/** Alternar entre ler a ficha como uma página, editá-la e (num personagem de jogo) ver a ficha de jogo. */
function ModeSwitch({ mode, game = false, onChange }: { mode: FichaMode; game?: boolean; onChange: (m: FichaMode) => void }) {
  return (
    <div className="mode-switch" role="group" aria-label="Modo da ficha">
      <button type="button" aria-pressed={mode === 'ler'} onClick={() => onChange('ler')}>
        <BookOpen size={15} aria-hidden="true" /> Ler
      </button>
      <button type="button" aria-pressed={mode === 'editar'} onClick={() => onChange('editar')}>
        <PenLine size={15} aria-hidden="true" /> Editar
      </button>
      {game && (
        <button type="button" aria-pressed={mode === 'jogo'} onClick={() => onChange('jogo')}>
          <Dices size={15} aria-hidden="true" /> Jogo
        </button>
      )}
    </div>
  )
}

function EntityDetail({ entity: e, modeSwitch }: { entity: Entity; modeSwitch: React.ReactNode }) {
  const { universe, update, go, goBack, peek, undoable, toast, readOnly } = useWorkspace()
  // Num mundo Simples, a ficha mostra o essencial; "Mostrar tudo" abre o resto só nesta ficha.
  const [showAll, setShowAll] = useState(false)
  const simple = worldLevel(universe) === 'simples' && !showAll
  // Ao renomear a ficha, o nome antigo continua no texto: o Papirus oferece trocar (mostrando cada trecho antes).
  const nameAtFocus = useRef<string | null>(null)
  const offerRename = () => {
    const old = nameAtFocus.current?.trim()
    const now = e.name.trim()
    nameAtFocus.current = null
    if (readOnly || !old || !now || old === now) return
    const opts = { wholeWord: true, matchCase: true }
    const n = universe.scenes.reduce((sum, s) => sum + findRanges(s.text, old, opts).length + findRanges(s.title, old, opts).length, 0)
    if (!n) return
    toast(`“${old}” aparece ${n === 1 ? '1 vez' : `${n} vezes`} nas cenas. Trocar por “${now}”?`, {
      action: { label: 'Ver e trocar', run: () => openBookReplace({ find: old, replace: now, opts }) },
    })
  }
  const [factFor, setFactFor] = useState<boolean>(false)
  const set = (changes: Partial<Entity>) => update((u) => patch(u, 'entities', e.id, changes))
  const summaryRef = useRef<HTMLInputElement>(null)
  const suffix = universe.settings.calendarSuffix
  // Ficha vazia: perguntas do tipo dela para começar (até sair da ficha, mesmo depois da primeira resposta).
  const [asking, setAsking] = useState(() => isBlank(e) && !skippedQuestions().includes(e.id))

  // As ligações de lista ("faz parte de") aparecem em "Faz parte de" e nas listas, não aqui.
  const outgoing = universe.relations.filter((r) => r.fromId === e.id && !r.listId)
  const incoming = universe.relations.filter((r) => r.toId === e.id && !r.listId)
  const children = universe.entities.filter((x) => x.parentId === e.id)
  const facts = universe.facts.filter((f) => f.subjectId === e.id || f.objectId === e.id)
  const knows = universe.knowledge.filter((k) => k.holderId === e.id)
  const events = universe.events.filter((ev) => ev.entityIds.includes(e.id) || ev.placeId === e.id).sort((a, b) => a.year - b.year)
  const seeds = universe.seeds.filter((s) => s.entityIds.includes(e.id))

  const appearances = useMemo(() => appearancesOf(universe, e), [universe, e])
  const whoKeys = useMemo(() => whoIsKeys(universe, e), [universe, e])
  const groupsOthers = listsOf(e).length > 0 || listTemplatesFor(universe, e.kind).length > 0

  return (
    <article className="entity">
      <TogetherHere entityId={e.id} />
      <header className="entity-head">
        <button type="button" className="btn-icon back-btn" aria-label="Voltar para a lista" onClick={() => goBack('fichas', null)}>
          <ArrowLeft size={18} />
        </button>
        <PortraitButton entity={e} onChange={(image) => set({ image })} />
        <div className="entity-title-wrap">
          <label htmlFor="entity-name" className="sr-only">
            Nome
          </label>
          <input
            id="entity-name"
            className="entity-name"
            value={e.name}
            placeholder="Sem nome"
            onFocus={() => (nameAtFocus.current = e.name)}
            onBlur={offerRename}
            onChange={(ev) => set({ name: ev.target.value })}
          />
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

          {/* 1. Básico: o que se usa sempre. */}
          <div className="form-grid entity-basics">
            <Field label="Resumo" wide>
              {(id) => (
                <div className="with-reveal">
                  <input ref={summaryRef} id={id} className="input" value={e.summary} placeholder="Uma linha sobre esta ficha" onChange={(ev) => set({ summary: ev.target.value })} />
                  <RevealPicker label="Resumo" value={e.summary} inputRef={summaryRef} onChange={(v) => set({ summary: v })} />
                </div>
              )}
            </Field>
            <Field label="Tipo">{(id) => <KindSelect id={id} value={e.kind} onChange={(kind) => set({ kind })} />}</Field>
            {/* "Fica dentro de" é de lugar (cidade no reino); o resto usa listas. */}
            {(PLACE_KINDS.includes(e.kind) || e.parentId) && (
              <EntityPicker label="Fica dentro de" kinds={PLACE_KINDS} value={e.parentId} exclude={[e.id]} onChange={(v) => set({ parentId: v })} placeholder="Reino, lugar…" />
            )}
          </div>
          <div className="entity-names">
            <TagInput label="Outros nomes, títulos, identidades" value={e.aliases} onChange={(v) => set({ aliases: v })} placeholder="Pale Man, o Herdeiro…" />
            <TagInput label="Etiquetas" value={e.tags} onChange={(v) => set({ tags: v })} placeholder="porto, nobreza…" />
          </div>

          {/* 2. Quem é: o que define a ficha neste mundo (e, numa opção, o que ela passa). */}
          <WhoIsEditor entity={e} />
          <PassesEditor entity={e} />
          {!simple && <GameRules key={e.id} entity={e} />}

          {/* 3. Descrição. */}
          <Field label="Descrição" wide>
            {(id) => <SecretTextarea id={id} value={e.description} placeholder="Escreva livremente." onChange={(v) => set({ description: v })} />}
          </Field>

          {/* 4. Campos (com as datas). */}
          <Fold id="ficha-campos" title="Campos">
            <div className="field">
              <span className="field-label">{e.kind === 'personagem' ? 'Nascimento — morte' : 'Início — fim'}</span>
              <div className="inline-fields">
                <YearInput label="Ano de início" value={e.startYear} onChange={(v) => set({ startYear: v })} placeholder="Início" />
                <span className="muted">—</span>
                <YearInput label="Ano de fim" value={e.endYear} onChange={(v) => set({ endYear: v })} placeholder="Fim" />
              </div>
            </div>
            <InheritedRows entity={e} />
            {e.fields.map((f, i) =>
              // As respostas às perguntas ficam nas perguntas enquanto elas estão na tela; as exceções, no "Quem é".
              (asking && askedKey(e.kind, f.key)) || (f.exception && whoKeys.has(fold(f.key.trim()))) ? null : (
                <div key={i} className="kv-row kv-typed">
                  <input className="input" aria-label="Campo" placeholder="Campo" value={f.key} onChange={(ev) => set({ fields: e.fields.map((x, j) => (j === i ? { ...x, key: ev.target.value } : x)) })} />
                  <TypedValue
                    entity={e}
                    field={f}
                    onChange={(changes) => set({ fields: e.fields.map((x, j) => (j === i ? { ...x, ...changes } : x)) })}
                  />
                  <select
                    className="input select field-type"
                    aria-label={`Tipo do campo ${f.key || ''}`.trim()}
                    title="Tipo do campo"
                    value={f.type ?? 'texto'}
                    onChange={(ev) => {
                      const type = ev.target.value as NonNullable<typeof f.type>
                      set({ fields: e.fields.map((x, j) => (j === i ? { ...x, type, ...(type === 'ficha' ? {} : { ref: null }) } : x)) })
                    }}
                  >
                    {FIELD_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {FIELD_TYPE_LABEL[t]}
                      </option>
                    ))}
                  </select>
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

          {/* Uma ficha que junta outras (facção, reino, lugar) mostra as listas; nas outras, ficam em "Mais opções". */}
          {!simple && groupsOthers && <ListsSection entity={e} />}

          {/* 5. Ligações. */}
          <MembershipChips entity={e} editable />
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

          {/* O resto, fechado: muda pouco e não precisa estar sempre à vista. */}
          <Fold id="ficha-mais-opcoes" title="Mais opções" defaultOpen={false}>
            <div className="form-grid">
              {!simple && (
                <>
                  <Field label="É verdade no mundo?" hint={e.canon === 'estabelecido' ? undefined : CANON_HINT[e.canon]}>
                    {(id) => <CanonSelect id={id} value={e.canon} onChange={(v) => set({ canon: v })} />}
                  </Field>
                  <Field label="Quão pronta">{(id) => <EditorialSelect id={id} value={e.editorial} onChange={(v) => set({ editorial: v })} />}</Field>
                </>
              )}
              <label className="toggle entity-wiki-toggle">
                <input type="checkbox" role="switch" checked={!e.wikiHidden} onChange={(ev) => set({ wikiHidden: ev.target.checked ? undefined : true })} />
                <span className="toggle-track" aria-hidden="true" />
                <span>Entra na wiki</span>
              </label>
            </div>
            {!simple && !groupsOthers && <ListsSection entity={e} />}
          </Fold>
          {worldLevel(universe) === 'simples' && (
            <button type="button" className="btn btn-ghost btn-sm entity-show-all" aria-pressed={showAll} onClick={() => setShowAll((v) => !v)}>
              {showAll ? 'Mostrar só o essencial' : 'Mostrar tudo nesta ficha'}
            </button>
          )}
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
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            title="Fichas novas podem sair preenchidas como esta (campos, etiquetas, listas)"
            onClick={() => {
              update((u) => saveAsTemplate(u, e)[0])
              toast(`“${e.name || 'Sem nome'}” virou modelo. Use no “+” do Mundo.`)
            }}
          >
            <Stamp size={14} /> Usar como modelo
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

function unskipQuestions(id: string) {
  const skipped = skippedQuestions()
  if (skipped.includes(id)) remember(SKIPPED, JSON.stringify(skipped.filter((x) => x !== id)))
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
  // Cada ligação é uma linha ("irmão de Mira"); o lápis abre o resto (tipo, verdade, período, quem está por trás).
  const [open, setOpen] = useState<string | null>(null)
  const editButton = (rs: Universe['relations']) => (
    <button type="button" className="btn-icon btn-sm relation-edit" aria-label={`Editar a ligação “${rs[0].type || 'sem nome'}”`} title="Editar" onClick={() => setOpen(rs[0].id)}>
      <Pencil size={13} />
    </button>
  )
  const doneButton = (
    <button type="button" className="btn btn-ghost btn-sm relation-done" onClick={() => setOpen(null)}>
      <Check size={14} /> Pronto
    </button>
  )
  const lineMeta = (rs: Universe['relations']) => (
    <>
      {scopeLabel(universe, rs[0]) && <span className="muted small">{scopeLabel(universe, rs[0])}</span>}
      {rs[0].canon !== 'estabelecido' && <CanonBadge canon={rs[0].canon} />}
      {rs[0].via.length > 0 && <span className="muted small">com {rs[0].via.map((v) => entityName(universe, v.entityId)).join(', ')}</span>}
    </>
  )
  // Campos que apontam para fichas ("Mãe: Ilsa") também são ligações, dos dois lados.
  const fieldLinks = e.fields.filter((f) => f.type === 'ficha' && f.ref)
  const fieldBacklinks = universe.entities.flatMap((x) => (x.id === e.id ? [] : x.fields.filter((f) => f.type === 'ficha' && f.ref === e.id).map((f) => ({ from: x, key: f.key }))))

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
          <button type="button" className="chip-x" aria-label={`Tirar ${entityName(universe, r[side])} desta ligação`} onClick={() => update((u) => remove(u, 'relations', r.id))}>
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
        aria-label={rs.length > 1 ? 'Remover estas ligações' : 'Remover ligação'}
        onClick={() => update((u) => rs.reduce((acc, r) => remove(acc, 'relations', r.id), u))}
      >
        <X size={14} />
      </button>
    </>
  )

  const outRow = (rs: Universe['relations']) =>
    open !== rs[0].id ? (
      <li key={rs[0].id} className="relation-row is-line">
        <span className="relation-type-text">{rs[0].type || 'ligado a'}</span>
        <span className="chips relation-targets">
          {names(rs, 'toId', false)}
          {lineMeta(rs)}
        </span>
        {editButton(rs)}
      </li>
    ) : (
    <li key={rs[0].id} className="relation-row">
      <span className="muted">{e.name}</span>
      <input
        className="input input-sm relation-type"
        aria-label="Tipo da ligação"
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
      {doneButton}
    </li>
    )

  const inRow = (rs: Universe['relations']) =>
    open !== rs[0].id ? (
      <li key={rs[0].id} className="relation-row is-line">
        <span className="chips relation-targets">
          {names(rs, 'fromId', false)}
          <span className="relation-type-text">{rs[0].type}</span>
          <span className="muted">{e.name}</span>
          {lineMeta(rs)}
        </span>
        {editButton(rs)}
      </li>
    ) : (
      <li key={rs[0].id} className="relation-row">
        <span className="chips relation-targets">{names(rs, 'fromId', true)}</span>
        <span className="relation-type-text">{rs[0].type}</span>
        <span className="muted">{e.name}</span>
        {groupControls(rs)}
        <RelationDetails relations={rs} exclude={[e.id, ...rs.map((r) => r.fromId)]} />
        {doneButton}
      </li>
    )

  return (
    <Fold id="ficha-rela-es" title="Ligações">
      {outgoing.length + incoming.length + fieldLinks.length + fieldBacklinks.length === 0 && (
        // Os membros e o "faz parte de" ficam nas listas: aqui só as outras ligações.
        <p className="muted small">{universe.relations.some((r) => r.listId && (r.fromId === e.id || r.toId === e.id)) ? 'Fora das listas, nenhuma ligação ainda.' : 'Nenhuma ligação ainda.'}</p>
      )}
      <ul className="relation-list">
        {group(outgoing).map(outRow)}
        {group(incoming).map(inRow)}
        {fieldLinks.map((f, i) => (
          <li key={`campo-${i}`} className="relation-row is-line is-field">
            <span className="relation-type-text">{f.key || 'Campo'}</span>
            <span className="chips relation-targets">
              <span className="chip chip-entity">
                <button type="button" className="chip-link" onClick={() => peek(f.ref!)}>
                  {entityName(universe, f.ref!) || f.value || 'Ficha removida'}
                </button>
              </span>
            </span>
            <span className="muted small">do campo</span>
          </li>
        ))}
        {fieldBacklinks.map(({ from, key }, i) => (
          <li key={`de-campo-${i}`} className="relation-row is-line is-field">
            <span className="relation-type-text">
              {key || 'Campo'} de
            </span>
            <span className="chips relation-targets">
              <span className="chip chip-entity">
                <button type="button" className="chip-link" onClick={() => peek(from.id)}>
                  {from.name || 'Sem nome'}
                </button>
              </span>
            </span>
            <span className="muted small">do campo de {from.name || 'Sem nome'}</span>
          </li>
        ))}
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
        <input className="input input-sm" aria-label="Nova ligação" list="tipos-relacao" placeholder="é irmão de…" value={type} onChange={(ev) => setType(ev.target.value)} />
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
const FIELD_TYPE_LABEL: Record<(typeof FIELD_TYPES)[number], string> = { texto: 'Texto', numero: 'Número', ano: 'Ano', ficha: 'Ficha' }

/** O valor do campo do jeito do tipo: texto (com segredo), número, ano do calendário ou uma ficha. */
function TypedValue({ entity: e, field: f, onChange }: { entity: Entity; field: Entity['fields'][number]; onChange: (changes: Partial<Entity['fields'][number]>) => void }) {
  const { universe } = useWorkspace()
  const type = f.type ?? 'texto'
  if (type === 'numero')
    return <input className="input" inputMode="decimal" aria-label="Valor" placeholder="0" value={f.value} onChange={(ev) => onChange({ value: ev.target.value.replace(/[^\d.,\-\s\p{L}]/gu, '') })} />
  if (type === 'ano')
    return (
      <div className="with-reveal">
        <YearInput label="Valor (ano)" value={f.value.trim() && Number.isFinite(Number(f.value)) ? Number(f.value) : null} onChange={(y) => onChange({ value: y === null ? '' : String(y) })} />
        {universe.settings.calendarSuffix && <span className="muted small">{universe.settings.calendarSuffix}</span>}
      </div>
    )
  if (type === 'ficha')
    return (
      <EntityPicker
        label={f.key ? `${f.key} (ficha)` : 'Valor (ficha)'}
        hideLabel
        placeholder="Qual ficha…"
        value={f.ref ?? null}
        exclude={[e.id]}
        onChange={(id) => onChange({ ref: id, value: id ? (byId(universe, 'entities', id)?.name ?? '') : '' })}
      />
    )
  // Vazio, mas outra parte do app já responde ("Malkai líder de…" no Líder, a idade pelo nascimento): aparece em cinza.
  const hint = (!f.value.trim() && f.key.trim() && derivedHint(universe, e, f.key)) || undefined
  return <FieldValue value={f.value} label={f.key || 'Valor'} placeholder={hint} onChange={(v) => onChange({ value: v })} />
}

function FieldValue({ value, label, placeholder = 'Valor', onChange }: { value: string; label: string; placeholder?: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="with-reveal">
      <input ref={ref} className="input" aria-label="Valor" placeholder={placeholder} title={placeholder === 'Valor' ? undefined : placeholder} value={value} onChange={(ev) => onChange(ev.target.value)} />
      <RevealPicker label={label} value={value} inputRef={ref} onChange={onChange} />
    </div>
  )
}
