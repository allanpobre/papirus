import type { TreeNode } from './contentTree'

export interface LaidNode {
  node: TreeNode
  x: number
  y: number
}
export interface TreeLayout {
  nodes: LaidNode[]
  links: { from: LaidNode; to: LaidNode }[]
  width: number
  height: number
}

/**
 * A árvore deitada (a raiz à esquerda, os galhos para a direita): cada folha ocupa uma linha, e quem tem filhos
 * fica no meio deles. Só calcula posições; quem desenha são os cartões e as curvas.
 */
export function layoutHorizontal(root: TreeNode, { boxW = 150, boxH = 46, gapX = 46, gapY = 14 } = {}): TreeLayout {
  const nodes: LaidNode[] = []
  const links: TreeLayout['links'] = []
  let row = 0
  const place = (n: TreeNode, depth: number): LaidNode => {
    const kids = n.children.map((c) => place(c, depth + 1))
    const y = kids.length ? (kids[0].y + kids[kids.length - 1].y) / 2 : row++ * (boxH + gapY)
    const laid: LaidNode = { node: n, x: depth * (boxW + gapX), y }
    for (const k of kids) links.push({ from: laid, to: k })
    nodes.push(laid)
    return laid
  }
  place(root, 0)
  const maxX = Math.max(...nodes.map((n) => n.x))
  const maxY = Math.max(...nodes.map((n) => n.y))
  return { nodes, links, width: maxX + boxW, height: maxY + boxH }
}

/** A curva que liga a direita de um cartão à esquerda do filho. */
export function linkPath(from: LaidNode, to: LaidNode, boxW = 150, boxH = 46): string {
  const x1 = from.x + boxW
  const y1 = from.y + boxH / 2
  const x2 = to.x
  const y2 = to.y + boxH / 2
  const mid = (x1 + x2) / 2
  return `M${x1} ${y1} C${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`
}
