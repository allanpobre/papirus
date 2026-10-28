import { MapPin } from 'lucide-react'
import type { CodexSnapshot } from '../../share/snapshot'
import { isEmptySnapshot } from '../../share/snapshot'
import { MiniGraph } from '../../ui/MiniGraph'
import { useImageSrc } from '../../images/resolve'
import { Picture } from '../../images/Picture'

/** O Codex como documento: o mesmo na prévia do mestre e no celular dos jogadores. */
export function CodexDoc({ codex }: { codex: CodexSnapshot }) {
  return (
    <div className="codex-doc">
      <h2 className="codex-title">Codex</h2>
      <p className="codex-sub">{codex.group}</p>
      {isEmptySnapshot(codex) && <p className="muted">Nada foi revelado ainda.</p>}

      {codex.party.length > 0 && (
        <section>
          <h3 className="codex-kind">O grupo</h3>
          <div className="codex-party">
            {codex.party.map((s, i) => (
              <div key={i} className="codex-pc">
                <h4>{s.name}</h4>
                {s.player && <p className="muted small">{s.player}</p>}
                {s.fields.length > 0 && <p className="small">{s.fields.map(([k, v]) => `${k}: ${v}`).join(' · ')}</p>}
                {s.attrs.length > 0 && (
                  <p className="codex-attrs">
                    {s.attrs.map(([abbr, v]) => (
                      <span key={abbr}>
                        <strong>{abbr}</strong> {v}
                      </span>
                    ))}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {codex.sections.map((sec) => (
        <section key={sec.title}>
          <h3 className="codex-kind">{sec.title}</h3>
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
        </section>
      ))}

      {(codex.relations ?? []).length > 0 && (
        <section>
          <h3 className="codex-kind">Ligações</h3>
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
        </section>
      )}

      {codex.events.length > 0 && (
        <section>
          <h3 className="codex-kind">Linha do tempo</h3>
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
        </section>
      )}

      {codex.facts.length > 0 && (
        <section>
          <h3 className="codex-kind">O que sabemos</h3>
          <ul>
            {codex.facts.map((f, i) => (
              <li key={i}>
                {f.text}
                {f.tag && <em className="muted"> ({f.tag})</em>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {codex.clues.length > 0 && (
        <section>
          <h3 className="codex-kind">Pistas</h3>
          <ul>
            {codex.clues.map((c, i) => (
              <li key={i}>
                {c.text}
                {c.mystery && <em className="muted"> — {c.mystery}</em>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {codex.maps.map((m, i) => (
        <CodexMap key={i} m={m} />
      ))}
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
