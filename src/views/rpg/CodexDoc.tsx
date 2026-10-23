import { MapPin } from 'lucide-react'
import type { CodexSnapshot } from '../../share/snapshot'
import { isEmptySnapshot } from '../../share/snapshot'

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
            <div key={i} className="codex-entry">
              <h4>{e.name}</h4>
              {e.summary && <p>{e.summary}</p>}
              {e.description && <p className="codex-desc">{e.description}</p>}
              {e.depth === 'nome' && <p className="muted small">Ainda pouco se sabe.</p>}
            </div>
          ))}
        </section>
      ))}

      {codex.events.length > 0 && (
        <section>
          <h3 className="codex-kind">Linha do tempo</h3>
          <ul className="codex-timeline">
            {codex.events.map((e, i) => (
              <li key={i}>
                <strong>{e.when}</strong> {e.title}
              </li>
            ))}
          </ul>
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
        <section key={i}>
          <h3 className="codex-kind">{m.name}</h3>
          <div className="codex-map" style={{ aspectRatio: `${m.width} / ${m.height}`, backgroundImage: `url(${m.image})` }} role="img" aria-label={`Mapa ${m.name}`}>
            {m.pins.map((p, j) => (
              <span key={j} className="pin codex-pin" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}>
                <MapPin size={20} aria-hidden="true" />
                <span className="pin-label">{p.label}</span>
              </span>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
