import { OriginChip } from './AUBanner'
import { PassesEditor, WhoIsEditor, WhoIsReader } from './WhoIs'
import { definerListIds, definersFor, whoIsKeys } from '../logic/definers'
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Dices, Eye, LayoutList, Lock, Pencil, Shuffle } from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'
import { worldLevel } from '../model/kind'
import { DominoDialog } from './DominoDialog'
import { TogetherHere } from './TogetherHere'
import { factSentence } from '../logic/codex'
import { appearancesOf } from '../logic/appearances'
import { roleIn } from '../logic/roles'
import { sessionsOf } from '../rpg/oneCharacter'
import { derivedField, derivedText, onlyName } from '../logic/derivedFields'
import { answerOf, isBlank, questionsFor } from '../logic/kindQuestions'
import { MentionMatcher } from '../logic/detection'
import { relationDetails } from '../logic/relations'
import { glimpseOf } from '../logic/route'
import { entityRevealAt, knownAt, partsAt, pointIndex, relationRevealAt, whoIsAt, yearAt } from '../logic/storyPoint'
import { entityAt, phaseAt } from '../logic/phases'
import { PhasesEditor, PhasesReader } from './PhasesView'
import { ReferencesEditor, ReferencesReader } from './ReferencesView'
import { BLOCK_LABEL, CONTENT_BLOCKS, contentEmpty, moveBlock, removeBlock, visibleBlocks, type Block, type BlockType } from '../model/blocks'
import { AddBlock, BlockFrame } from './BlockFrame'
import { CharacterPowers, CharacterPowersEditor, PowerTree, PowerTreeEditor } from './PowersView'
import { powersAt, systemsOf } from '../logic/powers'
import { ContentBlockEditor, ContentBlockView } from './ContentBlocks'
import { BasicsEditor, FactsEditor, FieldsEditor, KnowledgeSection, MoreOptionsEditor, PortraitButton, RelationsSection } from './EntitiesView'
import { GameRules } from './GameRules'
import { LanguageEditor } from './LanguageEditor'
import { SecretTextarea } from '../ui/SecretText'
import { readerBook } from '../logic/reader'
import { fold } from '../logic/text'
import { inheritedFields, isPast, listsOf, membersOf } from '../model/lists'
import { ListsSection, MembershipChips } from './EntityLists'
import { formatYear, KNOWLEDGE_LABEL, kindLabel, ROLE_LABEL, SEED_STATUS_LABEL } from '../model/labels'
import type { Entity } from '../model/schema'
import { byId, entityName, manuscriptOrder, patch, sceneTitle } from '../model/universe'
import { useStoryPoint } from '../state/storyPoint'
import { StoryPointBar } from '../ui/StoryPointBar'
import { useWorkspace } from '../state/workspace'
import { CanonBadge, EditorialBadge, Field } from '../ui/bits'
import { Picture } from '../images/Picture'
import { GeneratedCover } from '../ui/GeneratedCover'
import { MapGlimpse } from './MapGlimpse'
import { AppearanceList } from './AppearanceList'

