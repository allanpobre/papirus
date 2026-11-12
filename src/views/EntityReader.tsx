import { OriginChip } from './AUBanner'
import { ArrowLeft, ChevronLeft, ChevronRight, Dices, Lock, Shuffle } from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'
import { worldLevel } from '../model/kind'
import { DominoDialog } from './DominoDialog'
import { TogetherHere } from './TogetherHere'
import { factSentence } from '../logic/codex'
import { appearancesOf } from '../logic/appearances'
import { sessionsOf } from '../rpg/oneCharacter'
import { derivedField, derivedText, onlyName } from '../logic/derivedFields'
import { answerOf, isBlank, questionsFor } from '../logic/kindQuestions'
import { MentionMatcher } from '../logic/detection'
import { relationDetails } from '../logic/relations'
import { glimpseOf } from '../logic/route'
import { unmarkReveals } from '../logic/reveals'
import { splitSecrets } from '../logic/secrets'
import { fold, snippet } from '../logic/text'
import { inheritedFields, isPast, listsOf, membersOf } from '../model/lists'
import { MembershipChips } from './EntityLists'
import { formatYear, KNOWLEDGE_LABEL, kindLabel, SEED_STATUS_LABEL } from '../model/labels'
import type { Entity } from '../model/schema'
import { byId, entityName, sceneTitle } from '../model/universe'
import { useWorkspace } from '../state/workspace'
import { CanonBadge, EditorialBadge } from '../ui/bits'
import { Picture } from '../images/Picture'
import { MapGlimpse } from './MapGlimpse'

