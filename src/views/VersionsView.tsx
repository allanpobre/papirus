import { CalendarClock, Check, GitCommitVertical, ImagePlus, Pencil, Plus, Trash2, Undo2, X } from 'lucide-react'
import { useState } from 'react'
import { before, phasesOf, plannedOf, type Phase, type VersionView } from '../logic/phases'
import { fold } from '../logic/text'
import { Picture } from '../images/Picture'
import { useImagePicker } from '../images/useImagePicker'
import type { Entity } from '../model/schema'
import { manuscriptOrder, newId, patch, sceneTitle } from '../model/universe'
import { useWorkspace } from '../state/workspace'
import { ConfirmButton } from '../ui/ConfirmButton'
import { Modal } from '../ui/Modal'

/*
 * As versões do personagem na própria página: o começo, cada fase (presa a uma cena ou planejada) e "+ Nova
 * versão". Tocar numa mostra a ficha inteira como ela é naquela versão; "Editar esta versão" abre um editor
 * focado, que já vem com os valores de antes e guarda só o que muda.
 */

/** A barra de versões, no alto da ficha (só o autor). `current` é a versão vista ('base', o id da fase ou null: a da régua). */
export function VersionsBar({ entity: e, current, onPick }: { entity: Entity; current: string | null; onPick: (id: string | null) => void }) {
  const { universe } = useWorkspace()
  const scenes = manuscriptOrder(universe)
  const placed = phasesOf(e, scenes)
  const planned = plannedOf(e, scenes)
  const [sheet, setSheet] = useState<Phase | 'nova' | null>(null)
  const chip = (id: string, label: React.ReactNode, extra = '') => (
    <li key={id}>
      <button type="button" className={`version-chip${extra}`} aria-pressed={current === id} onClick={() => onPick(current === id ? null : id)}>
        {label}
      </button>
    </li>
  )
  return (
    <section className="versions-bar" aria-label="Versões">
      <p className="versions-head small">
        <strong>Versões</strong>
        {!placed.length && !planned.length && <span className="muted">Como {e.name || 'esta ficha'} muda: outro nome, outro posto, outro rosto.</span>}
      </p>
      <ul className="versions-row">
        {(placed.length > 0 || planned.length > 0) && chip('base', 'O começo')}
        {placed.map(({ phase, at }) =>
          chip(
            phase.id,
            <>
              <GitCommitVertical size={13} aria-hidden="true" /> {phase.nameNow || phase.name || 'Versão'} <span className="version-when">{at + 1}. {sceneTitle(scenes[at])}</span>
            </>,
          ),
        )}
        {planned.map((p) =>
          chip(
            p.id,
            <>
              <CalendarClock size={13} aria-hidden="true" /> {p.nameNow || p.name || 'Versão'} {p.when && <span className="version-when">{p.when}</span>}
            </>,
            ' is-planned',
          ),
        )}
        <li>
          <button type="button" className="version-chip version-add" onClick={() => setSheet('nova')}>
            <Plus size={14} aria-hidden="true" /> Nova versão
          </button>
        </li>
      </ul>
      {sheet && (
        <VersionSheet
          entity={e}
          phase={sheet === 'nova' ? null : sheet}
          onClose={() => setSheet(null)}
          onSaved={(id) => {
            setSheet(null)
            onPick(id)
          }}
        />
      )}
    </section>
  )
}

