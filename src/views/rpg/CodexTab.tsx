import { Copy, Download, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { downloadText, fileNameFor } from '../../export/download'
import { codexMarkdown, factSentence, revelationLabel } from '../../logic/codex'
import { relationSentence } from '../../logic/relations'
import type { Group, Revelation } from '../../model/schema'
import { byId, draftRevelation, entityName, insert, patch, remove } from '../../model/universe'
import { useWorkspace } from '../../state/workspace'
import { Select } from '../../ui/bits'
import { EntityPicker } from '../../ui/EntityPicker'
import { codexSnapshot } from '../../share/snapshot'
import { CodexDoc } from './CodexDoc'
import { SharePanel } from './SharePanel'

const TARGET_LABEL: Record<Revelation['target'], string> = {
  entidade: 'Ficha',
  fato: 'Fato',
  evento: 'Evento',
  pista: 'Pista',
  mapa: 'Mapa',
  marcador: 'Marcador de mapa',
  relacao: 'Ligação',
}

/** O que a mesa já descobriu, e como os jogadores veem isso. */
export function CodexTab({ group }: { group: Group }) {
  const { universe, update, toast } = useWorkspace()
  const sessions = universe.sessions.filter((s) => s.groupId === group.id).sort((a, b) => a.number - b.number)
  const [until, setUntil] = useState<string>('')
  const untilNumber = until ? Number(until) : undefined
  const snapshot = useMemo(() => codexSnapshot(universe, group.id, untilNumber), [universe, group.id, untilNumber])
  const revs = universe.revelations.filter((r) => r.groupId === group.id)
  const md = () => codexMarkdown(universe, group.id, untilNumber)

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
        <SharePanel group={group} />
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
        <CodexDoc codex={snapshot} />
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
              : target === 'relacao'
                ? universe.relations.map((r) => ({ value: r.id, label: relationSentence(universe, r).slice(0, 90) }))
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
      {target === 'relacao' && <p className="muted tiny">No Codex, as ligações formam um mapa que cresce a cada sessão. Quem está por trás só aparece se os jogadores já conhecem essa ficha.</p>}
      {target === 'mapa' && <p className="muted tiny">No mapa revelado, aparecem os marcadores revelados e os dos lugares que a mesa já conhece.</p>}
    </div>
  )
}
