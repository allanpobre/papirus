import { BookOpen, MapPin, Swords } from 'lucide-react'
import type { ReactNode } from 'react'
import type { CodexSnapshot } from '../../share/snapshot'
import { isEmptySnapshot } from '../../share/snapshot'
import { MiniGraph } from '../../ui/MiniGraph'
import { useImageSrc } from '../../images/resolve'
import { Picture } from '../../images/Picture'

/**
 * Uma parte do Codex. No celular (`folded`), vira uma linha que abre e fecha, com quantos
 * itens tem e quantos são novos; abre sozinha quando há novidade.
 */
function Sec({ title, count, fresh = 0, folded, className, labelledBy, children }: { title: ReactNode; count?: number; fresh?: number; folded: boolean; className?: string; labelledBy?: string; children: ReactNode }) {
  if (!folded)
    return (
      <section className={className} aria-labelledby={labelledBy}>
        <h3 id={labelledBy} className="codex-kind">
          {title}
        </h3>
        {children}
      </section>
    )
  return (
    <details className={`codex-sec ${className ?? ''}`.trim()} open={fresh > 0 || undefined}>
      <summary>
        <h3 id={labelledBy} className="codex-kind">
          {title}
        </h3>
        {fresh > 0 && <span className="codex-new">{fresh === 1 ? '1 novo' : `${fresh} novos`}</span>}
        {count !== undefined && <span className="codex-sec-count tabular">{count}</span>}
      </summary>
      <div className="codex-sec-body">{children}</div>
    </details>
  )
}

