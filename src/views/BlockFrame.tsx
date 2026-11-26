import { ArrowDown, ArrowUp, Check, EyeOff, Pencil, Plus } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { BLOCK_LABEL, CONTENT_BLOCKS, addBlock, hiddenBlocks, type Block, type BlockType } from '../model/blocks'
import type { Entity } from '../model/schema'
import { patch } from '../model/universe'
import { useWorkspace } from '../state/workspace'

/**
 * Um bloco da página da ficha, como no Notion: o que ele mostra e, para o autor, editar ali mesmo, subir,
 * descer e tirar da página. Tirar um bloco de dados não apaga nada (os dados continuam na ficha).
 */
export function BlockFrame({
  block,
  label,
  editor,
  tools,
  arrange = false,
  first = false,
  last = false,
  editing,
  onEditing,
  onMove,
  onRemove,
  children,
}: {
  block: Block
  label: string
  /** O editor do bloco (sem ele, o bloco só se mostra). */
  editor?: ReactNode
  /** Mostra o lápis (o autor, fora de "ver como o leitor"). */
  tools: boolean
  /** "Arrumar a página": mostra subir, descer e tirar. */
  arrange?: boolean
  first?: boolean
  last?: boolean
  editing: boolean
  onEditing: (on: boolean) => void
  onMove?: (step: -1 | 1) => void
  onRemove?: () => void
  children: ReactNode
}) {
  return (
    <div className={`block block-${block.type}${editing ? ' is-editing' : ''}${arrange ? ' is-arranging' : ''}`} data-block={block.type}>
      {tools && (
        <div className="block-tools">
          {editor && !editing && (
            <button type="button" className="btn btn-ghost btn-sm block-edit" aria-label={`Editar: ${label}`} title={`Editar ${label.toLowerCase()} aqui`} onClick={() => onEditing(true)}>
              <Pencil size={14} aria-hidden="true" /> Editar
            </button>
          )}
          {arrange && onMove && !editing && (
            <>
              <button type="button" className="btn-icon btn-sm" aria-label={`Subir: ${label}`} title="Subir" disabled={first} onClick={() => onMove(-1)}>
                <ArrowUp size={14} />
              </button>
              <button type="button" className="btn-icon btn-sm" aria-label={`Descer: ${label}`} title="Descer" disabled={last} onClick={() => onMove(1)}>
                <ArrowDown size={14} />
              </button>
            </>
          )}
          {arrange && onRemove && !editing && (
            <button type="button" className="btn-icon btn-sm" aria-label={`Tirar da página: ${label}`} title="Tirar da página (os dados continuam na ficha)" onClick={onRemove}>
              <EyeOff size={14} />
            </button>
          )}
        </div>
      )}
      {editing && editor ? (
        <div className="block-editor" role="group" aria-label={`Editando: ${label}`}>
          <p className="block-editor-head small">
            <strong>{label}</strong>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onEditing(false)}>
              <Check size={14} aria-hidden="true" /> Pronto
            </button>
          </p>
          {editor}
        </div>
      ) : (
        children
      )}
    </div>
  )
}

/** "+ bloco": os blocos de conteúdo (nota, citação, galeria), os que foram tirados e os que ainda estão vazios. */
export function AddBlock({ entity, empty, onOpen }: { entity: Entity; empty: BlockType[]; onOpen: (type: BlockType, id?: string) => void }) {
  const { update } = useWorkspace()
  const [open, setOpen] = useState(false)
  const hidden = hiddenBlocks(entity).map((b) => b.type as BlockType)
  const save = (blocks: Block[]) => update((u) => patch(u, 'entities', entity.id, { blocks }))
  const pick = (type: BlockType) => {
    setOpen(false)
    if ((CONTENT_BLOCKS as readonly string[]).includes(type)) {
      const next = addBlock(entity, type)
      save(next)
      onOpen(type, next.at(-1)!.id)
      return
    }
    if (hidden.includes(type)) save(addBlock(entity, type))
    onOpen(type)
  }
  return (
    <div className="add-block">
      <button type="button" className="btn btn-ghost btn-sm" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Plus size={15} aria-hidden="true" /> Bloco
      </button>
      {open && (
        <div className="add-block-menu" role="group" aria-label="Acrescentar bloco">
          <p className="tiny muted">Novo</p>
          <div className="chips">
            {CONTENT_BLOCKS.map((t) => (
              <button key={t} type="button" className="chip" onClick={() => pick(t)}>
                {BLOCK_LABEL[t]}
              </button>
            ))}
          </div>
          {(empty.length > 0 || hidden.length > 0) && (
            <>
              <p className="tiny muted">Da ficha (ainda vazios ou tirados da página)</p>
              <div className="chips">
                {[...new Set([...hidden, ...empty])].map((t) => (
                  <button key={t} type="button" className="chip" onClick={() => pick(t)}>
                    {BLOCK_LABEL[t]}
                    {hidden.includes(t) ? ' (tirado)' : ''}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
