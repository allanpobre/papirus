import { ArrowLeft, ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import { Fragment, useMemo } from 'react'
import { factSentence } from '../logic/codex'
import { appearancesOf } from '../logic/appearances'
import { MentionMatcher } from '../logic/detection'
import { relationDetails } from '../logic/relations'
import { unmarkReveals } from '../logic/reveals'
import { splitSecrets } from '../logic/secrets'
import { snippet } from '../logic/text'
import { formatYear, KNOWLEDGE_LABEL, kindLabel, SEED_STATUS_LABEL } from '../model/labels'
import type { Entity } from '../model/schema'
import { byId, entityName } from '../model/universe'
import { useWorkspace } from '../state/workspace'
import { CanonBadge, EditorialBadge } from '../ui/bits'
import { Picture } from '../images/Picture'

/** A ficha para ler, como uma página de enciclopédia: texto corrido, quadro ao lado e nomes que levam a outras fichas. */
export function EntityReader({ entity: e, order, modeSwitch }: { entity: Entity; order: Entity[]; modeSwitch: React.ReactNode }) {
  const { universe, go, goBack } = useWorkspace()
  const suffix = universe.settings.calendarSuffix
  const others = useMemo(() => new MentionMatcher(universe.entities.filter((x) => x.id !== e.id)), [universe.entities, e.id])
  const link = (id: string, label?: string) => (
    <button type="button" className="reader-link" onClick={() => go('fichas', id)}>
      {label ?? (entityName(universe, id) || 'Ficha removida')}
    </button>
  )
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
  const relations = universe.relations.filter((r) => r.fromId === e.id || r.toId === e.id)
  const facts = universe.facts.filter((f) => f.subjectId === e.id || f.objectId === e.id)
  const knows = universe.knowledge.filter((k) => k.holderId === e.id)
  const events = universe.events.filter((ev) => ev.entityIds.includes(e.id) || ev.placeId === e.id).sort((a, b) => a.year - b.year)
  const seeds = universe.seeds.filter((s) => s.entityIds.includes(e.id))
  const appearances = useMemo(() => appearancesOf(universe, e), [universe, e])
  const born = formatYear(e.startYear, suffix)
  const died = formatYear(e.endYear, suffix)
  const isPerson = e.kind === 'personagem'
  const paragraphs = e.description
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

  const at = order.findIndex((x) => x.id === e.id)
  const prev = at > 0 ? order[at - 1] : undefined
  const next = at >= 0 && at < order.length - 1 ? order[at + 1] : undefined
  const infobox = [
    parent && ['Fica em', link(parent.id)],
    born && [isPerson ? 'Nascimento' : 'Início', born],
    died && [isPerson ? 'Morte' : 'Fim', died],
    e.aliases.length > 0 && ['Também conhecido como', e.aliases.join(', ')],
    ...e.fields.filter((f) => f.key.trim() || f.value.trim()).map((f) => [f.key || 'Campo', rich(f.value)]),
  ].filter(Boolean) as [string, React.ReactNode][]

  return (
    <article className="entity entity-reader" aria-label={`Ler a ficha ${e.name || 'Sem nome'}`}>
      <header className="reader-head">
        <button type="button" className="btn-icon back-btn" aria-label="Voltar para a lista" onClick={() => goBack('fichas', null)}>
          <ArrowLeft size={18} />
        </button>
        <span className="reader-head-space" />
        {modeSwitch}
      </header>

      <div className="reader-title">
        <p className="eyebrow">
          <span className={`kind-dot kind-${e.kind}`} aria-hidden="true" /> {kindLabel(e.kind)}
        </p>
        <h1>{e.name || 'Sem nome'}</h1>
        <div className="entity-badges">
          <CanonBadge canon={e.canon} />
          <EditorialBadge editorial={e.editorial} />
        </div>
        {e.summary && <p className="reader-lede">{rich(e.summary)}</p>}
      </div>

      <div className="reader-body">
        {(e.image || infobox.length > 0 || e.tags.length > 0 || children.length > 0) && (
          <aside className="reader-infobox" aria-label="Em resumo">
            {e.image && <Picture value={e.image} alt={`Imagem de ${e.name || 'Sem nome'}`} className="reader-portrait" />}
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
                <p>
                  {children.map((c, i) => (
                    <Fragment key={c.id}>
                      {i > 0 && ', '}
                      {link(c.id)}
                    </Fragment>
                  ))}
                </p>
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

        <div className="reader-text">
          {paragraphs.length ? (
            paragraphs.map((p, i) => (
              <p key={i}>{rich(p)}</p>
            ))
          ) : (
            <p className="muted">Ainda sem descrição. Em “Editar” você escreve sobre esta ficha.</p>
          )}

          {relations.length > 0 && (
            <section>
              <h2>Relações</h2>
              <ul>
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

          {appearances.length > 0 && (
            <section>
              <h2>Aparece em</h2>
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
