import { Tag, Trash2, Users, X } from 'lucide-react'
import { useState } from 'react'
import { addTagToMany, setKindOfMany } from '../model/lists'
import { removeEntity } from '../model/universe'
import { useWorkspace } from '../state/workspace'
import { Field, Select } from '../ui/bits'
import { ConfirmButton } from '../ui/ConfirmButton'
import { Modal } from '../ui/Modal'
import { PutInListDialog } from './EntityLists'
import { useKindOptions } from './kindOptions'

/** A barra de baixo quando há fichas marcadas no Mundo: o que fazer com todas de uma vez. */
export function SelectionBar({ ids, onClear }: { ids: string[]; onClear: () => void }) {
  const { undoable } = useWorkspace()
  const [open, setOpen] = useState<null | 'lista' | 'etiqueta' | 'tipo'>(null)
  const n = ids.length
  return (
    <div className="selection-bar" role="toolbar" aria-label="Fichas marcadas">
      <strong className="selection-count">{n === 1 ? '1 marcada' : `${n} marcadas`}</strong>
      <button type="button" className="btn btn-primary btn-sm" disabled={!n} onClick={() => setOpen('lista')}>
        <Users size={14} /> Pôr numa lista…
      </button>
      <button type="button" className="btn btn-sm" disabled={!n} onClick={() => setOpen('etiqueta')}>
        <Tag size={14} /> Etiqueta
      </button>
      <button type="button" className="btn btn-sm" disabled={!n} onClick={() => setOpen('tipo')}>
        Tipo
      </button>
      <ConfirmButton
        className="btn btn-sm btn-ghost selection-danger"
        question={`Apagar ${n === 1 ? 'a ficha marcada' : `as ${n} fichas marcadas`}? Cenas e fatos ficam, sem o vínculo.`}
        confirmLabel={n === 1 ? 'Apagar 1' : `Apagar ${n}`}
        onConfirm={() => {
          undoable(n === 1 ? '1 ficha apagada' : `${n} fichas apagadas`, (u) => ids.reduce((acc, id) => removeEntity(acc, id), u))
          onClear()
        }}
      >
        <Trash2 size={14} /> Apagar
      </ConfirmButton>
      <button type="button" className="btn-icon btn-sm selection-close" aria-label="Parar de selecionar" onClick={onClear}>
        <X size={16} />
      </button>
      {open === 'lista' && <PutInListDialog ids={ids} onClose={() => setOpen(null)} onDone={() => (setOpen(null), onClear())} />}
      {open === 'etiqueta' && (
        <TagDialog
          n={n}
          onClose={() => setOpen(null)}
          onDone={(tag) => {
            undoable(`Etiqueta “${tag}” em ${n === 1 ? '1 ficha' : `${n} fichas`}`, (u) => addTagToMany(u, ids, tag))
            setOpen(null)
            onClear()
          }}
        />
      )}
      {open === 'tipo' && (
        <KindDialog
          n={n}
          onClose={() => setOpen(null)}
          onDone={(kind) => {
            undoable(`Tipo mudado em ${n === 1 ? '1 ficha' : `${n} fichas`}`, (u) => setKindOfMany(u, ids, kind))
            setOpen(null)
            onClear()
          }}
        />
      )}
    </div>
  )
}

function TagDialog({ n, onClose, onDone }: { n: number; onClose: () => void; onDone: (tag: string) => void }) {
  const [tag, setTag] = useState('')
  return (
    <Modal
      title={`Etiqueta em ${n === 1 ? '1 ficha' : `${n} fichas`}`}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" disabled={!tag.trim()} onClick={() => onDone(tag.trim())}>
            Pôr a etiqueta
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (tag.trim()) onDone(tag.trim())
        }}
      >
        <Field label="Etiqueta">{(id) => <input id={id} className="input" autoFocus placeholder="porto, nobreza…" value={tag} onChange={(e) => setTag(e.target.value)} />}</Field>
      </form>
    </Modal>
  )
}

function KindDialog({ n, onClose, onDone }: { n: number; onClose: () => void; onDone: (kind: string) => void }) {
  const options = useKindOptions()
  const [kind, setKind] = useState(options[0].value)
  return (
    <Modal
      title={`Tipo de ${n === 1 ? '1 ficha' : `${n} fichas`}`}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onDone(kind)}>
            Mudar o tipo
          </button>
        </>
      }
    >
      <Field label="Novo tipo">{(id) => <Select id={id} value={kind} onChange={setKind} options={options} />}</Field>
    </Modal>
  )
}
