import { describe, expect, it } from 'vitest'
import { crossedLabels, forceLayout, placeLabels, separate, settleLabels, type Point, type SeparateBox } from './graph'

const box = (pos: Map<string, Point>) => {
  const xs = [...pos.values()].map((p) => p.x)
  const ys = [...pos.values()].map((p) => p.y)
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
}

const ring = (n: number) => ({
  nodes: Array.from({ length: n }, (_, i) => ({ id: `n${i}` })),
  edges: Array.from({ length: n }, (_, i) => ({ from: `n${i}`, to: `n${(i + 1) % n}` })),
})

describe('desenho do grafo', () => {
  it('cabe na área, com a margem pedida, numa tela larga e num celular em pé', () => {
    const { nodes, edges } = ring(12)
    for (const [width, height, margin] of [
      [1600, 700, 80],
      [360, 520, 48],
    ]) {
      const b = box(forceLayout(nodes, edges, { width, height, margin, stretch: 1.7 }))
      expect(b.minX).toBeGreaterThanOrEqual(margin - 0.5)
      expect(b.maxX).toBeLessThanOrEqual(width - margin + 0.5)
      expect(b.minY).toBeGreaterThanOrEqual(margin - 0.5)
      expect(b.maxY).toBeLessThanOrEqual(height - margin + 0.5)
    }
  })

  it('com "stretch", ocupa mais da tela larga do que a bola do meio', () => {
    const { nodes, edges } = ring(12)
    const plain = box(forceLayout(nodes, edges, { width: 1600, height: 700 }))
    const wide = box(forceLayout(nodes, edges, { width: 1600, height: 700, stretch: 1.7 }))
    expect(wide.w).toBeGreaterThan(plain.w * 1.3)
    expect(wide.h).toBeCloseTo(plain.h, 0)
    // O mesmo grafo dá o mesmo desenho.
    expect(forceLayout(nodes, edges, { width: 1600, height: 700, stretch: 1.7 })).toEqual(forceLayout(nodes, edges, { width: 1600, height: 700, stretch: 1.7 }))
  })
})

describe('lugar dos nomes', () => {
  const node = (id: string, width = 60) => ({ id, width, height: 16, r: 12 })

  it('sozinho, o nome fica embaixo da bolinha', () => {
    const spot = placeLabels([node('a')], new Map([['a', { x: 100, y: 100 }]])).get('a')!
    expect(spot.anchor).toBe('middle')
    expect(spot.dx).toBe(0)
    expect(spot.dy).toBeGreaterThan(12)
  })

  it('com outra bolinha logo abaixo, o nome sobe', () => {
    const pos = new Map([
      ['a', { x: 100, y: 100 }],
      ['b', { x: 100, y: 130 }],
    ])
    const spots = placeLabels([node('a'), node('b')], pos)
    expect(spots.get('a')!.dy).toBeLessThan(0)
    // O de baixo fica embaixo, livre.
    expect(spots.get('b')!.dy).toBeGreaterThan(0)
  })

  it('dois nomes vizinhos não ficam um sobre o outro', () => {
    const pos = new Map([
      ['a', { x: 100, y: 100 }],
      ['b', { x: 140, y: 100 }],
    ])
    const spots = placeLabels([node('a', 80), node('b', 80)], pos)
    const rect = (id: string) => {
      const p = pos.get(id)!
      const s = spots.get(id)!
      const x = s.anchor === 'middle' ? p.x + s.dx - 40 : s.anchor === 'start' ? p.x + s.dx : p.x + s.dx - 80
      const y = p.y + s.dy - 16 * 0.8
      return { x, y, w: 80, h: 16 }
    }
    const [a, b] = [rect('a'), rect('b')]
    const cross = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
    expect(cross).toBe(0)
  })

  it('na borda de baixo, o nome não sai da área', () => {
    const spot = placeLabels([node('a')], new Map([['a', { x: 100, y: 190 }]]), { width: 300, height: 200 }).get('a')!
    expect(spot.dy).toBeLessThan(0)
  })
})

describe('afastar as fichas', () => {
  const box: SeparateBox = { w: 90, h: 40, top: -12 }
  const touching = (pos: Map<string, Point>, gap: number) => {
    const list = [...pos.values()]
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++)
        if (Math.abs(list[i].x - list[j].x) < box.w + gap - 0.01 && Math.abs(list[i].y - list[j].y) < box.h + gap - 0.01) return true
    return false
  }

  it('depois de afastar, nenhuma caixa encosta em outra, mesmo com tudo amontoado', () => {
    const pos = new Map<string, Point>()
    for (let i = 0; i < 60; i++) pos.set(`n${i}`, { x: 200 + (i % 7) * 9, y: 200 + Math.floor(i / 7) * 5 })
    // Duas no mesmo lugar exato também se separam.
    pos.set('igual', { x: 200, y: 200 })
    const boxes = new Map([...pos.keys()].map((id) => [id, box]))
    expect(touching(pos, 6)).toBe(true)
    const out = separate(pos, boxes, { gap: 6 })
    expect(touching(out, 6)).toBe(false)
    // Determinístico: sai sempre igual.
    expect([...separate(pos, boxes, { gap: 6 })]).toEqual([...out])
  })

  it('quem já está longe não se mexe', () => {
    const pos = new Map<string, Point>([
      ['a', { x: 0, y: 0 }],
      ['b', { x: 500, y: 0 }],
    ])
    const out = separate(pos, new Map([['a', box], ['b', box]]))
    expect(out.get('a')).toEqual({ x: 0, y: 0 })
    expect(out.get('b')).toEqual({ x: 500, y: 0 })
  })
})

