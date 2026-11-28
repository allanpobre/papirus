import { GitBranch } from 'lucide-react'
import { useState } from 'react'
import { contentTree, hasBranches, treeSize, type TreeNode } from '../logic/contentTree'
import { PLACE_KINDS } from '../model/lists'
import type { Entity } from '../model/schema'
import { useWorkspace } from '../state/workspace'
import { TreeDialog } from './TreeDialog'

/** Tipos em que dividir em galhos costuma fazer sentido (o convite só aparece neles). */
const BRANCHY = ['especie', 'faccao', 'religiao', 'cultura', 'magia', 'reino', 'lugar', 'conceito']

const Mini = ({ n, open }: { n: TreeNode; open: (id: string) => void }) => (
  <li>
    <button type="button" className="tree-mini-link" onClick={() => open(n.entity.id)}>
      {n.entity.name}
    </button>
    {n.children.length > 0 && <ul>{n.children.map((c) => <Mini key={c.entity.id} n={c} open={open} />)}</ul>}
  </li>
)

/**
 * Na leitura da ficha: os galhos dela em lista recuada (um toque abre a ficha) e o botão "Ver como árvore".
 * Sem galhos, num tipo que costuma ter, um convite para dividir em tipos. Como leitor, só o que já se pode saber.
 */
export function TreeSection({ entity, reader }: { entity: Entity; reader: boolean }) {
  const { universe, go, readOnly } = useWorkspace()
  const [open, setOpen] = useState(false)
  const has = hasBranches(universe, entity.id, { hideSecrets: reader })
  const invite = !has && !reader && !readOnly && (BRANCHY.includes(entity.kind) || PLACE_KINDS.includes(entity.kind))
  if (!has && !invite) return null
  const tree = has ? contentTree(universe, entity.id, { hideSecrets: reader }) : null
  return (
    <section className="tree-section" aria-label="Árvore">
      <h2>Árvore</h2>
      {tree && (
        <>
          <ul className="tree-mini">{tree.children.map((c) => <Mini key={c.entity.id} n={c} open={(id) => go('fichas', id)} />)}</ul>
          <p className="muted small">{treeSize(tree)} {treeSize(tree) === 1 ? 'galho' : 'galhos'}.</p>
        </>
      )}
      {!reader && (
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>
          <GitBranch size={15} aria-hidden="true" /> {has ? 'Ver e editar como árvore' : `Dividir ${entity.name || 'esta ficha'} em tipos`}
        </button>
      )}
      {open && <TreeDialog rootId={entity.id} onClose={() => setOpen(false)} />}
    </section>
  )
}
