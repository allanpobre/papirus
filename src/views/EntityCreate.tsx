import { useState } from 'react'
import { byId, draftEntity, insert } from '../model/universe'
import { createFromTemplate, templatesOf } from '../model/entityTemplates'
import { addMembers, listsOf } from '../model/lists'
import { EntityPicker } from '../ui/EntityPicker'
import { useWorkspace } from '../state/workspace'
import { Field, Select } from '../ui/bits'
import { Modal } from '../ui/Modal'
import { NameIdeas } from './NameIdeas'
import { namesFromText, useKindOptions } from './kindOptions'

/** No celular: criar uma ficha sem sair da lista ("Criar e fazer outra") ou abrir a nova. */
export function NewEntityDialog({ initialKind, onClose, onOpen, onMany }: { initialKind: string; onClose: () => void; onOpen: (id: string) => void; onMany: () => void }) {
  const { update, toast } = useWorkspace()
  const options = useKindOptions()
  const [name, setName] = useState('')
  const [kind, setKind] = useState(initialKind)
  const create = (open: boolean) => {
    const n = name.trim()
    if (!n) return
    let id = ''
    update((u) => {
      const [next, e] = insert(u, 'entities', draftEntity(kind, n))
      id = e.id
      return next
    })
    setName('')
    if (open) onOpen(id)
    else toast(`“${n}” criada`)
  }
  return (
    <Modal
      title="Nova ficha"
      size="sm"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" disabled={!name.trim()} onClick={() => create(false)}>
            Criar e fazer outra
          </button>
          <button type="button" className="btn btn-primary" disabled={!name.trim()} onClick={() => create(true)}>
            Criar e abrir
          </button>
        </>
      }
    >
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault()
          create(false)
        }}
      >
        <Field label="Nome" wide>
          {(id) => <input id={id} className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} enterKeyHint="next" />}
        </Field>
        <Field label="Tipo" wide>
          {(id) => <Select id={id} value={kind} onChange={setKind} options={options} />}
        </Field>
      </form>
      <NameIdeas kind={kind} onPick={setName} />
      <button type="button" className="link-btn small" onClick={onMany}>
        Criar várias de uma vez (colar uma lista de nomes)
      </button>
    </Modal>
  )
}

/** Várias fichas de uma vez: um nome por linha. Dá para desfazer. */
export function BulkCreateDialog({ initialKind, onClose, onDone }: { initialKind: string; onClose: () => void; onDone: (kind: string) => void }) {
  const { universe, undoable } = useWorkspace()
  const options = useKindOptions()
  const [text, setText] = useState('')
  const [kind, setKind] = useState(initialKind)
  // Opcional: a partir de um modelo (campos, etiquetas, listas) e já numa lista de outra ficha.
  const templates = templatesOf(universe)
  const [templateId, setTemplateId] = useState('')
  const template = templates.find((t) => t.id === templateId)
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const owner = ownerId ? byId(universe, 'entities', ownerId) : undefined
  const ownerLists = listsOf(owner)
  const [listId, setListId] = useState('')
  const list = ownerLists.find((l) => l.id === listId) ?? (ownerLists.length === 1 ? ownerLists[0] : undefined)
  const names = namesFromText(text)
  const existing = new Set(universe.entities.map((e) => e.name.trim().toLocaleLowerCase('pt-BR')))
  const repeated = names.filter((n) => existing.has(n.toLocaleLowerCase('pt-BR')))
  const run = () => {
    if (!names.length) return
    undoable(names.length === 1 ? '1 ficha criada' : `${names.length} fichas criadas`, (u) => {
      const ids: string[] = []
      let next = u
      for (const n of names) {
        const [after, e] = template ? createFromTemplate(next, template, n) : insert(next, 'entities', draftEntity(kind, n))
        ids.push(e.id)
        next = after
      }
      return owner && list ? addMembers(next, owner.id, list.id, ids) : next
    })
    onDone(template?.kind ?? kind)
  }
  return (
    <Modal
      title="Criar várias fichas"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" disabled={!names.length} onClick={run}>
            {names.length ? `Criar ${names.length}` : 'Criar'}
          </button>
        </>
      }
    >
      <Field label="Um nome por linha" wide hint="Dá para colar uma lista de outro lugar. Linhas repetidas entram uma vez só.">
        {(id) => <textarea id={id} className="input textarea bulk-names" rows={8} autoFocus placeholder={'Doran\nSelma\nOrin'} value={text} onChange={(e) => setText(e.target.value)} />}
      </Field>
      <NameIdeas kind={kind} culture={ownerId} onPick={(n) => setText((t) => (t.trim() ? `${t.replace(/\s+$/, '')}\n${n}` : n))} />
      {templates.length > 0 && (
        <Field label="A partir do modelo (opcional)">
          {(id) => <Select id={id} value={templateId} onChange={setTemplateId} options={[{ value: '', label: 'Nenhum: só o nome' }, ...templates.map((t) => ({ value: t.id, label: t.name }))]} />}
        </Field>
      )}
      {!template && <Field label="Tipo">{(id) => <Select id={id} value={kind} onChange={setKind} options={options} />}</Field>}
      <EntityPicker label="Pôr na lista de (opcional)" value={ownerId} onChange={setOwnerId} placeholder="Clã do Corvo, Reino de Ostria…" allowCreate={false} />
      {owner && ownerLists.length > 1 && (
        <Field label="Qual lista">
          {(id) => <Select id={id} value={list?.id ?? ''} onChange={setListId} options={[{ value: '', label: 'Escolha…' }, ...ownerLists.map((l) => ({ value: l.id, label: l.name }))]} />}
        </Field>
      )}
      {owner && ownerLists.length === 0 && <p className="muted small">{owner.name} ainda não tem listas: crie uma na ficha dela (“+ Lista”).</p>}
      {repeated.length > 0 && (
        <p className="muted small">
          Já existe uma ficha com {repeated.length === 1 ? 'o nome' : 'os nomes'}{' '}
          {repeated
            .slice(0, 5)
            .map((n) => `“${n}”`)
            .join(', ')}
          {repeated.length > 5 ? '…' : ''}. Vai ficar com duas.
        </p>
      )}
    </Modal>
  )
}