describe('nomes sem linha por cima', () => {
  const node = (id: string, width = 60) => ({ id, width, height: 16, r: 12 })
  const rectOf = (n: { id: string; width: number; height: number }, p: Point, s: { dx: number; dy: number; anchor: string }) => {
    const x = s.anchor === 'middle' ? p.x + s.dx - n.width / 2 : s.anchor === 'start' ? p.x + s.dx : p.x + s.dx - n.width
    return { x, y: p.y + s.dy - n.height * 0.8, w: n.width, h: n.height }
  }
  const area = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
    Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))

  it('com linhas em cruz (cima, baixo e lados), o nome vai para um canto', () => {
    const pos = new Map<string, Point>([
      ['a', { x: 200, y: 200 }],
      ['n', { x: 200, y: 100 }],
      ['s', { x: 200, y: 300 }],
      ['e', { x: 300, y: 200 }],
      ['w', { x: 100, y: 200 }],
    ])
    const edges = ['n', 's', 'e', 'w'].map((to) => ({ from: 'a', to }))
    const nodes = [node('a', 50)]
    const spots = placeLabels(nodes, pos, { edges })
    const s = spots.get('a')!
    // Nem embaixo nem em cima nem dos lados (as linhas passam ali): num canto.
    expect(s.dx).not.toBe(0)
    expect(Math.abs(s.dy)).toBeGreaterThan(12)
    expect(crossedLabels(nodes, pos, spots, edges)).toBe(0)
  })

  // Um desenho de verdade: o mesmo que o mapa de Ligações faz (forças, afastar, nomes), com 40 fichas e 70 ligações.
  const graph = () => {
    const ids = Array.from({ length: 40 }, (_, i) => `f${i}`)
    const edges: { from: string; to: string }[] = []
    for (let i = 1; i < ids.length; i++) edges.push({ from: ids[i], to: ids[Math.floor((i - 1) / 3)] })
    for (let i = 0; i < 30; i++) edges.push({ from: ids[(i * 7) % 40], to: ids[(i * 11 + 5) % 40] })
    const list = edges.filter((e, i) => e.from !== e.to && edges.findIndex((o) => o.from === e.from && o.to === e.to) === i)
    const nodes = ids.map((id, i) => ({ id, width: 40 + (i % 5) * 18, height: 16, r: 11 }))
    const raw = forceLayout(ids.map((id) => ({ id })), list, { width: 700, height: 600, margin: 56, stretch: 1.7 })
    const boxes = new Map(nodes.map((n) => [n.id, { w: Math.max(2 * n.r, n.width), h: 2 * n.r + 4 + 16, top: -n.r }]))
    return { nodes, edges: list, pos: separate(raw, boxes, { gap: 8 }) }
  }

  it('afastar a bolinha tira linhas de cima dos nomes sem encostar em mais nada', () => {
    const { nodes, edges, pos } = graph()
    const only = placeLabels(nodes, pos, { edges })
    const before = crossedLabels(nodes, pos, only, edges)
    const settled = settleLabels(nodes, pos, { edges })
    const after = crossedLabels(nodes, settled.pos, settled.labels, edges)
    expect(before).toBeGreaterThan(3)
    expect(after).toBeLessThan(before)

    // Ninguém andou mais que o alcance, e nenhum nome ou bolinha encosta em outro.
    for (const [id, p] of settled.pos) expect(Math.hypot(p.x - pos.get(id)!.x, p.y - pos.get(id)!.y)).toBeLessThanOrEqual(36.001)
    const rects = nodes.map((n) => ({ n, box: rectOf(n, settled.pos.get(n.id)!, settled.labels.get(n.id)!) }))
    const circles = nodes.map((n) => ({ x: settled.pos.get(n.id)!.x - n.r, y: settled.pos.get(n.id)!.y - n.r, w: 2 * n.r, h: 2 * n.r }))
    for (let i = 0; i < nodes.length; i++) {
      for (let j = 0; j < nodes.length; j++) {
        if (i < j) expect(area(rects[i].box, rects[j].box)).toBe(0)
        if (i !== j) expect(area(rects[i].box, circles[j])).toBe(0)
        if (i < j) expect(area(circles[i], circles[j])).toBe(0)
      }
    }
  })

  it('é sempre o mesmo desenho, e não mexe em quem não tem linha por cima do nome', () => {
    const { nodes, edges, pos } = graph()
    const a = settleLabels(nodes, pos, { edges })
    const b = settleLabels(nodes, pos, { edges })
    expect(b).toEqual(a)
    // Sem ligações não há o que desviar: nada se mexe.
    const free = settleLabels(nodes, pos, { edges: [] })
    expect(free.pos).toEqual(pos)
  })

  it('a bolinha não sai da área', () => {
    const { nodes, edges, pos } = graph()
    const xs = [...pos.values()].map((p) => p.x)
    const ys = [...pos.values()].map((p) => p.y)
    const width = Math.max(...xs) + 30
    const height = Math.max(...ys) + 30
    const settled = settleLabels(nodes, pos, { edges, width, height, pad: 4 })
    for (const n of nodes) {
      const p = settled.pos.get(n.id)!
      expect(p.x - n.r).toBeGreaterThanOrEqual(4 - 0.001)
      expect(p.x + n.r).toBeLessThanOrEqual(width - 4 + 0.001)
      expect(p.y - n.r).toBeGreaterThanOrEqual(4 - 0.001)
      expect(p.y + n.r).toBeLessThanOrEqual(height - 4 + 0.001)
    }
  })
})
