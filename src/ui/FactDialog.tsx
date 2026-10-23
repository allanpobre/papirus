import { useState } from 'react'
import type { Fact } from '../model/schema'
import { draftFact, insert, patch } from '../model/universe'
import { useWorkspace } from '../state/workspace'
import { CanonSelect, EditorialSelect, Field } from './bits'
import { EntityPicker } from './EntityPicker'
import { Modal } from './Modal'

export type FactDraft = Omit<Fact, 'id' | 'createdAt' | 'updatedAt'>

/** Diálogo para registrar ou editar um fato (sujeito · relação · valor). */
export function FactDialog({
  initial,
  factId,
  onClose,
  title = 'Registrar fato',
}: {
  initial: Partial<FactDraft>
  factId?: string
  onClose: () => void
  title?: string
}) {
  const { update, toast } = useWorkspace()
  const [f, setF] = useState<FactDraft>(() => draftFact(initial))
  const [valueMode, setValueMode] = useState<'texto' | 'ficha'>(initial.objectId ? 'ficha' : 'texto')
  const set = <K extends keyof FactDraft>(k: K, v: FactDraft[K]) => setF((x) => ({ ...x, [k]: v }))

  const save = () => {
    const clean = valueMode === 'ficha' ? { ...f, value: '' } : { ...f, objectId: null }
    if (factId) update((u) => patch(u, 'facts', factId, clean))
    else update((u) => insert(u, 'facts', clean)[0])
    toast(factId ? 'Fato atualizado' : 'Fato registrado')
    onClose()
  }

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={save}>
            {factId ? 'Salvar' : 'Registrar'}
          </button>
        </>
      }
    >
      {f.quote && (
        <blockquote className="quote">
          “{f.quote}”
        </blockquote>
      )}
      <div className="form-grid">
        <EntityPicker label="Sujeito" value={f.subjectId} onChange={(v) => set('subjectId', v)} />
        <Field label="Relação">
          {(id) => (
            <input
              id={id}
              className="input"
              list="predicados"
              placeholder="nasceu em, é irmã de, teme…"
              value={f.predicate}
              onChange={(e) => set('predicate', e.target.value)}
            />
          )}
        </Field>
        <div className="field field-wide">
          <span className="field-label">Valor</span>
          <div className="segmented" role="radiogroup" aria-label="Tipo de valor">
            <button type="button" role="radio" aria-checked={valueMode === 'texto'} onClick={() => setValueMode('texto')}>
              Texto
            </button>
            <button type="button" role="radio" aria-checked={valueMode === 'ficha'} onClick={() => setValueMode('ficha')}>
              Ficha
            </button>
          </div>
          {valueMode === 'texto' ? (
            <input
              aria-label="Valor em texto"
              className="input"
              placeholder="Ex.: 340, olhos cinzentos, nunca saiu da ilha"
              value={f.value}
              onChange={(e) => set('value', e.target.value)}
            />
          ) : (
            <EntityPicker label="Valor (ficha)" hideLabel value={f.objectId} onChange={(v) => set('objectId', v)} />
          )}
        </div>
        <EntityPicker
          label="Quem afirma"
          placeholder="Narrador (deixe vazio)"
          value={f.speakerId}
          onChange={(v) => set('speakerId', v)}
        />
        <Field label="Canon" hint="Natureza no universo">
          {(id) => <CanonSelect id={id} value={f.canon} onChange={(v) => set('canon', v)} />}
        </Field>
        <Field label="Estado editorial">
          {(id) => <EditorialSelect id={id} value={f.editorial} onChange={(v) => set('editorial', v)} />}
        </Field>
        <Field label="Nota" wide>
          {(id) => (
            <textarea id={id} className="input textarea" rows={2} value={f.note} onChange={(e) => set('note', e.target.value)} />
          )}
        </Field>
      </div>
      <datalist id="predicados">
        {['nasceu em', 'morreu em', 'é filho de', 'é filha de', 'é irmão de', 'é irmã de', 'serve a', 'governa', 'teme', 'ama', 'odeia', 'possui', 'vive em', 'sabe que', 'acredita que', 'tem olhos', 'é membro de'].map(
          (p) => (
            <option key={p} value={p} />
          ),
        )}
      </datalist>
    </Modal>
  )
}
