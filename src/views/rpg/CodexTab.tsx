import { Copy, Download, MapPin, X } from 'lucide-react'
import { useState } from 'react'
import { downloadText, fileNameFor } from '../../export/download'
import { codexFor, codexMarkdown, factSentence, playerTag, revelationLabel } from '../../logic/codex'
import { stripSecrets } from '../../logic/secrets'
import { formatYear, kindPlural } from '../../model/labels'
import type { Group, Revelation } from '../../model/schema'
import { byId, draftRevelation, entityName, insert, patch, remove } from '../../model/universe'
import { useWorkspace } from '../../state/workspace'
import { Select } from '../../ui/bits'
import { EntityPicker } from '../../ui/EntityPicker'

const TARGET_LABEL: Record<Revelation['target'], string> = {
  entidade: 'Ficha',
  fato: 'Fato',
  evento: 'Evento',
  pista: 'Pista',
  mapa: 'Mapa',
  marcador: 'Marcador de mapa',
}

/** O que a mesa já descobriu, e como os jogadores veem isso. */
export function CodexTab({ group }: { group: Group }) {
  const { universe, update, toast } = useWorkspace()
  const sessions = universe.sessions.filter((s) => s.groupId === group.id).sort((a, b) => a.number - b.number)
  const [until, setUntil] = useState<string>('')
  const untilNumber = until ? Number(until) : undefined
  const codex = codexFor(universe, group.id, untilNumber)
  const revs = universe.revelations.filter((r) => r.groupId === group.id)
  const kinds = [...new Set(codex.entries.map((e) => e.entity.kind))]
  const md = () => codexMarkdown(universe, group.id, untilNumber)
  const suffix = universe.settings.calendarSuffix
  const empty = !codex.entries.length && !codex.facts.length && !codex.events.length && !codex.clues.length && !codex.maps.length && !codex.sheets.length

  return (
    <div className="codex-layout">
      <section className="codex-manage">
        <h2 className="section-title">Revelações para {group.name}</h2>
        <p className="muted small">Só entra no Codex o que você revelar. Trechos marcados como segredo nas fichas nunca aparecem.</p>
        <ul className="reveal-list">
          {revs.map((r) => {
            const label = revelationLabel(universe, r)
            const session = r.sessionId ? byId(universe, 'sessions', r.sessionId) : undefined
            return (
              <li key={r.id} className="reveal-row">
                <span className="reveal-kind">{TARGET_LABEL[r.target]}</span>
                <span className="reveal-label">{label}</span>
                {r.target === 'entidade' && (
                  <Select
                    label={`Quanto de ${label}`}
                    value={r.depth}
                    onChange={(v) => update((u) => patch(u, 'revelations', r.id, { depth: v }))}
                    options={[
                      { value: 'nome', label: 'Só o nome' },
                      { value: 'resumo', label: 'Resumo' },
                      { value: 'completo', label: 'Tudo' },
                    ]}
                  />
                )}
                <span className="muted tiny">{session ? `sessão ${session.number}` : 'sem sessão'}</span>
                <button type="button" className="btn-icon btn-xs" aria-label={`Esconder ${label} de novo`} onClick={() => update((u) => remove(u, 'revelations', r.id))}>
                  <X size={12} />
                </button>
              </li>
            )
          })}
        </ul>
        <RevealForm group={group} />
        <label className="toggle">
          <input type="checkbox" role="switch" checked={group.showSheetsInCodex} onChange={(e) => update((u) => patch(u, 'groups', group.id, { showSheetsInCodex: e.target.checked }))} />
          <span className="toggle-track" aria-hidden="true" />
          <span>Mostrar as fichas dos personagens dos jogadores no Codex</span>
        </label>
      </section>

      <section className="codex-preview" aria-label="Codex como os jogadores veem">
        <div className="codex-bar">
          <span className="eyebrow">Como a mesa vê</span>
          <Select
            label="Até a sessão"
            value={until}
            onChange={setUntil}
            options={[{ value: '', label: 'Até agora' }, ...sessions.map((s) => ({ value: String(s.number), label: `Até a sessão ${s.number}` }))]}
          />
          <button
            type="button"
            className="btn-icon"
            title="Copiar como Markdown"
            aria-label="Copiar Codex"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(md())
                toast('Codex copiado')
              } catch {
                toast('Não foi possível copiar. Use “Baixar”.', { tone: 'erro' })
              }
            }}
          >
            <Copy size={16} />
          </button>
          <button type="button" className="btn-icon" title="Baixar Markdown" aria-label="Baixar Codex" onClick={() => downloadText(fileNameFor(`codex-${group.name}`, 'md'), md())}>
            <Download size={16} />
          </button>
        </div>
        <div className="codex-doc">
          <h2 className="codex-title">Codex</h2>
          <p className="codex-sub">{group.name}</p>
          {empty && <p className="muted">Nada foi revelado ainda.</p>}

          {codex.sheets.length > 0 && (
            <section>
              <h3 className="codex-kind">O grupo</h3>
              <div className="codex-party">
                {codex.sheets.map((s) => {
                  const system = universe.systems.find((x) => x.id === s.systemId)
                  const fields = Object.entries(s.fields).filter(([, v]) => v.trim())
                  return (
                    <div key={s.id} className="codex-pc">
                      <h4>{s.name}</h4>
                      {s.player && <p className="muted small">{s.player}</p>}
                      {fields.length > 0 && <p className="small">{fields.map(([k, v]) => `${k}: ${v}`).join(' · ')}</p>}
                      {system && system.attributes.length > 0 && (
                        <p className="codex-attrs">
                          {system.attributes.map((a) => (
                            <span key={a.id}>
                              <strong>{a.abbr}</strong> {s.attributes[a.id] ?? a.default}
                            </span>
                          ))}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {kinds.map((k) => (
            <section key={k}>
              <h3 className="codex-kind">{kindPlural(k)}</h3>
              {codex.entries
                .filter((e) => e.entity.kind === k)
                .map(({ entity, depth }) => (
                  <div key={entity.id} className="codex-entry">
                    <h4>{entity.name}</h4>
                    {depth !== 'nome' && stripSecrets(entity.summary) && <p>{stripSecrets(entity.summary)}</p>}
                    {depth === 'completo' && stripSecrets(entity.description) && <p className="codex-desc">{stripSecrets(entity.description)}</p>}
                    {depth === 'nome' && <p className="muted small">Ainda pouco se sabe.</p>}
                  </div>
                ))}
            </section>
          ))}

          {codex.events.length > 0 && (
            <section>
              <h3 className="codex-kind">Linha do tempo</h3>
              <ul className="codex-timeline">
                {codex.events.map((e) => (
                  <li key={e.id}>
                    <strong>{e.endYear !== null ? `${formatYear(e.year, suffix)} – ${formatYear(e.endYear, suffix)}` : formatYear(e.year, suffix)}</strong> {e.title}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {codex.facts.length > 0 && (
            <section>
              <h3 className="codex-kind">O que sabemos</h3>
              <ul>
                {codex.facts.map((f) => (
                  <li key={f.id}>
                    {factSentence(universe, f)}
                    {playerTag(universe, f) && <em className="muted"> ({playerTag(universe, f)})</em>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {codex.clues.length > 0 && (
            <section>
              <h3 className="codex-kind">Pistas</h3>
              <ul>
                {codex.clues.map(({ seed, clue }) => (
                  <li key={clue.id}>
                    {clue.text}
                    {seed.kind === 'misterio' && <em className="muted"> — {seed.title}</em>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {codex.maps.map(({ map, pins }) => (
            <section key={map.id}>
              <h3 className="codex-kind">{map.name}</h3>
              <div className="codex-map" style={{ aspectRatio: `${map.width} / ${map.height}`, backgroundImage: `url(${map.image})` }} role="img" aria-label={`Mapa ${map.name}`}>
                {pins.map((p) => (
                  <span key={p.id} className="pin codex-pin" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}>
                    <MapPin size={20} aria-hidden="true" />
                    <span className="pin-label">{p.label || entityName(universe, p.entityId)}</span>
                  </span>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  )
}

/** Escolhe o que revelar: ficha, fato, evento, pista, mapa ou marcador. */
function RevealForm({ group }: { group: Group }) {
  const { universe, update } = useWorkspace()
  const [target, setTarget] = useState<Revelation['target']>('entidade')
  const [entityId, setEntityId] = useState<string | null>(null)
  const [choice, setChoice] = useState('')
  const [depth, setDepth] = useState<Revelation['depth']>('resumo')

  const options: { value: string; label: string }[] =
    target === 'fato'
      ? universe.facts.map((f) => ({ value: f.id, label: factSentence(universe, f).slice(0, 80) }))
      : target === 'evento'
        ? [...universe.events].sort((a, b) => a.year - b.year).map((e) => ({ value: e.id, label: `${e.year} — ${e.title}` }))
        : target === 'pista'
          ? universe.seeds.flatMap((s) => s.clues.map((c) => ({ value: c.id, label: `${s.title}: ${c.text}`.slice(0, 90) })))
          : target === 'mapa'
            ? universe.maps.map((m) => ({ value: m.id, label: m.name }))
            : target === 'marcador'
              ? universe.maps.flatMap((m) => m.pins.map((p) => ({ value: p.id, label: `${m.name}: ${p.label || entityName(universe, p.entityId)}` })))
              : []

  const id = target === 'entidade' ? entityId : choice
  const reveal = () => {
    if (!id) return
    update((u) => insert(u, 'revelations', { ...draftRevelation(group.id, target, id, null), depth: target === 'entidade' ? depth : 'completo' })[0])
    setEntityId(null)
    setChoice('')
  }

  return (
    <div className="reveal-add">
      <Select
        label="O que revelar"
        value={target}
        onChange={(v) => {
          setTarget(v)
          setChoice('')
        }}
        options={(Object.keys(TARGET_LABEL) as Revelation['target'][]).map((t) => ({ value: t, label: TARGET_LABEL[t] }))}
      />
      {target === 'entidade' ? (
        <>
          <EntityPicker label="Revelar ficha" hideLabel value={entityId} onChange={setEntityId} allowCreate={false} />
          <Select
            label="Quanto"
            value={depth}
            onChange={setDepth}
            options={[
              { value: 'nome', label: 'Só o nome' },
              { value: 'resumo', label: 'Resumo' },
              { value: 'completo', label: 'Tudo' },
            ]}
          />
        </>
      ) : options.length ? (
        <Select label={`Escolher ${TARGET_LABEL[target].toLowerCase()}`} value={choice} onChange={setChoice} options={[{ value: '', label: 'Escolha…' }, ...options]} />
      ) : (
        <span className="muted small">Nada deste tipo ainda.</span>
      )}
      <button type="button" className="btn btn-sm btn-primary" disabled={!id} onClick={reveal}>
        Revelar
      </button>
      {target === 'mapa' && <p className="muted tiny">No mapa revelado, aparecem os marcadores revelados e os dos lugares que a mesa já conhece.</p>}
    </div>
  )
}