/** A ficha para ler, como uma página de enciclopédia: texto corrido, quadro ao lado e nomes que levam a outras fichas. */
export function EntityReader({ entity: e, order, modeSwitch, onEdit }: { entity: Entity; order: Entity[]; modeSwitch: React.ReactNode; onEdit?: () => void }) {
  const { universe, go, goBack } = useWorkspace()
  const suffix = universe.settings.calendarSuffix
  // Efeito dominó (no Completo): "e se esta ficha sumir?".
  const [dominoOpen, setDominoOpen] = useState(false)
  const canDomino = worldLevel(universe) === 'completo' && universe.relations.some((r) => r.fromId === e.id || r.toId === e.id)
  const others = useMemo(() => new MentionMatcher(universe.entities.filter((x) => x.id !== e.id)), [universe.entities, e.id])
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
  /** Texto livre: sem as marcas de spoiler, com os segredos destacados (só o autor vê esta página) e os nomes como links. */
  const rich = (text: string) =>
    splitSecrets(unmarkReveals(text)).map((part, j) =>
      part.secret ? (
        <mark key={j} className="secret-mark" title="Trecho secreto: só você vê">
          <Lock size={12} aria-label="Segredo" /> {linked(part.text)}
        </mark>
      ) : (
        <Fragment key={j}>{linked(part.text)}</Fragment>
      ),
    )

  const parent = e.parentId ? byId(universe, 'entities', e.parentId) : undefined
  const children = universe.entities.filter((x) => x.parentId === e.id)
  // As ligações de lista aparecem em "Faz parte de" e nas listas desta ficha.
  const relations = universe.relations.filter((r) => (r.fromId === e.id || r.toId === e.id) && !r.listId)
  // Campo próprio vazio não esconde o que vem da lista.
  const ownKeys = new Set(e.fields.filter((f) => f.value.trim() || f.ref).map((f) => fold(f.key.trim())))
  const inherited = inheritedFields(universe, e.id).filter((i) => !ownKeys.has(fold(i.key.trim())))
  const lists = listsOf(e)
  const facts = universe.facts.filter((f) => f.subjectId === e.id || f.objectId === e.id)
  const knows = universe.knowledge.filter((k) => k.holderId === e.id)
  const events = universe.events.filter((ev) => ev.entityIds.includes(e.id) || ev.placeId === e.id).sort((a, b) => a.year - b.year)
  const seeds = universe.seeds.filter((s) => s.entityIds.includes(e.id))
  const appearances = useMemo(() => appearancesOf(universe, e), [universe, e])
  const sessions = useMemo(() => sessionsOf(universe, e.id), [universe, e.id])
  const onMap = useMemo(() => glimpseOf(universe, e.id) !== null, [universe, e.id])
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
    died && [isPerson ? 'Morte' : 'Fim', died],
    e.aliases.length > 0 && ['Também conhecido como', e.aliases.join(', ')],
    // Campo vazio não aparece, a não ser que as ligações respondam ("Líder" ← "Malkai líder de…").
    ...e.fields.flatMap((f): [string, React.ReactNode][] => {
      // Campo que aponta para uma ficha vira link; ano vem com o rótulo do calendário.
      if (f.type === 'ficha' && f.ref) return [[f.key || 'Campo', link(f.ref)]]
      if (f.value.trim()) return [[f.key || 'Campo', f.type === 'ano' && Number.isFinite(Number(f.value)) ? formatYear(Number(f.value), suffix) : rich(f.value)]]
      if (!f.key.trim()) return []
      const ids = derivedField(universe, e, f.key)
      if (ids.length) return [[f.key, <>{links(ids)}</>]]
      // A idade pelo nascimento; o jogador e a classe pela ficha de jogo.
      const text = derivedText(universe, e, f.key)
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

  return (
    <article className="entity entity-reader" aria-label={`Ler a ficha ${e.name || 'Sem nome'}`}>
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
        {modeSwitch}
      </header>
      {dominoOpen && <DominoDialog entity={e} onClose={() => setDominoOpen(false)} />}
      <TogetherHere entityId={e.id} />

      <div className="reader-title">
        <p className="eyebrow">
          <span className={`kind-dot kind-${e.kind}`} aria-hidden="true" /> {kindLabel(e.kind)}
          <OriginChip item={e} full />
        </p>
        <h1>{e.name || 'Sem nome'}</h1>
        {/* Só o que foge do comum: verdade e pronta não precisam de selo. */}
        {(e.canon !== 'estabelecido' || e.editorial !== 'definido') && (
          <div className="entity-badges">
            {e.canon !== 'estabelecido' && <CanonBadge canon={e.canon} />}
            {e.editorial !== 'definido' && <EditorialBadge editorial={e.editorial} />}
          </div>
        )}
        {e.summary && <p className="reader-lede">{rich(e.summary)}</p>}
        {e.game && (e.game.traits.length > 0 || Object.keys(e.game.mods).length > 0) && (
          <p className="reader-game small">
            <Dices size={14} aria-hidden="true" /> No jogo:{' '}
            {[...Object.entries(e.game.mods).map(([k, n]) => `${n > 0 ? '+' : ''}${n} ${k}`), ...e.game.traits].join(' · ')}
          </p>
        )}
        <MembershipChips entity={e} />
      </div>

      <div className="reader-body">
        {(e.image || infobox.length > 0 || e.tags.length > 0 || children.length > 0 || onMap) && (
          <aside className="reader-infobox" aria-label="Em resumo">
            {e.image && <Picture value={e.image} alt={`Imagem de ${e.name || 'Sem nome'}`} className="reader-portrait" />}
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
        )}

        <div className={`reader-text${e.kind === 'documento' ? ' reader-doc' : ''}`}>
          {paragraphs.length ? (
            paragraphs.map((p, i) => (
              <p key={i}>{rich(p)}</p>
            ))
          ) : onEdit && isBlank(e) && open.length > 0 ? (
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
          ) : (
            <p className="muted">Ainda sem descrição. Em “Editar” você escreve sobre esta ficha.</p>
          )}

          {lists.map((l) => {
            const ms = membersOf(universe, e.id, l.id)
            if (!ms.length && !l.shared.length) return null
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

          {relations.length + backlinks.length > 0 && (
            <section>
              <h2>Ligações</h2>
              <ul>
                {backlinks.map(({ from, key }, i) => (
                  <li key={`campo-${i}`}>
                    {e.name} é {key.toLocaleLowerCase('pt-BR') || 'ligado a'} de {link(from.id)}
                  </li>
                ))}
                {relations.map((r) => (
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
                  </li>
                ))}
              </ul>
            </section>
          )}

          {facts.length > 0 && (
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
          )}

          {knows.length > 0 && (
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
          )}

          {(events.length > 0 || born || died) && (
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
          )}

          {seeds.length > 0 && (
            <section>
              <h2>Pistas e mistérios</h2>
              <ul>
                {seeds.map((s) => (
                  <li key={s.id}>
                    <button type="button" className="link-btn" onClick={() => go('tramas', s.id)}>
                      {s.title}
                    </button>{' '}
                    <span className={`seed-status seed-${s.status}`}>{SEED_STATUS_LABEL[s.status]}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(appearances.length > 0 || sessions.length > 0) && (
            <section>
              <h2>Aparece em</h2>
              {appearances.length > 0 && (
                <ul className="appearances" aria-label="Cenas">
                  {appearances.map(({ scene, roles, found }) => (
                    <li key={scene.id}>
                      <button type="button" className="link-btn" onClick={() => go('escrever', scene.id)}>
                        {sceneTitle(scene)}
                      </button>
                      <span className="muted small"> {roles.join(' · ')}</span>
                      {found[0] && <p className="appearance-snippet">{snippet(scene.text, found[0].from, found[0].to, 50)}</p>}
                    </li>
                  ))}
                </ul>
              )}
              {sessions.length > 0 && (
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
          )}
        </div>
      </div>

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