/** O Codex como documento: o mesmo na prévia do mestre e no celular dos jogadores (lá, em partes que abrem e fecham). */
export function CodexDoc({ codex, me, folded = false }: { codex: CodexSnapshot; me?: string; folded?: boolean }) {
  return (
    <div className="codex-doc">
      <h2 className="codex-title">Codex</h2>
      <p className="codex-sub">{codex.group}</p>
      {isEmptySnapshot(codex) && !codex.combat && <p className="muted">Nada foi revelado ainda.</p>}

      {codex.combat && !folded && (
        <section className="codex-combat" aria-labelledby="codex-combate">
          <h3 id="codex-combate" className="codex-kind">
            <Swords size={15} aria-hidden="true" /> Combate · Rodada {codex.combat.round}
          </h3>
          <ol className="codex-order">
            {codex.combat.order.map((e) => (
              <li key={e.id} className={`${e.current ? 'is-current' : ''}${e.down ? ' is-down' : ''}${e.name === me ? ' is-me' : ''}`} aria-current={e.current ? 'step' : undefined}>
                <span className="codex-order-name">{e.name}</span>
                {e.current && <span className="codex-order-tag">na vez</span>}
                {e.down && <span className="codex-order-tag is-down">derrotado</span>}
                {e.conditions?.map((c) => (
                  <span key={c} className="codex-order-tag is-cond">
                    {c}
                  </span>
                ))}
              </li>
            ))}
          </ol>
        </section>
      )}

      {codex.party.length > 0 && (
        <Sec title="O grupo" count={codex.party.length} folded={folded}>
          <div className="codex-party">
            {codex.party.map((s, i) => (
              <PartyCard key={i} s={s} />
            ))}
          </div>
        </Sec>
      )}

      {(codex.journal ?? []).length > 0 && (
        <Sec
          className="codex-journal"
          labelledBy="codex-diario"
          folded={folded}
          count={(codex.journal ?? []).length}
          title={
            <>
              <BookOpen size={15} aria-hidden="true" /> Diário da campanha
            </>
          }
        >
          {[...(codex.journal ?? [])].reverse().map((j, i) => (
            <details key={j.number} className="codex-journal-entry" open={i === 0}>
              <summary>
                <span className="codex-journal-title">{j.title}</span>
                <span className="muted small"> · {new Date(j.when + 'T12:00').toLocaleDateString('pt-BR')}</span>
              </summary>
              {j.text.split(/\n+/).map((line, k) => (
                <p key={k}>{line}</p>
              ))}
            </details>
          ))}
        </Sec>
      )}

      {codex.sections.map((sec) => (
        <Sec key={sec.title} title={sec.title} folded={folded} count={sec.entries.length} fresh={sec.entries.filter((e) => e.fresh).length}>
          {sec.entries.map((e, i) => (
            <div key={i} className={`codex-entry${e.fresh ? ' is-fresh' : ''}${e.image ? ' has-portrait' : ''}`}>
              {e.image && <Picture value={e.image} alt={`Retrato de ${e.name}`} className="codex-portrait" />}
              <h4>
                {e.name}
                {e.fresh && <span className="codex-new">novo</span>}
              </h4>
              {e.summary && <p>{e.summary}</p>}
              {e.description && <p className="codex-desc">{e.description}</p>}
              {e.depth === 'nome' && <p className="muted small">Ainda pouco se sabe.</p>}
            </div>
          ))}
        </Sec>
      ))}

      {(codex.relations ?? []).length > 0 && (
        <Sec title="Ligações" folded={folded} count={(codex.relations ?? []).length} fresh={(codex.relations ?? []).filter((r) => r.fresh).length}>
          {(codex.relations ?? []).length > 1 && (() => {
            const rels = codex.relations ?? []
            const names = [...new Set(rels.flatMap((r) => [r.from, r.to]))]
            const freshNames = new Set(rels.filter((r) => r.fresh).flatMap((r) => [r.from, r.to]))
            return <MiniGraph className="leitor-graph codex-graph" nodes={names.map((n) => ({ id: n, label: n, isNew: freshNames.has(n) }))} edges={rels.map((r) => ({ from: r.from, to: r.to, isNew: r.fresh }))} />
          })()}
          <ul className="codex-relations">
            {(codex.relations ?? []).map((r, i) => (
              <li key={i} className={r.fresh ? 'is-fresh' : undefined}>
                {r.text}
                {r.fresh && <span className="codex-new">novo</span>}
              </li>
            ))}
          </ul>
        </Sec>
      )}

      {codex.events.length > 0 && (
        <Sec title="Linha do tempo" folded={folded} count={codex.events.length} fresh={codex.events.filter((e) => e.fresh).length}>
          <ol className="codex-timeline codex-years">
            {codex.events.map((e, i) => (
              <li key={i} className={e.fresh ? 'is-fresh' : undefined}>
                <span className="codex-year">{e.when}</span>
                <span>
                  {e.title}
                  {e.fresh && <span className="codex-new">novo</span>}
                </span>
              </li>
            ))}
          </ol>
        </Sec>
      )}

      {codex.facts.length > 0 && (
        <Sec title="O que sabemos" folded={folded} count={codex.facts.length}>
          <ul>
            {codex.facts.map((f, i) => (
              <li key={i}>
                {f.text}
                {f.tag && <em className="muted"> ({f.tag})</em>}
              </li>
            ))}
          </ul>
        </Sec>
      )}

      {codex.clues.length > 0 && (
        <Sec title="Pistas" folded={folded} count={codex.clues.length}>
          <ul>
            {codex.clues.map((c, i) => (
              <li key={i}>
                {c.text}
                {c.mystery && <em className="muted"> — {c.mystery}</em>}
              </li>
            ))}
          </ul>
        </Sec>
      )}

      {folded && codex.maps.length > 0 ? (
        <Sec title="Mapas" folded count={codex.maps.length}>
          {codex.maps.map((m, i) => (
            <CodexMap key={i} m={m} />
          ))}
        </Sec>
      ) : (
        codex.maps.map((m, i) => <CodexMap key={i} m={m} />)
      )}
    </div>
  )
}

/** Um mapa do Codex (a imagem pode vir embutida ou como referência "img:"). */
function CodexMap({ m }: { m: CodexSnapshot['maps'][number] }) {
  const src = useImageSrc(m.image)
  return (
    <section>
      <h3 className="codex-kind">{m.name}</h3>
      <div className="codex-map" style={{ aspectRatio: `${m.width} / ${m.height}`, backgroundImage: src ? `url("${src}")` : undefined }} role="img" aria-label={`Mapa ${m.name}`}>
        {m.pins.map((p, j) => (
          <span key={j} className="pin codex-pin" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}>
            <MapPin size={20} aria-hidden="true" />
            <span className="pin-label">{p.label}</span>
          </span>
        ))}
      </div>
    </section>
  )
}

