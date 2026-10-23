export interface GraphNode {
  id: string
}
export interface GraphEdge {
  from: string
  to: string
}
export interface Point {
  x: number
  y: number
}

/**
 * Layout de grafo por forças (repulsão entre nós, molas nas arestas, gravidade
 * para o centro). Determinístico: o mesmo grafo produz o mesmo desenho, para que
 * nada "pule" de lugar entre uma visita e outra.
 */
export function forceLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  { width = 1000, height = 700, iterations = 300 } = {},
): Map<string, Point> {
  const n = nodes.length
  const pos = new Map<string, Point>()
  if (n === 0) return pos
  const cx = width / 2
  const cy = height / 2
  if (n === 1) return pos.set(nodes[0].id, { x: cx, y: cy })

  // Posições iniciais em espiral (determinísticas).
  nodes.forEach((node, i) => {
    const angle = i * 2.399963 // ângulo áureo
    const r = 30 * Math.sqrt(i + 1)
    pos.set(node.id, { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) })
  })

  const area = width * height
  const k = Math.sqrt(area / n) * 0.5
  const valid = edges.filter((e) => pos.has(e.from) && pos.has(e.to) && e.from !== e.to)
  let temperature = width / 8

  for (let it = 0; it < iterations; it++) {
    const disp = new Map<string, Point>(nodes.map((v) => [v.id, { x: 0, y: 0 }]))

    for (let i = 0; i < n; i++) {
      const a = pos.get(nodes[i].id)!
      const da = disp.get(nodes[i].id)!
      for (let j = i + 1; j < n; j++) {
        const b = pos.get(nodes[j].id)!
        const db = disp.get(nodes[j].id)!
        let dx = a.x - b.x
        let dy = a.y - b.y
        let d = Math.hypot(dx, dy)
        if (d < 0.01) {
          dx = 0.01 * (i - j)
          dy = 0.01
          d = Math.hypot(dx, dy)
        }
        // Repulsão só atua de perto, para que grupos desconectados não se afastem demais.
        if (d > 2.5 * k) continue
        const f = (k * k) / d
        da.x += (dx / d) * f
        da.y += (dy / d) * f
        db.x -= (dx / d) * f
        db.y -= (dy / d) * f
      }
    }

    for (const e of valid) {
      const a = pos.get(e.from)!
      const b = pos.get(e.to)!
      const dx = a.x - b.x
      const dy = a.y - b.y
      const d = Math.max(Math.hypot(dx, dy), 0.01)
      const f = (d * d) / k
      const da = disp.get(e.from)!
      const db = disp.get(e.to)!
      da.x -= (dx / d) * f
      da.y -= (dy / d) * f
      db.x += (dx / d) * f
      db.y += (dy / d) * f
    }

    for (const node of nodes) {
      const p = pos.get(node.id)!
      const d = disp.get(node.id)!
      // Gravidade leve mantém componentes desconectados por perto.
      d.x += (cx - p.x) * 0.15
      d.y += (cy - p.y) * 0.15
      const len = Math.max(Math.hypot(d.x, d.y), 0.01)
      p.x += (d.x / len) * Math.min(len, temperature)
      p.y += (d.y / len) * Math.min(len, temperature)
    }
    temperature *= 0.985
  }

  // Ajusta para caber na área com margem.
  const xs = [...pos.values()].map((p) => p.x)
  const ys = [...pos.values()].map((p) => p.y)
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const margin = 60
  const sx = (width - 2 * margin) / Math.max(maxX - minX, 1)
  const sy = (height - 2 * margin) / Math.max(maxY - minY, 1)
  const s = Math.min(sx, sy, 1.5)
  const ox = (width - (maxX - minX) * s) / 2
  const oy = (height - (maxY - minY) * s) / 2
  for (const p of pos.values()) {
    p.x = ox + (p.x - minX) * s
    p.y = oy + (p.y - minY) * s
  }
  return pos
}

/** Vizinhança de um nó até a profundidade indicada. */
export function neighborhood(start: string, edges: GraphEdge[], depth: number): Set<string> {
  const seen = new Set([start])
  let frontier = [start]
  for (let d = 0; d < depth; d++) {
    const next: string[] = []
    for (const e of edges) {
      for (const [a, b] of [
        [e.from, e.to],
        [e.to, e.from],
      ]) {
        if (frontier.includes(a) && !seen.has(b)) {
          seen.add(b)
          next.push(b)
        }
      }
    }
    frontier = next
  }
  return seen
}
