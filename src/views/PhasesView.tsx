import { ArrowRight, GitCommitVertical, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { compareAt, phasesOf, type Phase } from '../logic/phases'
import type { Entity } from '../model/schema'
import { manuscriptOrder, newId, patch, sceneTitle } from '../model/universe'
import { useStoryPoint } from '../state/storyPoint'
import { useWorkspace } from '../state/workspace'
import { ConfirmButton } from '../ui/ConfirmButton'

/*
 * As fases de uma ficha (como ela muda ao longo da história). Em Ler: a linha das fases, a de agora em
 * destaque, e "comparar" dois momentos. Em Editar: cada fase com a cena em que começa, o que muda e por quê.
 */

/** Ler: as fases na ordem da história, a de agora em destaque e o comparar. */
export function PhasesReader({ entity, index, reader }: { entity: Entity; index: number; reader: boolean }) {
  const { universe, go } = useWorkspace()
  const scenes = manuscriptOrder(universe)
  const all = phasesOf(entity, scenes)
  // Como o leitor: só as fases que ele já viu começar.
  const list = reader ? all.filter((p) => p.at <= index) : all
  const current = [...list].reverse().find((p) => p.at <= index)?.phase.id ?? null
  const [from, setFrom] = useState(-1)
  const [to, setTo] = useState<number | null>(null)
  if (!list.length) return null
  const toAt = to ?? list[list.length - 1].at
  const diff = compareAt(entity, from, toAt, scenes)
  const label = (at: number) => (at < 0 ? 'O começo' : `${sceneTitle(scenes[at])} (${at + 1})`)

  return (
    <section className="phases-read" aria-label="Ao longo da história">
      <h2>Ao longo da história</h2>
      <ol className="phase-line">
        <li className={current === null ? 'is-current' : undefined}>
          <GitCommitVertical size={14} aria-hidden="true" /> <strong>O começo</strong>
        </li>
        {list.map(({ phase, at }) => (
          <li key={phase.id} className={current === phase.id ? 'is-current' : at > index ? 'is-after' : undefined}>
            <GitCommitVertical size={14} aria-hidden="true" /> <strong>{phase.name || 'Fase'}</strong>{' '}
            <button type="button" className="link-btn small" onClick={() => go('escrever', phase.sceneId)}>
              desde “{sceneTitle(scenes[at])}”
            </button>
            {phase.cause && <span className="muted small"> · {phase.cause}</span>}
          </li>
        ))}
      </ol>
      {!reader && (
        <div className="phase-compare">
          <p className="phase-compare-pick small">
            <span>Comparar</span>
            <select className="input input-sm" aria-label="Comparar de" value={from} onChange={(ev) => setFrom(Number(ev.target.value))}>
              <option value={-1}>O começo</option>
              {list.map(({ phase, at }) => (
                <option key={phase.id} value={at}>
                  {phase.name || 'Fase'} · {label(at)}
                </option>
              ))}
            </select>
            <ArrowRight size={14} aria-hidden="true" />
            <select className="input input-sm" aria-label="Comparar com" value={toAt} onChange={(ev) => setTo(Number(ev.target.value))}>
              <option value={-1}>O começo</option>
              {list.map(({ phase, at }) => (
                <option key={phase.id} value={at}>
                  {phase.name || 'Fase'} · {label(at)}
                </option>
              ))}
            </select>
          </p>
          {diff.length ? (
            <ul className="phase-diff" aria-label="O que mudou">
              {diff.map((d) => (
                <li key={d.key}>
                  <span className="phase-diff-key">{d.key}</span>
                  <span className="phase-diff-before">{d.before || '—'}</span>
                  <ArrowRight size={13} aria-hidden="true" />
                  <span className="phase-diff-after">{d.after || '—'}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">Nada muda entre esses dois momentos.</p>
          )}
        </div>
      )}
    </section>
  )
}

/** Editar: as fases da ficha. A ficha de cima é o começo; cada fase guarda só o que muda a partir de uma cena. */
export function PhasesEditor({ entity: e }: { entity: Entity }) {
  const { universe, update, readOnly } = useWorkspace()
  const scenes = manuscriptOrder(universe)
  const [point] = useStoryPoint(universe.id)
  const list = phasesOf(e, scenes)
  const keys = [...new Set(e.fields.map((f) => f.key.trim()).filter(Boolean))]
  const save = (phases: Phase[]) => update((u) => patch(u, 'entities', e.id, { phases: phases.length ? phases : undefined }))
  const change = (id: string, changes: Partial<Phase>) => save((e.phases ?? []).map((p) => (p.id === id ? { ...p, ...changes } : p)))
  if (!scenes.length) return <p className="muted small">Escreva uma cena antes: cada fase começa numa cena.</p>

  const add = () => {
    // Começa no ponto escolhido na régua; senão, depois da última fase (ou na última cena).
    const last = list.at(-1)?.at ?? -1
    const sceneId = point.sceneId ?? scenes[Math.min(last + 1, scenes.length - 1)].id
    save([...(e.phases ?? []), { id: newId(), sceneId, name: '', cause: '', nameNow: '', summary: '', image: null, fields: [] }])
  }

  return (
    <div className="phases-edit">
      <p className="muted small">A ficha acima é como {e.name || 'ela'} começa. Cada fase vale a partir de uma cena e guarda só o que muda; o resto continua igual.</p>
      {list.map(({ phase: p }, i) => (
        <fieldset key={p.id} className="phase-card" disabled={readOnly}>
          <legend>
            {i + 1}. {p.name || 'Fase sem nome'}
          </legend>
          <label className="field">
            <span className="field-label">A partir de</span>
            <select className="input select" value={p.sceneId} onChange={(ev) => change(p.id, { sceneId: ev.target.value })}>
              {scenes.map((s, j) => (
                <option key={s.id} value={s.id}>
                  {j + 1}. {sceneTitle(s)}
                </option>
              ))}
            </select>
          </label>
          <div className="phase-row">
            <label className="field">
              <span className="field-label">Nome da fase</span>
              <input className="input" placeholder="General, Depois da queda…" value={p.name} onChange={(ev) => change(p.id, { name: ev.target.value })} />
            </label>
            <label className="field">
              <span className="field-label">Por quê</span>
              <input className="input" placeholder="O que aconteceu" value={p.cause} onChange={(ev) => change(p.id, { cause: ev.target.value })} />
            </label>
          </div>
          <label className="field">
            <span className="field-label">Passa a ser chamado</span>
            <input className="input" placeholder={`Vazio: continua “${e.name || 'o mesmo'}”`} value={p.nameNow} onChange={(ev) => change(p.id, { nameNow: ev.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">Resumo a partir daqui</span>
            <textarea className="input textarea" rows={2} placeholder="Vazio: o mesmo de antes" value={p.summary} onChange={(ev) => change(p.id, { summary: ev.target.value })} />
          </label>
          <div className="phase-fields" role="group" aria-label={`Campos que mudam em ${p.name || 'esta fase'}`}>
            <span className="field-label">Campos que mudam</span>
            {p.fields.map((f, j) => (
              <div key={j} className="phase-field">
                <input
                  className="input input-sm"
                  aria-label="Campo"
                  placeholder="Campo"
                  list={`campos-${e.id}`}
                  value={f.key}
                  onChange={(ev) => change(p.id, { fields: p.fields.map((x, k) => (k === j ? { ...x, key: ev.target.value } : x)) })}
                />
                <input
                  className="input input-sm"
                  aria-label={`Novo valor de ${f.key || 'campo'}`}
                  placeholder="Novo valor"
                  value={f.value}
                  onChange={(ev) => change(p.id, { fields: p.fields.map((x, k) => (k === j ? { ...x, value: ev.target.value } : x)) })}
                />
                <button type="button" className="btn-icon btn-sm" aria-label={`Tirar ${f.key || 'campo'} desta fase`} onClick={() => change(p.id, { fields: p.fields.filter((_, k) => k !== j) })}>
                  <X size={14} />
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => change(p.id, { fields: [...p.fields, { key: '', value: '' }] })}>
              <Plus size={14} /> Campo que muda
            </button>
          </div>
          <ConfirmButton className="btn btn-ghost btn-sm" title="Tirar esta fase" question="Tirar esta fase? A ficha volta a ser como era antes dela, a partir dessa cena." confirmLabel="Tirar" onConfirm={() => save((e.phases ?? []).filter((x) => x.id !== p.id))}>
            <Trash2 size={14} aria-hidden="true" /> Tirar esta fase
          </ConfirmButton>
        </fieldset>
      ))}
      <datalist id={`campos-${e.id}`}>
        {keys.map((k) => (
          <option key={k} value={k} />
        ))}
      </datalist>
      {!readOnly && (
        <button type="button" className="btn btn-sm" onClick={add}>
          <Plus size={14} /> Nova fase
        </button>
      )}
    </div>
  )
}