/** Um personagem no Codex: o essencial à vista e a ficha toda para consultar (o mestre é quem muda). */
export function PartyCard({ s }: { s: CodexSnapshot['party'][number] }) {
  const more = (s.skills?.length ?? 0) + (s.attacks?.length ?? 0) + (s.abilities?.length ?? 0) + (s.inventory?.length ?? 0) > 0 || s.attrs.length > 0
  return (
    <div className="codex-pc">
      <div className="codex-pc-head">
        {s.image && <Picture value={s.image} alt={`Retrato de ${s.name}`} className="codex-pc-portrait" />}
        <div>
          <h4>{s.name}</h4>
          {s.player && <p className="muted small">{s.player}</p>}
          {s.away && <p className="codex-pc-away small">{s.away === 'fora' ? 'Fora desta sessão' : 'Com o mestre nesta sessão'}</p>}
          {s.fields.length > 0 && <p className="small">{s.fields.map(([, v]) => v).join(' · ')}</p>}
        </div>
      </div>
      {((s.pools?.length ?? 0) > 0 || (s.values?.length ?? 0) > 0) && (
        <div className="codex-pc-vitals">
          {s.pools?.map(([abbr, cur, max]) => (
            <span key={abbr} className="codex-pc-pool">
              <span className="codex-pc-pool-label">
                <strong>{abbr}</strong> <span className="tabular">{cur}/{max}</span>
              </span>
              <span className="resource-bar" aria-hidden="true">
                <span style={{ width: `${max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0}%` }} />
              </span>
            </span>
          ))}
          {s.values?.map(([abbr, v]) => (
            <span key={abbr} className="codex-pc-value">
              {abbr} <strong className="tabular">{v}</strong>
            </span>
          ))}
        </div>
      )}
      {(s.conditions?.length ?? 0) > 0 && <p className="codex-pc-conditions small">{s.conditions!.join(' · ')}</p>}
      {more && (
        <details className="codex-pc-more">
          <summary>Ficha completa</summary>
          {s.attrs.length > 0 && (
            <p className="codex-attrs">
              {s.attrs.map(([abbr, v]) => (
                <span key={abbr}>
                  <strong>{abbr}</strong> {v}
                </span>
              ))}
            </p>
          )}
          {(s.skills?.length ?? 0) > 0 && (
            <>
              <h5>Perícias</h5>
              <ul className="codex-pc-list">
                {s.skills!.map(([name, bonus]) => (
                  <li key={name}>
                    {name} <strong className="tabular">{bonus}</strong>
                  </li>
                ))}
              </ul>
            </>
          )}
          {(s.attacks?.length ?? 0) > 0 && (
            <>
              <h5>Ataques</h5>
              <ul className="codex-pc-list">
                {s.attacks!.map((a) => (
                  <li key={a.name}>
                    {a.name} <strong className="tabular">{[a.test, a.damage, a.critical].filter(Boolean).join(' · ')}</strong>
                  </li>
                ))}
              </ul>
            </>
          )}
          {(s.abilities?.length ?? 0) > 0 && (
            <>
              <h5>Poderes e magias</h5>
              <ul className="codex-pc-list codex-pc-abilities">
                {s.abilities!.map((a) => (
                  <li key={a.name}>
                    <span>
                      {a.name} {a.cost && <strong>{a.cost}</strong>}
                    </span>
                    {a.text && <span className="muted small">{a.text}</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
          {(s.inventory?.length ?? 0) > 0 && (
            <>
              <h5>Inventário</h5>
              <p className="small">{s.inventory!.map(([n, q]) => (q > 1 ? `${q} × ${n}` : n)).join(' · ')}</p>
            </>
          )}
        </details>
      )}
    </div>
  )
}
