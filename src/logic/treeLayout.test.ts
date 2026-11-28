import { describe, expect, it } from 'vitest'
import type { TreeNode } from './contentTree'
import { layoutHorizontal, linkPath } from './treeLayout'

const n = (name: string, children: TreeNode[] = []): TreeNode => ({ entity: { id: name, name } as TreeNode['entity'], via: null, children })

describe('árvore deitada', () => {
  it('a raiz fica no meio dos filhos, cada folha numa linha e cada nível numa coluna', () => {
    const t = n('Oz', [n('Leste'), n('Oeste'), n('Sul', [n('Glinda'), n('Porcelana')])])
    const l = layoutHorizontal(t, { boxW: 100, boxH: 40, gapX: 20, gapY: 10 })
    const by = (name: string) => l.nodes.find((x) => x.node.entity.name === name)!
    expect([by('Leste').y, by('Oeste').y, by('Glinda').y, by('Porcelana').y]).toEqual([0, 50, 100, 150])
    expect(by('Sul').y).toBe(125)
    expect(by('Oz').y).toBe((by('Leste').y + by('Sul').y) / 2)
    expect([by('Oz').x, by('Leste').x, by('Glinda').x]).toEqual([0, 120, 240])
    expect(l.links).toHaveLength(5)
    expect(l.width).toBe(340)
    expect(l.height).toBe(190)
  })

  it('a curva sai da direita do pai e chega à esquerda do filho', () => {
    const l = layoutHorizontal(n('A', [n('B')]), { boxW: 100, boxH: 40, gapX: 20, gapY: 10 })
    expect(linkPath(l.links[0].from, l.links[0].to, 100, 40)).toBe('M100 20 C110 20, 110 20, 120 20')
  })
})