/** O aviso de que se está vendo uma versão, com "Editar esta versão" e "Voltar para agora". */
export function VersionBanner({ entity: e, view, onBack }: { entity: Entity; view: VersionView; onBack: () => void }) {
  const { universe, readOnly } = useWorkspace()
  const scenes = manuscriptOrder(universe)
  const [editing, setEditing] = useState(false)
  const p = view.phase
  return (
    <div className={`version-banner${view.planned ? ' is-planned' : ''}`} role="status">
      <p className="small">
        {p ? (
          <>
            Vendo a versão <strong>{p.name || p.nameNow || 'sem nome'}</strong>{' '}
            {view.planned ? (p.when ? `· planejada (${p.when}), só você vê` : '· planejada, só você vê') : `· desde “${sceneTitle(scenes[view.at])}”`}
            {p.cause && <span className="muted"> · {p.cause}</span>}
          </>
        ) : (
          <>
            Vendo <strong>o começo</strong>: como {e.name || 'a ficha'} é antes de qualquer versão.
          </>
        )}
      </p>
      <div className="version-banner-actions">
        {p && !readOnly && (
          <button type="button" className="btn btn-sm" onClick={() => setEditing(true)}>
            <Pencil size={14} aria-hidden="true" /> Editar esta versão
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
          <Undo2 size={14} aria-hidden="true" /> Voltar para agora
        </button>
      </div>
      {editing && p && <VersionSheet entity={e} phase={p} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />}
    </div>
  )
}

/**
 * Criar ou editar uma versão: quando (uma cena ou "ainda sem cena"), o nome da versão e o porquê, e a ficha como
 * fica (nome, resumo, retrato e cada campo), já preenchida com o que vinha antes. Guarda só o que mudou.
 */
export function VersionSheet({ entity: e, phase, onClose, onSaved }: { entity: Entity; phase: Phase | null; onClose: () => void; onSaved: (id: string) => void }) {
  const { universe, update, toast } = useWorkspace()
  const scenes = manuscriptOrder(universe)
  const prev = before(e, phase, scenes)
  const keys = [...new Set([...prev.fields.map((f) => f.key.trim()), ...(phase?.fields ?? []).map((f) => f.key.trim())].filter(Boolean))]
  const valueOf = (k: string) => phase?.fields.find((f) => fold(f.key.trim()) === fold(k))?.value ?? prev.fields.find((f) => fold(f.key.trim()) === fold(k))?.value ?? ''
  const [sceneId, setSceneId] = useState<string>(phase ? (phase.sceneId && scenes.some((s) => s.id === phase.sceneId) ? phase.sceneId : '') : '')
  const [when, setWhen] = useState(phase?.when ?? '')
  const [name, setName] = useState(phase?.name ?? '')
  const [cause, setCause] = useState(phase?.cause ?? '')
  const [nameNow, setNameNow] = useState(phase?.nameNow || prev.name)
  const [summary, setSummary] = useState(phase?.summary || prev.summary)
  const [image, setImage] = useState<string | null>(phase?.image ?? null)
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(keys.map((k) => [k, valueOf(k)])))
  const [extra, setExtra] = useState<{ key: string; value: string }[]>([])
  const picker = useImagePicker('retrato', (ref) => setImage(ref), (m) => toast(m, { tone: 'erro' }))

  const save = () => {
    const prevValue = (k: string) => prev.fields.find((f) => fold(f.key.trim()) === fold(k))?.value ?? ''
    const fields = [
      ...keys.filter((k) => (values[k] ?? '') !== prevValue(k)).map((k) => ({ key: k, value: values[k] ?? '' })),
      ...extra.filter((f) => f.key.trim()).map((f) => ({ key: f.key.trim(), value: f.value })),
    ]
    const next: Phase = {
      id: phase?.id ?? newId(),
      sceneId: sceneId || null,
      when: sceneId ? undefined : when.trim() || undefined,
      name: name.trim(),
      cause: cause.trim(),
      nameNow: nameNow.trim() && nameNow.trim() !== prev.name ? nameNow.trim() : '',
      summary: summary.trim() && summary.trim() !== prev.summary ? summary.trim() : '',
      image,
      fields,
    }
    update((u) => {
      const cur = u.entities.find((x) => x.id === e.id)
      const list = cur?.phases ?? []
      return patch(u, 'entities', e.id, { phases: phase ? list.map((x) => (x.id === phase.id ? next : x)) : [...list, next] })
    })
    onSaved(next.id)
  }

  return (
    <Modal
      title={phase ? `Versão: ${phase.name || phase.nameNow || 'sem nome'}` : `Nova versão de ${e.name || 'esta ficha'}`}
      onClose={onClose}
      size="md"
      footer={
        <>
          {phase && (
            <ConfirmButton
              className="btn btn-ghost"
              question="Tirar esta versão? A ficha volta a ser como era antes dela."
              confirmLabel="Tirar"
              onConfirm={() => {
                update((u) => patch(u, 'entities', e.id, { phases: (u.entities.find((x) => x.id === e.id)?.phases ?? []).filter((x) => x.id !== phase.id) }))
                onClose()
              }}
            >
              <Trash2 size={15} aria-hidden="true" /> Tirar
            </ConfirmButton>
          )}
          <button type="button" className="btn btn-primary" onClick={save}>
            <Check size={15} aria-hidden="true" /> {phase ? 'Guardar' : 'Criar versão'}
          </button>
        </>
      }
    >
      <div className="version-sheet">
        <div className="version-sheet-face">
          {picker.field}
          <button type="button" className="version-portrait" onClick={picker.open} disabled={picker.busy} aria-label={image ? 'Trocar o retrato desta versão' : 'Retrato desta versão'}>
            {image ? <Picture value={image} alt="" /> : prev.image ? <Picture value={prev.image} alt="" className="is-old" /> : <ImagePlus size={22} aria-hidden="true" />}
          </button>
          {image && (
            <button type="button" className="link-btn small" onClick={() => setImage(null)}>
              <X size={12} aria-hidden="true" /> Usar o retrato de antes
            </button>
          )}
          <label className="field version-name-now">
            <span className="field-label">Chamado</span>
            <input className="input" value={nameNow} onChange={(ev) => setNameNow(ev.target.value)} />
          </label>
        </div>
        <div className="phase-row">
          <label className="field">
            <span className="field-label">Nome da versão</span>
            <input className="input" placeholder="General, Depois da queda…" value={name} autoFocus onChange={(ev) => setName(ev.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Por quê</span>
            <input className="input" placeholder="O que aconteceu" value={cause} onChange={(ev) => setCause(ev.target.value)} />
          </label>
        </div>
        <label className="field">
          <span className="field-label">A partir de</span>
          <select className="input select" value={sceneId} onChange={(ev) => setSceneId(ev.target.value)}>
            <option value="">Ainda sem cena (planejada)</option>
            {scenes.map((s, j) => (
              <option key={s.id} value={s.id}>
                {j + 1}. {sceneTitle(s)}
              </option>
            ))}
          </select>
        </label>
        {!sceneId && (
          <label className="field">
            <span className="field-label">Quando</span>
            <input className="input" placeholder="Livro 2, depois da guerra, daqui a 10 anos…" value={when} onChange={(ev) => setWhen(ev.target.value)} />
          </label>
        )}
        <label className="field">
          <span className="field-label">Resumo nesta versão</span>
          <textarea className="input textarea" rows={2} value={summary} onChange={(ev) => setSummary(ev.target.value)} />
        </label>
        <fieldset className="version-fields">
          <legend className="field-label">Como fica (mude só o que muda)</legend>
          {keys.map((k) => {
            const changed = (values[k] ?? '') !== (prev.fields.find((f) => fold(f.key.trim()) === fold(k))?.value ?? '')
            return (
              <label key={k} className={`version-field${changed ? ' is-changed' : ''}`}>
                <span>{k}</span>
                <input className="input input-sm" aria-label={`${k} nesta versão`} value={values[k] ?? ''} onChange={(ev) => setValues((v) => ({ ...v, [k]: ev.target.value }))} />
              </label>
            )
          })}
          {extra.map((f, i) => (
            <div key={i} className="version-field">
              <input className="input input-sm" aria-label="Campo novo" placeholder="Campo" value={f.key} onChange={(ev) => setExtra((x) => x.map((y, j) => (j === i ? { ...y, key: ev.target.value } : y)))} />
              <input className="input input-sm" aria-label={`Valor de ${f.key || 'campo novo'}`} placeholder="Valor" value={f.value} onChange={(ev) => setExtra((x) => x.map((y, j) => (j === i ? { ...y, value: ev.target.value } : y)))} />
            </div>
          ))}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setExtra((x) => [...x, { key: '', value: '' }])}>
            <Plus size={14} aria-hidden="true" /> Campo que só existe nesta versão
          </button>
        </fieldset>
      </div>
    </Modal>
  )
}
