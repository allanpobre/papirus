import { fold } from './text'
import { addList, addMembers, listsOf, membersOf, PLACE_KINDS } from '../model/lists'
import type { Entity, Universe } from '../model/schema'
import { byId, insert, draftEntity, patch, remove } from '../model/universe'

/**
 * A árvore de uma ficha ("Dragões" → "Cromáticos" → "Dragão Vermelho"). Não guarda nada novo: sai do
 * "fica dentro de" (lugares e reinos) e das listas da ficha (Subespécies, Membros…), e escrever nela
 * mexe nesses mesmos dados — então a ficha, a wiki e a Mesa continuam iguais.
 */
export type TreeVia = { kind: 'dentro' } | { kind: 'lista'; relationId: string; listId: string }
export interface TreeNode {
  entity: Entity
  /** Como esta ficha está presa à de cima (null na raiz). */
  via: TreeVia | null
  children: TreeNode[]
}

interface Opts {
  /** Mostrar também fichas de outros tipos (as pessoas de uma lista de Membros, por exemplo). */
  everyone?: boolean
  /** Sem os segredos (leitor, wiki). */
  hideSecrets?: boolean
  maxDepth?: number
}

const isPlace = (e: Entity) => PLACE_KINDS.includes(e.kind)

/** Os filhos diretos de uma ficha. Por padrão só os do mesmo tipo: a árvore de uma espécie mostra espécies. */
export function treeChildren(u: Universe, parent: Entity, { everyone = false, hideSecrets = false }: Opts = {}): { entity: Entity; via: TreeVia }[] {
  const out: { entity: Entity; via: TreeVia }[] = []
  const seen = new Set<string>()
  const take = (e: Entity, via: TreeVia) => {
    if (seen.has(e.id) || e.id === parent.id) return
    if (hideSecrets && e.canon === 'secreto') return
    // Nas listas, só o mesmo tipo (a árvore de uma espécie mostra espécies); o "fica dentro de" já é só de lugares.
    if (!everyone && via.kind === 'lista' && e.kind !== parent.kind) return
    seen.add(e.id)
    out.push({ entity: e, via })
  }
  for (const e of u.entities) if (e.parentId === parent.id && isPlace(parent) === isPlace(e)) take(e, { kind: 'dentro' })
  for (const list of listsOf(parent))
    for (const { relation, member } of membersOf(u, parent.id, list.id)) {
      const gone = relation.scope.kind === 'periodo' && relation.scope.toYear !== null
      if (!gone) take(member, { kind: 'lista', relationId: relation.id, listId: list.id })
    }
  return out.sort((a, b) => a.entity.name.localeCompare(b.entity.name, 'pt-BR'))
}

/** A árvore inteira a partir de uma ficha (sem voltar para quem já está no caminho). */
export function contentTree(u: Universe, rootId: string, opts: Opts = {}): TreeNode | null {
  const root = byId(u, 'entities', rootId)
  if (!root || (opts.hideSecrets && root.canon === 'secreto')) return null
  const max = opts.maxDepth ?? 8
  const grow = (entity: Entity, via: TreeVia | null, path: Set<string>, depth: number): TreeNode => ({
    entity,
    via,
    children:
      depth >= max
        ? []
        : treeChildren(u, entity, opts)
            .filter((c) => !path.has(c.entity.id))
            .map((c) => grow(c.entity, c.via, new Set([...path, c.entity.id]), depth + 1)),
  })
  return grow(root, null, new Set([root.id]), 0)
}

/** Quantas fichas há na árvore, sem contar a raiz. */
export function treeSize(n: TreeNode): number {
  return n.children.reduce((s, c) => s + 1 + treeSize(c), 0)
}

/** Esta ficha já tem galhos? (para o bloco "Árvore" na leitura) */
export const hasBranches = (u: Universe, id: string, opts: Opts = {}) => {
  const e = byId(u, 'entities', id)
  return Boolean(e && treeChildren(u, e, opts).length)
}

const defaultListName = (parent: Entity) => (parent.kind === 'especie' ? 'Subespécies' : isPlace(parent) ? 'Habitantes' : 'Membros')

/** Prende `child` em `parent`: "fica dentro de" entre lugares; nos outros, na lista da ficha de cima. */
export function attach(u: Universe, parentId: string, childId: string): Universe {
  const parent = byId(u, 'entities', parentId)
  const child = byId(u, 'entities', childId)
  if (!parent || !child || parentId === childId) return u
  if (isPlace(parent) && isPlace(child)) return patch(u, 'entities', childId, { parentId })
  let next = u
  const wanted = fold(defaultListName(parent))
  const lists = listsOf(parent)
  // A lista certa: a que tem o nome esperado; senão a primeira; senão uma nova.
  let list = lists.find((l) => fold(l.name) === wanted) ?? lists[0]
  if (!list) [next, list] = addList(next, parentId, defaultListName(parent), [])
  return addMembers(next, parentId, list.id, [childId])
}

/** Solta `child` do jeito que estava preso. */
export function detach(u: Universe, childId: string, via: TreeVia | null): Universe {
  if (!via) return u
  return via.kind === 'dentro' ? patch(u, 'entities', childId, { parentId: null }) : remove(u, 'relations', via.relationId)
}

/** Uma ficha nova, do mesmo tipo da de cima, já presa nela. */
export function addBranch(u: Universe, parentId: string, name: string): [Universe, Entity | null] {
  const parent = byId(u, 'entities', parentId)
  const n = name.trim()
  if (!parent || !n) return [u, null]
  const [withEntity, e] = insert(u, 'entities', { ...draftEntity(parent.kind, n), ...(parent.books ? { books: parent.books } : {}) })
  return [attach(withEntity, parentId, e.id), e]
}

/** Esta ficha aparece na árvore de `ancestorId`? (para não pôr um galho dentro dele mesmo) */
export function isBelow(u: Universe, ancestorId: string, id: string): boolean {
  const t = contentTree(u, ancestorId, { everyone: true })
  const walk = (n: TreeNode): boolean => n.entity.id === id || n.children.some(walk)
  return t ? t.children.some(walk) : false
}

/** Muda um galho de lugar. Recusa pôr a ficha dentro do que já está debaixo dela. */
export function moveBranch(u: Universe, childId: string, via: TreeVia | null, newParentId: string): Universe {
  if (childId === newParentId || isBelow(u, childId, newParentId)) return u
  return attach(detach(u, childId, via), newParentId, childId)
}
