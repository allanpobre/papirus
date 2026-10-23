import { Copy, Download, X } from 'lucide-react'
import { useState } from 'react'
import { downloadText, fileNameFor } from '../../export/download'
import { codexFor, codexMarkdown, factSentence } from '../../logic/codex'
import { CANON_LABEL, kindPlural } from '../../model/labels'
import type { Group, Revelation } from '../../model/schema'
import { byId, draftRevelation, insert, patch, remove } from '../../model/universe'
import { useWorkspace } from '../../state/workspace'
import { Select } from '../../ui/bits'
import { EntityPicker } from '../../ui/EntityPicker'

/** O que a mesa já descobriu, e como os jogadores veem isso. */
export function CodexTab({ group }: { group: Group }) {
  const { universe, update, toast } = useWorkspace()
  const sessions = universe.sessions.filter((s) => s.groupId === group.id).sort((a, b) => a.number - b.number)
  const [until, setUntil] = useState<string>('')
  const [addId, setAddId] = useState<string | null>(null)
  const [depth, setDepth] = useState<Revelation['depth']>('resumo')
  const untilNumber = until ? Number(until) : undefined
  const codex = codexFor(universe, group.id, untilNumber)
  const revs = universe.revelations.filter((r) => r.groupId === group.id)
  const kinds = [...new Set(codex.entries.map((e) => e.entity.kind))]
  const md = () => codexMarkdown(universe, group.id, untilNumber)

  return (
    <div className="codex-layout">
      <section className="codex-manage">
        <h2 className="section-title">Revelações para {group.name}</h2>
        <p className="muted small">Só entra no Codex o que você revelar. Escolha quanto de cada ficha a mesa conhece.</p>
        <ul className="reveal-list">
          {revs.map((r) => {
            const label =
              r.target === 'entidade'
                ? (byId(universe, 'entities', r.targetId)?.name ?? 'Ficha removida')
                : (() => {
                    const f = byId(universe, 'facts', r.targetId)
                    return f ? factSentence(universe, f) : 'Fato removido'
                  })()
            const session = r.sessionId ? byId(universe, 'sessions', r.sessionId) : undefined
            return (
              <li key={r.id} className="reveal-row">
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
        <div className="reveal-add">
          <EntityPicker label="Revelar ficha" value={addId} onChange={setAddId} allowCreate={false} />
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
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={!addId}
            onClick={() => {
              if (!addId) return
              update((u) => insert(u, 'revelations', { ...draftRevelation(group.id, 'entidade', addId, null), depth })[0])
              setAddId(null)
            }}
          >
            Revelar
          </button>
        </div>
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
          {codex.entries.length === 0 && codex.facts.length === 0 && <p className="muted">Nada foi revelado ainda.</p>}
          {kinds.map((k) => (
            <section key={k}>
              <h3 className="codex-kind">{kindPlural(k)}</h3>
              {codex.entries
                .filter((e) => e.entity.kind === k)
                .map(({ entity, depth }) => (
                  <div key={entity.id} className="codex-entry">
                    <h4>{entity.name}</h4>
                    {depth !== 'nome' && entity.summary && <p>{entity.summary}</p>}
                    {depth === 'completo' && entity.description && <p className="codex-desc">{entity.description}</p>}
                    {depth === 'nome' && <p className="muted small">Ainda pouco se sabe.</p>}
                  </div>
                ))}
            </section>
          ))}
          {codex.facts.length > 0 && (
            <section>
              <h3 className="codex-kind">O que sabemos</h3>
              <ul>
                {codex.facts.map((f) => (
                  <li key={f.id}>
                    {factSentence(universe, f)}
                    {f.canon !== 'estabelecido' && <em className="muted"> ({CANON_LABEL[f.canon].toLowerCase()})</em>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </section>
    </div>
  )
}