/** A ficha para ler, como uma página de enciclopédia: texto corrido, quadro ao lado e nomes que levam a outras fichas. */
export function EntityReader({ entity: base, order, modeSwitch, onEdit }: { entity: Entity; order: Entity[]; modeSwitch: React.ReactNode; onEdit?: () => void }) {
  const { universe, go, goBack, bookId, readOnly, update, undoable, prefs } = useWorkspace()
  const nova = !!prefs.novaCara
  // A régua da história: até qual cena se olha, e se é como o leitor (só o que ele já sabe ali).
  const scenes = manuscriptOrder(universe)
  const [point] = useStoryPoint(universe.id)
  const index = pointIndex(scenes, point.sceneId)
  // A ficha como está naquele ponto: a base mais as fases que já começaram (nome, resumo, retrato, campos).
  const e = entityAt(base, index, scenes)
  const phase = phaseAt(base, index, scenes)
  const suffix = universe.settings.calendarSuffix
  // Efeito dominó (no Completo): "e se esta ficha sumir?".
  const [dominoOpen, setDominoOpen] = useState(false)
  // A página de blocos: qual bloco se edita ali, o básico aberto e o "Arrumar a página".
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editHead, setEditHead] = useState(false)
  const [arrange, setArrange] = useState(false)
  // Nova cara: a ficha vira a tela do personagem, com abas.
  const [tab, setTab] = useState<HeroTab>('visao')
  const canDomino = worldLevel(universe) === 'completo' && universe.relations.some((r) => r.fromId === e.id || r.toId === e.id)
  const others = useMemo(() => new MentionMatcher(universe.entities.filter((x) => x.id !== base.id)), [universe.entities, base.id])
  const reader = point.reader && scenes.length > 0
  const now = point.sceneId ? yearAt(scenes, index) : undefined
  const known = reader ? knownAt(universe, scenes, e, index) : { known: true, first: null }
  const book = useMemo(() => (reader ? readerBook(universe) : null), [reader, universe])
  const link = (id: string, label?: string) => (
    <button type="button" className="reader-link" onClick={() => go('fichas', id)}>
      {label ?? (entityName(universe, id) || 'Ficha removida')}
    </button>
  )
  /** Várias fichas numa linha, a vírgula presa ao nome (para não começar a linha seguinte). */
  const links = (ids: string[]) =>
    ids.map((id, i) => (
      <Fragment key={id}>
        <span className="reader-item">
          {link(id)}
          {i < ids.length - 1 && ','}
        </span>
        {i < ids.length - 1 && ' '}
      </Fragment>
    ))
  /** Texto com os nomes de outras fichas virando links. */
  const linked = (text: string) => {
    const out: React.ReactNode[] = []
    let last = 0
    for (const m of others.find(text)) {
      if (m.from < last) continue
      out.push(text.slice(last, m.from))
      out.push(<Fragment key={m.from}>{link(m.entityId, text.slice(m.from, m.to))}</Fragment>)
      last = m.to
    }
    out.push(text.slice(last))
    return out
  }
  /**
   * Texto livre num ponto da história, com os nomes como links. Para o autor: os segredos destacados e o que
   * o leitor só descobre numa cena, marcado com ela (mais forte se ainda não chegou). Como o leitor: só o que
   * ele já sabe naquele ponto.
   */
  const rich = (text: string) =>
    partsAt(text, index, scenes).flatMap((part, j) => {
      if (reader && (part.secret || part.future || (part.mask && !part.maskActive))) return []
      // A máscara: o que o leitor lê antes da revelação. O autor vê riscado de leve, com a cena.
      if (part.mask && !reader)
        return [
          <mark key={j} className={`mask-mark${part.maskActive ? ' is-active' : ''}`} title={`O leitor lê isto até “${part.revealTitle}”`}>
            {linked(part.text)}{' '}
            <span className="reveal-when">
              <Eye size={11} aria-hidden="true" /> o leitor lê isto até “{part.revealTitle}”
            </span>
          </mark>,
        ]
      if (part.secret)
        return [
          <mark key={j} className="secret-mark" title="Trecho secreto: só você vê">
            <Lock size={12} aria-label="Segredo" /> {linked(part.text)}
          </mark>,
        ]
      if (part.revealTitle !== null && !reader)
        return [
          <mark key={j} className={`reveal-mark${part.future ? ' is-future' : ''}`} title={`O leitor ${part.future ? 'só ' : ''}descobre em “${part.revealTitle}”`}>
            {linked(part.text)}{' '}
            <span className="reveal-when">
              <Eye size={11} aria-hidden="true" /> {part.future ? 'o leitor só descobre em' : 'o leitor descobre em'} “{part.revealTitle}”
            </span>
          </mark>,
        ]
      return [<Fragment key={j}>{linked(part.text)}</Fragment>]
    })

  const parent = e.parentId ? byId(universe, 'entities', e.parentId) : undefined
  const children = universe.entities.filter((x) => x.parentId === e.id)
  // As ligações de lista aparecem em "Faz parte de" e nas listas desta ficha.
  const relations = universe.relations.filter((r) => (r.fromId === e.id || r.toId === e.id) && !r.listId)
  // Campo próprio vazio não esconde o que vem da lista.
  const ownKeys = new Set(e.fields.filter((f) => f.value.trim() || f.ref).map((f) => fold(f.key.trim())))
  // O que vem do "Quem é" (e as exceções) aparece no bloco dele, não aqui.
  const fromWho = definerListIds(universe)
  const whoKeys = whoIsKeys(universe, e)
  const inherited = inheritedFields(universe, e.id).filter((i) => !ownKeys.has(fold(i.key.trim())) && !fromWho.has(i.listId))
  const lists = listsOf(e)
  const facts = universe.facts.filter((f) => f.subjectId === e.id || f.objectId === e.id)
  const knows = universe.knowledge.filter((k) => k.holderId === e.id)
  const events = universe.events.filter((ev) => ev.entityIds.includes(e.id) || ev.placeId === e.id).sort((a, b) => a.year - b.year)
  const seeds = universe.seeds.filter((s) => s.entityIds.includes(e.id))
  const appearances = useMemo(() => appearancesOf(universe, base), [universe, base])
  // Como o leitor: só as cenas até o ponto escolhido (as de depois seriam spoiler).
  const uptoIds = reader ? new Set(scenes.slice(0, index + 1).map((s) => s.id)) : null
  const shownAppearances = uptoIds ? appearances.filter((a) => uptoIds.has(a.scene.id)) : appearances
  const sessions = useMemo(() => sessionsOf(universe, base.id), [universe, base.id])
  const onMap = useMemo(() => glimpseOf(universe, base.id) !== null, [universe, base.id])
  const born = formatYear(e.startYear, suffix)
  const died = formatYear(e.endYear, suffix)
  const isPerson = e.kind === 'personagem'
  const paragraphs = e.description
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

  // O que já liga esta ficha ao resto do mundo, e as perguntas do tipo que nada ainda responde.
  const connected = !onlyName(universe, e)
  const open = questionsFor(e.kind).filter((q) => !answerOf(e.fields, q.key).trim() && derivedField(universe, e, q.key).length === 0 && !derivedText(universe, e, q.key))

  const at = order.findIndex((x) => x.id === e.id)
  const prev = at > 0 ? order[at - 1] : undefined
  const next = at >= 0 && at < order.length - 1 ? order[at + 1] : undefined
  // Quem aponta para esta ficha num campo ("Mãe: Ilsa" na ficha de Kael → Ilsa é mãe de Kael).
  const backlinks = universe.entities.flatMap((x) => (x.id === e.id ? [] : x.fields.filter((f) => f.type === 'ficha' && f.ref === e.id).map((f) => ({ from: x, key: f.key }))))
  const infobox = [
    parent && ['Fica em', link(parent.id)],
    born && [isPerson ? 'Nascimento' : 'Início', born],
    died && !reader && [isPerson ? 'Morte' : 'Fim', died],
    e.aliases.length > 0 && ['Também conhecido como', e.aliases.join(', ')],
    // Campo vazio não aparece, a não ser que as ligações respondam ("Líder" ← "Malkai líder de…").
    ...e.fields.flatMap((f): [string, React.ReactNode][] => {
      if (f.exception && whoKeys.has(fold(f.key.trim()))) return []
      // Campo que aponta para uma ficha vira link; ano vem com o rótulo do calendário.
      if (f.type === 'ficha' && f.ref) return [[f.key || 'Campo', link(f.ref)]]
      if (f.value.trim()) {
        if (f.type === 'ano' && Number.isFinite(Number(f.value))) return [[f.key || 'Campo', formatYear(Number(f.value), suffix)]]
        const shown = rich(f.value)
        return shown.length ? [[f.key || 'Campo', shown]] : []
      }
      if (!f.key.trim()) return []
      const ids = derivedField(universe, e, f.key)
      if (ids.length) return [[f.key, <>{links(ids)}</>]]
      // A idade pelo nascimento; o jogador e a classe pela ficha de jogo.
      const text = derivedText(universe, e, f.key, now)
      return text ? [[f.key, text.text]] : []
    }),
    // O que vem das listas (a espécie, o reino, o clã), com a origem.
    ...inherited.map((i) => [
      i.key,
      <>
        {i.value} <span className="muted small">· de {link(i.ownerId)}</span>
      </>,
    ]),
  ].filter(Boolean) as [string, React.ReactNode][]

  // --- A página de blocos: o que cada bloco mostra e, para o autor, o editor dele ali mesmo. ---
  const tools = !readOnly && !reader
  const simple = worldLevel(universe) === 'simples'
  const withBlocks = (u: typeof universe, fn: (x: Entity) => Block[]) => {
    const x = u.entities.find((y) => y.id === base.id)
    return x ? patch(u, 'entities', x.id, { blocks: fn(x) }) : u
  }
  const saveBlocks = (fn: (x: Entity) => Block[]) => update((u) => withBlocks(u, fn))
  const setBase = (changes: Partial<Entity>) => update((u) => patch(u, 'entities', base.id, changes))
  const isContent = (t: string) => (CONTENT_BLOCKS as readonly string[]).includes(t)
  const labelOf = (b: Block) => (isContent(b.type) && b.title?.trim() ? `${BLOCK_LABEL[b.type as BlockType]} “${b.title.trim()}”` : BLOCK_LABEL[b.type as BlockType])

  const whoDefs = definersFor(universe, e.kind)
  const hasWho = whoDefs.length > 0 && whoIsAt(universe, e, index, scenes).some((r) => !(reader && r.reveal?.future && !r.mask))
  const shownLists = lists.filter((l) => membersOf(universe, e.id, l.id).length > 0 || l.shared.length > 0)
  const bookRelations = book ? book.relations.filter((it) => it.at <= index && it.entityIds.includes(e.id)).map((it) => linked(it.text)) : []
  const bookFacts = book ? book.facts.filter((it) => it.at <= index && it.entityIds.includes(e.id)).map((it) => linked(it.text)) : []
  const bookEvents = book
    ? book.events
        .filter((ev) => ev.at <= index && ev.entityIds.includes(e.id))
        .map((ev) => (
          <>
            <span className="mini-year">{ev.when}</span> {ev.title}
          </>
        ))
    : []

  const quadroView =
    e.image || infobox.length > 0 || e.tags.length > 0 || children.length > 0 || onMap ? (
      <aside className="reader-infobox" aria-label="Em resumo">
        {e.image && !nova && <Picture value={e.image} alt={`Imagem de ${e.name || 'Sem nome'}`} className="reader-portrait" />}
        {onMap && <MapGlimpse entity={e} />}
        {infobox.length > 0 && (
          <dl>
            {infobox.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        )}
        {children.length > 0 && (
          <div>
            <p className="reader-infobox-label">Contém</p>
            <p>{links(children.map((c) => c.id))}</p>
          </div>
        )}
        {e.tags.length > 0 && (
          <div className="chips">
            {e.tags.map((t) => (
              <span key={t} className="chip">
                {t}
              </span>
            ))}
          </div>
        )}
      </aside>
    ) : null

  /** O que o bloco mostra; null quando não tem nada (some da página). */
  const viewOf = (b: Block): React.ReactNode => {
    switch (b.type) {
      case 'quem-e':
        return hasWho ? <WhoIsReader entity={e} link={link} at={{ index, reader, scenes }} /> : null
      case 'texto':
        if (paragraphs.length)
          return paragraphs.map((p, i) => {
            const shownP = rich(p)
            return shownP.length ? <p key={i}>{shownP}</p> : null
          })
        if (onEdit && tools && isBlank(e) && open.length > 0)
          return (
            <div className="reader-blank">
              <p>
                {/* Com membros, ligações ou etiquetas, a ficha não está em branco: só falta o texto. */}
                {connected ? 'Ainda sem descrição.' : 'Ficha em branco.'} {open.length === 1 ? '1 pergunta' : `${open.length} perguntas`} sobre {kindLabel(e.kind).toLowerCase()}{' '}
                {open.length === 1 ? 'ajuda' : 'ajudam'} a começar.
              </p>
              <button type="button" className="btn btn-primary btn-sm" onClick={onEdit}>
                Responder
              </button>
            </div>
          )
        return tools ? <p className="muted">Ainda sem descrição. Toque no lápis para escrever sobre esta ficha.</p> : null
      case 'arvore':
        return (base.nodes?.length ?? 0) > 0 ? <PowerTree system={base} link={link} editable={tools} /> : null
      case 'poderes':
        return !simple && (powersAt(universe, base, index, scenes, reader).size > 0 || (base.learned?.length ?? 0) > 0) ? <CharacterPowers entity={base} index={index} reader={reader} link={link} /> : null
      case 'listas':
        return shownLists.length ? (
          <>
            {shownLists.map((l) => {
              const ms = membersOf(universe, e.id, l.id)
              return (
                <section key={l.id} aria-label={l.name}>
                  <h2>{l.name}</h2>
                  {l.shared.length > 0 && (
                    <p className="muted small">
                      Todos têm: {l.shared.filter((x) => x.key.trim()).map((x) => `${x.key} · ${x.value}`).join('; ')}
                    </p>
                  )}
                  {ms.length > 0 && (
                    <p>
                      {ms.map(({ relation: r, member }, i) => (
                        <Fragment key={r.id}>
                          <span className={`reader-item${isPast(r) ? ' is-past' : ''}`}>
                            {link(member.id)}
                            {r.role && <span className="muted"> ({r.role})</span>}
                            {isPast(r) && <span className="muted"> · até {r.scope.toYear}</span>}
                            {i < ms.length - 1 && ','}
                          </span>
                          {i < ms.length - 1 && ' '}
                        </Fragment>
                      ))}
                    </p>
                  )}
                </section>
              )
            })}
          </>
        ) : null
      case 'ligacoes':
        if (book) return bookRelations.length ? <ReaderKnows title="Ligações" items={bookRelations} /> : null
        return relations.length + backlinks.length > 0 ? (
          <section>
            <h2>Ligações</h2>
            <ul>
              {backlinks.map(({ from, key }, i) => (
                <li key={`campo-${i}`}>
                  {e.name} é {key.toLocaleLowerCase('pt-BR') || 'ligado a'} de {link(from.id)}
                </li>
              ))}
              {relations.map((r) => {
                const rv = relationRevealAt(r, index, scenes)
                return (
                  <li key={r.id}>
                    {r.fromId === e.id ? (
                      <>
                        {e.name} {r.type} {link(r.toId)}
                      </>
                    ) : (
                      <>
                        {link(r.fromId)} {r.type} {e.name}
                      </>
                    )}
                    {relationDetails(universe, r) && <span className="muted"> · {relationDetails(universe, r)}</span>}
                    {rv && (
                      <span className={`reveal-when${rv.future ? ' is-future' : ''}`}>
                        {' '}
                        <Eye size={11} aria-hidden="true" /> {rv.future ? 'o leitor só descobre em' : 'o leitor descobre em'} “{rv.title}”
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        ) : null
      case 'fatos':
        if (book) return bookFacts.length ? <ReaderKnows title="Fatos" items={bookFacts} /> : null
        return facts.length ? (
          <section>
            <h2>Fatos</h2>
            <ul>
              {facts.map((f) => (
                <li key={f.id}>
                  {linked(factSentence(universe, f))} <CanonBadge canon={f.canon} />
                </li>
              ))}
            </ul>
          </section>
        ) : null
      case 'sabe':
        return !reader && knows.length ? (
          <section>
            <h2>O que {e.name || 'esta ficha'} sabe</h2>
            <ul>
              {knows.map((k) => {
                const f = byId(universe, 'facts', k.factId)
                return (
                  <li key={k.id}>
                    <span className="muted">{KNOWLEDGE_LABEL[k.state]}:</span> {f ? linked(factSentence(universe, f)) : 'Fato removido'}
                  </li>
                )
              })}
            </ul>
          </section>
        ) : null
      case 'tempo':
        if (book) return bookEvents.length ? <ReaderKnows title="Linha do tempo" items={bookEvents} /> : null
        return events.length > 0 || born || died ? (
          <section>
            <h2>Linha do tempo</h2>
            <ol className="mini-timeline">
              {born && (
                <li>
                  <span className="mini-year">{born}</span> {isPerson ? 'Nascimento' : 'Início'}
                </li>
              )}
              {events.map((ev) => (
                <li key={ev.id}>
                  <button type="button" className="link-btn" onClick={() => go('timeline', ev.id)}>
                    <span className="mini-year">{formatYear(ev.year, suffix)}</span> {ev.title}
                  </button>
                </li>
              ))}
              {died && (
                <li>
                  <span className="mini-year">{died}</span> {isPerson ? 'Morte' : 'Fim'}
                </li>
              )}
            </ol>
          </section>
        ) : null
      case 'pistas':
        return !reader && seeds.length ? (
          <section>
            <h2>Pistas e mistérios</h2>
            <ul>
              {seeds.map((sd) => (
                <li key={sd.id}>
                  <button type="button" className="link-btn" onClick={() => go('tramas', sd.id)}>
                    {sd.title}
                  </button>{' '}
                  <span className={`seed-status seed-${sd.status}`}>{SEED_STATUS_LABEL[sd.status]}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null
      case 'fases':
        return (base.phases?.length ?? 0) > 0 ? <PhasesReader entity={base} index={index} reader={reader} /> : null
      case 'referencias':
        return !reader && (base.refs?.length ?? 0) > 0 ? <ReferencesReader entity={base} /> : null
      case 'aparece':
        return shownAppearances.length > 0 || (!reader && sessions.length > 0) ? (
          <section>
            <h2>Aparece em</h2>
            {shownAppearances.length > 0 && <AppearanceList entity={e} appearances={shownAppearances} upto={point.sceneId ? index : null} onlyUpto={reader} />}
            {!reader && sessions.length > 0 && (
              <ul className="appearances appearances-sessions" aria-label="Sessões">
                {sessions.map((x) => (
                  <li key={x.sessionId}>
                    <Dices size={14} aria-hidden="true" className="appearance-icon" />{' '}
                    <button type="button" className="link-btn" onClick={() => go('rpg', x.sessionId)}>
                      {x.label}
                    </button>
                    <span className="muted small"> {x.why.join(' · ')}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null
      case 'nota':
      case 'citacao':
      case 'galeria':
        return contentEmpty(b) && !tools ? null : <ContentBlockView block={b} author={tools} rich={rich} />
      default:
        return null
    }
  }

  /** O editor de cada bloco, ali mesmo (sempre na ficha de verdade, sem as fases aplicadas). */
  const editorOf = (b: Block): React.ReactNode | undefined => {
    switch (b.type) {
      case 'quadro':
        return (
          <>
            <div className="row block-portrait">
              <PortraitButton entity={base} onChange={(image) => setBase({ image })} />
              <span className="small muted">Retrato</span>
            </div>
            <FieldsEditor entity={base} />
          </>
        )
      case 'quem-e':
        return (
          <>
            <WhoIsEditor entity={base} />
            <PassesEditor entity={base} />
            {!simple && <GameRules key={base.id} entity={base} />}
            {!simple && <LanguageEditor key={`idioma-${base.id}`} entity={base} />}
          </>
        )
      case 'texto':
        return <Field label="Descrição" wide>{(id) => <SecretTextarea id={id} value={base.description} placeholder="Escreva livremente." onChange={(v) => setBase({ description: v })} />}</Field>
      case 'arvore':
        return <PowerTreeEditor entity={base} />
      case 'poderes':
        return <CharacterPowersEditor entity={base} />
      case 'listas':
        return <ListsSection entity={base} />
      case 'ligacoes':
        return (
          <>
            <MembershipChips entity={base} editable />
            <RelationsSection
              entity={base}
              outgoing={universe.relations.filter((r) => r.fromId === base.id && !r.listId)}
              incoming={universe.relations.filter((r) => r.toId === base.id && !r.listId)}
            />
          </>
        )
      case 'fatos':
        return <FactsEditor entity={base} />
      case 'sabe':
        return <KnowledgeSection entity={base} entries={knows} />
      case 'fases':
        return <PhasesEditor entity={base} />
      case 'referencias':
        return <ReferencesEditor entity={base} />
      case 'nota':
      case 'citacao':
      case 'galeria':
        return <ContentBlockEditor entity={base} block={b} />
      default:
        return undefined
    }
  }

  const layout = visibleBlocks(base)
  const quadro = layout.find((b) => b.type === 'quadro')
  const shown = layout
    .filter((b) => b.type !== 'quadro')
    .map((block) => ({ block, node: viewOf(block) }))
    .filter(({ block, node }) => node !== null || editingId === block.id)
  const shownIds = shown.map((x) => x.block.id)
  // O "+ Bloco" oferece os blocos de dados que estão vazios (e têm editor); no Simples, sem fases e listas.
  const emptyTypes = layout
    .filter((b) => !isContent(b.type) && editorOf(b) !== undefined && (b.type === 'quadro' ? !quadroView : !shownIds.includes(b.id)))
    .map((b) => b.type as BlockType)
    .filter((t) => !(simple && (t === 'fases' || t === 'listas' || t === 'poderes')))
    // A árvore é do sistema de magia; os poderes, de quem pode ter (com algum sistema no mundo).
    .filter((t) => (t !== 'arvore' || base.kind === 'magia') && (t !== 'poderes' || (base.kind !== 'magia' && systemsOf(universe).length > 0)))
    .filter((t) => (t !== 'quem-e' || whoDefs.length > 0 || ['personagem', 'faccao', 'reino'].includes(base.kind)))

  // --- Nova cara: a tela do personagem (retrato, atributos em volta, selos e abas). ---
  const heroStats = infobox.filter(([k]) => k !== 'Também conhecido como' && k !== 'Fica em').slice(0, 4)
  const changedKeys = new Set((phase?.phase.fields ?? []).map((f) => fold(f.key.trim())))
  const seals = known.known
    ? whoIsAt(universe, e, index, scenes).flatMap((r) => {
        const hidden = reader && r.reveal?.future
        if (hidden && !r.mask) return []
        const shownOpt = hidden ? r.mask! : r.option
        return [{ id: r.definerId, label: shownOpt.name || 'Sem nome', optionId: shownOpt.id, locked: !reader && !!r.reveal?.future, title: r.definerName }]
      })
    : []
  const tabOf = (t: string): HeroTab => HERO_TAB_OF[t] ?? 'visao'
  const tabs = HERO_TABS.filter(([t]) => t === 'visao' || shown.some(({ block }) => tabOf(block.type) === t))
  const activeTab = tabs.some(([t]) => t === tab) ? tab : 'visao'
  const inTab = nova ? shown.filter(({ block }) => tabOf(block.type) === activeTab) : shown

  return (
    <article className={`entity entity-reader${nova ? ' is-hero' : ''}`} aria-label={`Ler a ficha ${e.name || 'Sem nome'}`}>
      <header className="reader-head">
        <button type="button" className="btn-icon back-btn" aria-label="Voltar para a lista" onClick={() => goBack('fichas', null)}>
          <ArrowLeft size={18} />
        </button>
        <span className="reader-head-space" />
        {canDomino && (
          <button type="button" className="btn btn-ghost btn-sm" title="Efeito dominó: o que acontece se esta ficha sumir" onClick={() => setDominoOpen(true)}>
            <Shuffle size={15} aria-hidden="true" /> E se sumir?
          </button>
        )}
        {tools && (
          <>
            <button type="button" className="btn-icon" aria-label="Editar o básico" title="Editar nome, resumo, tipo e apelidos" aria-pressed={editHead} onClick={() => setEditHead(!editHead)}>
              <Pencil size={16} />
            </button>
            <button type="button" className="btn-icon" aria-label="Arrumar a página" title="Subir, descer e tirar blocos" aria-pressed={arrange} onClick={() => setArrange(!arrange)}>
              <LayoutList size={16} />
            </button>
          </>
        )}
        {modeSwitch}
      </header>
      {dominoOpen && <DominoDialog entity={e} onClose={() => setDominoOpen(false)} />}
      <TogetherHere entityId={e.id} />
      <StoryPointBar />

      {nova && (
        <section className="hero" aria-label={`Retrato de ${e.name || 'Sem nome'}`}>
          <div className="hero-stage">
            <button
              type="button"
              className="hero-frame"
              aria-label={tools ? 'Trocar o retrato e os campos' : `Retrato de ${e.name || 'Sem nome'}`}
              disabled={!tools || !quadro}
              onClick={() => quadro && setEditingId(quadro.id)}
            >
              {e.image ? <Picture value={e.image} alt={`Imagem de ${e.name || 'Sem nome'}`} className="hero-portrait" /> : <GeneratedCover name={e.name || '?'} className="hero-portrait" />}
            </button>
            {heroStats.map(([k, v], i) => (
              <div key={k} className={`hero-stat hero-stat-${i + 1}${changedKeys.has(fold(k.trim())) ? ' is-changed' : ''}`}>
                <small>{k}</small>
                <b>{v}</b>
              </div>
            ))}
          </div>
          <h1 className="hero-name">{e.name || 'Sem nome'}</h1>
          <p className="hero-tags">
            {roleIn(e, bookId) && <span className="hero-role">★ {ROLE_LABEL[roleIn(e, bookId)!]}</span>}
            {!roleIn(e, bookId) && <span className="hero-kind">{kindLabel(e.kind)}</span>}
            {phase && <span className="phase-chip">{phase.phase.name || 'Fase'}</span>}
            <OriginChip item={e} full />
          </p>
          {seals.length > 0 && (
            <p className="hero-seals">
              {seals.map((s) => (
                <button key={s.id} type="button" className={`hero-seal${s.locked ? ' is-locked' : ''}`} title={s.locked ? `${s.title}: o leitor ainda não sabe` : s.title} onClick={() => go('fichas', s.optionId)}>
                  {s.locked && <Lock size={11} aria-label="Segredo por enquanto" />} {s.label}
                </button>
              ))}
            </p>
          )}
        </section>
      )}
      <div className={`reader-title${nova ? ' is-under-hero' : ''}`}>
        {!nova && (
        <p className="eyebrow">
          <span className={`kind-dot kind-${e.kind}`} aria-hidden="true" /> {kindLabel(e.kind)}
          {roleIn(e, bookId) && <span className="entity-role"> · {ROLE_LABEL[roleIn(e, bookId)!]}</span>}
          <OriginChip item={e} full />
        </p>
        )}
        {!nova && <h1>{e.name || 'Sem nome'}</h1>}
        {!nova && phase && (
          <p className="phase-now small">
            <span className="phase-chip">{phase.phase.name || 'Fase'}</span> desde “{sceneTitle(scenes[phase.at])}”{phase.phase.cause && <span className="muted"> · {phase.phase.cause}</span>}
          </p>
        )}
        {/* Só o que foge do comum: verdade e pronta não precisam de selo. */}
        {(e.canon !== 'estabelecido' || e.editorial !== 'definido') && (
          <div className="entity-badges">
            {e.canon !== 'estabelecido' && <CanonBadge canon={e.canon} />}
            {e.editorial !== 'definido' && <EditorialBadge editorial={e.editorial} />}
          </div>
        )}
        {!reader && e.reveal && (() => {
          const rv = entityRevealAt(e, index, scenes)
          return rv ? (
            <p className={`reveal-when entity-reveal-note${rv.future ? ' is-future' : ''}`}>
              <Eye size={12} aria-hidden="true" /> {rv.future ? 'O leitor só conhece esta ficha em' : 'O leitor conhece esta ficha em'} “{rv.title}”
            </p>
          ) : null
        })()}
        {!known.known && (
          <p className="notice small story-point-unknown" role="status">
            O leitor ainda não conhece {e.name || 'esta ficha'} neste ponto.{' '}
            {known.first !== null ? `Aparece pela primeira vez em “${sceneTitle(scenes[known.first])}”.` : 'Ainda não aparece em nenhuma cena.'}
          </p>
        )}
        {known.known && e.summary && rich(e.summary).length > 0 && <p className="reader-lede">{rich(e.summary)}</p>}
        {e.game && (e.game.traits.length > 0 || Object.keys(e.game.mods).length > 0) && (
          <p className="reader-game small">
            <Dices size={14} aria-hidden="true" /> No jogo:{' '}
            {[...Object.entries(e.game.mods).map(([k, n]) => `${n > 0 ? '+' : ''}${n} ${k}`), ...e.game.traits].join(' · ')}
          </p>
        )}
        {known.known && <MembershipChips entity={e} at={{ index, reader, scenes }} />}
      </div>

      {editHead && tools && (
        <div className="block-editor reader-head-editor" role="group" aria-label="Editando: o básico">
          <p className="block-editor-head small">
            <strong>O básico</strong>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditHead(false)}>
              <Check size={14} aria-hidden="true" /> Pronto
            </button>
          </p>
          <Field label="Nome">{(id) => <input id={id} className="input" value={base.name} placeholder="Sem nome" onChange={(ev) => setBase({ name: ev.target.value })} />}</Field>
          <BasicsEditor entity={base} />
          <p className="block-editor-head small">
            <strong>Mais opções</strong>
          </p>
          <MoreOptionsEditor entity={base} simple={simple} />
        </div>
      )}

      {known.known && nova && tabs.length > 1 && (
        <nav className="hero-tabs" aria-label="Partes da ficha">
          {tabs.map(([t, label]) => (
            <button key={t} type="button" aria-current={activeTab === t ? 'page' : undefined} onClick={() => setTab(t)}>
              {label}
            </button>
          ))}
        </nav>
      )}
      {known.known && (
        <div className="reader-body">
          {quadro && (nova ? editingId === quadro.id || (activeTab === 'visao' && quadroView && (infobox.length > 4 || onMap || children.length > 0 || e.tags.length > 0)) : quadroView || editingId === quadro.id) && (
            <BlockFrame
              block={quadro}
              label={BLOCK_LABEL.quadro}
              editor={editorOf(quadro)}
              tools={tools}
              arrange={arrange}
              editing={editingId === quadro.id}
              onEditing={(on) => setEditingId(on ? quadro.id : null)}
              onRemove={() => saveBlocks((x) => removeBlock(x, quadro.id))}
            >
              {quadroView}
            </BlockFrame>
          )}
          <div className={`reader-text${e.kind === 'documento' ? ' reader-doc' : ''}`}>
            {inTab.map(({ block: b, node }, i) => (
              <BlockFrame
                key={b.id}
                block={b}
                label={labelOf(b)}
                editor={editorOf(b)}
                tools={tools}
                arrange={arrange}
                first={i === 0}
                last={i === inTab.length - 1}
                editing={editingId === b.id}
                onEditing={(on) => setEditingId(on ? b.id : null)}
                onMove={(step) => saveBlocks((x) => moveBlock(x, b.id, step, shownIds))}
                onRemove={() => {
                  if (editingId === b.id) setEditingId(null)
                  if (isContent(b.type)) undoable(`${labelOf(b)} tirada da página`, (u) => withBlocks(u, (x) => removeBlock(x, b.id)))
                  else saveBlocks((x) => removeBlock(x, b.id))
                }}
              >
                {node}
              </BlockFrame>
            ))}
            {tools && (
              <AddBlock
                entity={base}
                empty={emptyTypes}
                onOpen={(type, id) => {
                  setEditingId(id ?? layout.find((b) => b.type === type)?.id ?? type)
                  if (nova) setTab(tabOf(type))
                }}
              />
            )}
          </div>
        </div>
      )}

      {(prev || next) && (
        <nav className="reader-pager" aria-label="Outras fichas">
          {prev ? (
            <button type="button" className="reader-pager-btn" onClick={() => go('fichas', prev.id)}>
              <ChevronLeft size={18} aria-hidden="true" />
              <span>
                <span className="muted tiny">Anterior</span>
                <strong>{prev.name || 'Sem nome'}</strong>
              </span>
            </button>
          ) : (
            <span />
          )}
          {next && (
            <button type="button" className="reader-pager-btn is-next" onClick={() => go('fichas', next.id)}>
              <span>
                <span className="muted tiny">Próxima</span>
                <strong>{next.name || 'Sem nome'}</strong>
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          )}
        </nav>
      )}
    </article>
  )
}

/** Nova cara: as abas da tela do personagem e em qual delas mora cada bloco. */
type HeroTab = 'visao' | 'ligacoes' | 'poderes' | 'diario' | 'referencias'
const HERO_TABS: [HeroTab, string][] = [
  ['visao', 'Visão'],
  ['ligacoes', 'Ligações'],
  ['poderes', 'Poderes'],
  ['diario', 'Diário'],
  ['referencias', 'Referências'],
]
const HERO_TAB_OF: Record<string, HeroTab> = { ligacoes: 'ligacoes', listas: 'ligacoes', poderes: 'poderes', fases: 'diario', tempo: 'diario', aparece: 'diario', referencias: 'referencias' }

/** Uma seção do que o leitor já sabe naquele ponto (ligações, fatos, datas), como no caderno do leitor. */
function ReaderKnows({ title, items }: { title: string; items: React.ReactNode[] }) {
  if (!items.length) return null
  return (
    <section>
      <h2>{title}</h2>
      <ul>
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </section>
  )
}
