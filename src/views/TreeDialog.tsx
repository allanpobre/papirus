import { ArrowRightLeft, ExternalLink, Plus, Unlink } from 'lucide-react'
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { addBranch, contentTree, detach, moveBranch, treeSize, type TreeNode } from '../logic/contentTree'
import { kindLabel } from '../model/labels'
import { byId } from '../model/universe'
import { EntityPicker } from '../ui/EntityPicker'
import { kindVar } from '../ui/KindPortrait'
import { Modal } from '../ui/Modal'
import { useWorkspace } from '../state/workspace'

/**
 * A árvore de uma ficha, para criar e editar direto no desenho: "+" põe um galho novo (uma ficha do mesmo tipo),
 * “Mover” troca de galho, “Tirar” solta (a ficha continua existindo). Por baixo são as listas e o "fica dentro de".
 */
// A janela sai do desenho da lista (que prende o que está dentro) e vai para o corpo da página: sem ficar sob as partes do Mundo.
export function TreeDialog(props: Parameters<typeof TreeDialogInner>[0]) {
  return createPortal(<TreeDialogInner {...props} />, document.body)
}

function TreeDialogInner({ rootId, onClose, onPickRoot }: { rootId: string | null; onClose: () => void; onPickRoot?: (id: string) => void }) {
  const { universe, update, go, readOnly } = useWorkspace()
  const [everyone, setEveryone] = useState(false)
  const root = rootId ? byId(universe, 'entities', rootId) : undefined
  const tree = useMemo(() => (rootId ? contentTree(universe, rootId, { everyone }) : null), [universe, rootId, everyone])
  const [adding, setAdding] = useState<string | null>(null)
  const [moving, setMoving] = useState<string | null>(null)
  const [name, setName] = useState('')

  if (!root || !tree)
    return (
      <Modal title="Criar uma árvore" size="sm" onClose={onClose} about="Uma árvore mostra o que está dentro de quê: tipos de dragão, ordens de uma facção, cidades de um reino. Escolha a ficha de cima; os galhos vêm dela.">
        <p className="muted">Qual ficha fica no alto? Por exemplo “Dragões”, “A Guilda” ou “Reino de Ostria”. Se ela não existir, escreva o nome e crie.</p>
        <EntityPicker label="Ficha do alto da árvore" value={null} onChange={(id) => id && onPickRoot?.(id)} placeholder="Dragões, A Guilda…" autoFocus />
      </Modal>
    )

  const add = (parentId: string) => {
    const n = name.trim()
    if (!n) return
    update((u) => addBranch(u, parentId, n)[0])
    setName('')
  }
  const total = treeSize(tree)
  // Quem está debaixo de um galho não pode receber ele (viraria um laço): fica fora da escolha.
  const below = (id: string): string[] => {
    const sub = contentTree(universe, id, { everyone: true })
    const out: string[] = []
    const walk = (x: TreeNode) => x.children.forEach((c) => (out.push(c.entity.id), walk(c)))
    if (sub) walk(sub)
    return out
  }

  const node = (n: TreeNode, top = false): React.ReactNode => (
    <li key={n.entity.id}>
      <div className={`ftree-node${top ? ' is-root' : ''}`} style={{ '--k': kindVar(n.entity.kind) } as React.CSSProperties} title={n.entity.summary || undefined}>
        <button type="button" className="ftree-name" onClick={() => (onClose(), go('fichas', n.entity.id))} aria-label={`Abrir a ficha ${n.entity.name}`}>
          <b>{n.entity.name}</b>
          <small>{n.entity.summary.trim() || kindLabel(n.entity.kind)}</small>
        </button>
        {!readOnly && (
          <span className="ftree-tools">
            <button type="button" className="ftree-btn" aria-label={`Novo galho em ${n.entity.name}`} title="Novo galho" onClick={() => (setAdding(adding === n.entity.id ? null : n.entity.id), setMoving(null), setName(''))}>
              <Plus size={14} aria-hidden="true" />
            </button>
            {!top && n.via && (
              <>
                <button type="button" className="ftree-btn" aria-label={`Mover ${n.entity.name}`} title="Mover para outro galho" onClick={() => (setMoving(moving === n.entity.id ? null : n.entity.id), setAdding(null))}>
                  <ArrowRightLeft size={14} aria-hidden="true" />
                </button>
                <button type="button" className="ftree-btn" aria-label={`Tirar ${n.entity.name} da árvore`} title="Tirar da árvore (a ficha continua)" onClick={() => update((u) => detach(u, n.entity.id, n.via))}>
                  <Unlink size={14} aria-hidden="true" />
                </button>
              </>
            )}
            <button type="button" className="ftree-btn" aria-label={`Abrir ${n.entity.name}`} title="Abrir a ficha" onClick={() => (onClose(), go('fichas', n.entity.id))}>
              <ExternalLink size={14} aria-hidden="true" />
            </button>
          </span>
        )}
      </div>
      {adding === n.entity.id && (
        <form
          className="ftree-add"
          onSubmit={(e) => {
            e.preventDefault()
            add(n.entity.id)
          }}
        >
          <input className="input" autoFocus aria-label={`Nome do novo galho em ${n.entity.name}`} placeholder={`Um tipo de ${n.entity.name}…`} value={name} onChange={(e) => setName(e.target.value)} />
          <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
            Criar
          </button>
        </form>
      )}
      {moving === n.entity.id && (
        <div className="ftree-add">
          <EntityPicker
            label={`Mover ${n.entity.name} para dentro de`}
            value={null}
            allowCreate={false}
            autoFocus
            exclude={[n.entity.id, ...below(n.entity.id)]}
            onChange={(to) => {
              if (to) update((u) => moveBranch(u, n.entity.id, n.via, to))
              setMoving(null)
            }}
          />
        </div>
      )}
      {n.children.length > 0 && <ul>{n.children.map((c) => node(c))}</ul>}
    </li>
  )

  return (
    <Modal
      title={`Árvore: ${root.name}`}
      size="lg"
      onClose={onClose}
      about="Cada galho é uma ficha. + cria um galho novo; Mover troca de lugar; Tirar solta o galho (a ficha continua). Por baixo, usa as listas e o “fica dentro de” da ficha: nada fica duplicado."
      footer={
        <label className="check">
          <input type="checkbox" checked={everyone} onChange={(e) => setEveryone(e.target.checked)} /> Mostrar também pessoas e outros tipos
        </label>
      }
    >
      <p className="muted small">{total ? `${total} ${total === 1 ? 'galho' : 'galhos'} abaixo de ${root.name}.` : `Ainda sem galhos. Toque no + de ${root.name} para dividir em tipos.`}</p>
      <div className="ftree-wrap">
        <ul className="ftree">{node(tree, true)}</ul>
      </div>
    </Modal>
  )
}
