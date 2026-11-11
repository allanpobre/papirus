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
  { width = 1000, height = 700, iterations = 300, margin = 60, stretch = 1 } = {},
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

  // Ajusta para caber na área com margem. Com `stretch` acima de 1, o lado que sobra pode esticar
  // até esse tanto a mais que o outro: o desenho ocupa uma tela larga (ou alta) em vez de virar uma bola no meio.
  const xs = [...pos.values()].map((p) => p.x)
  const ys = [...pos.values()].map((p) => p.y)
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const sx = (width - 2 * margin) / Math.max(maxX - minX, 1)
  const sy = (height - 2 * margin) / Math.max(maxY - minY, 1)
  const s = Math.min(sx, sy, 1.5)
  const fx = Math.min(sx, s * stretch)
  const fy = Math.min(sy, s * stretch)
  const ox = (width - (maxX - minX) * fx) / 2
  const oy = (height - (maxY - minY) * fy) / 2
  for (const p of pos.values()) {
    p.x = ox + (p.x - minX) * fx
    p.y = oy + (p.y - minY) * fy
  }
  return pos
}

export interface LabelNode {
  id: string
  /** Largura e altura do nome, na mesma unidade das posições. */
  width: number
  height: number
  /** Raio da bolinha. */
  r: number
}

export interface LabelSpot {
  /** Deslocamento a partir do centro da bolinha até a âncora do texto (a linha de base). */
  dx: number
  dy: number
  anchor: 'middle' | 'start' | 'end'
}

interface Box {
  x: number
  y: number
  w: number
  h: number
}

const overlap = (a: Box, b: Box) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))

/** O segmento de `a` a `b` passa pela caixa? (Liang–Barsky.) */
function crosses(a: Point, b: Point, box: Box): boolean {
  let t0 = 0
  let t1 = 1
  const dx = b.x - a.x
  const dy = b.y - a.y
  for (const [p, q] of [
    [-dx, a.x - box.x],
    [dx, box.x + box.w - a.x],
    [-dy, a.y - box.y],
    [dy, box.y + box.h - a.y],
  ]) {
    if (p === 0) {
      if (q < 0) return false
      continue
    }
    const t = q / p
    if (p < 0) {
      if (t > t1) return false
      if (t > t0) t0 = t
    } else {
      if (t < t0) return false
      if (t < t1) t1 = t
    }
  }
  return t0 <= t1
}

/**
 * Onde escrever o nome de cada bolinha para que os nomes não fiquem uns sobre os outros, sobre
 * outra bolinha, cortados na borda nem riscados por uma linha: embaixo (o lugar de sempre), em cima,
 * à direita ou à esquerda. Na ordem recebida: quem vem primeiro escolhe primeiro. Sem lugar livre,
 * fica onde atrapalha menos.
 */
export function placeLabels(
  nodes: LabelNode[],
  pos: Map<string, Point>,
  { width = Infinity, height = Infinity, gap = 4, pad = 0, edges = [] as GraphEdge[] } = {},
): Map<string, LabelSpot> {
  const out = new Map<string, LabelSpot>()
  const circles: { id: string; box: Box }[] = []
  for (const n of nodes) {
    const p = pos.get(n.id)
    if (p) circles.push({ id: n.id, box: { x: p.x - n.r, y: p.y - n.r, w: 2 * n.r, h: 2 * n.r } })
  }
  const placed: Box[] = []
  for (const n of nodes) {
    const p = pos.get(n.id)
    if (!p) continue
    const { width: w, height: h, r } = n
    // A linha de base fica a ~80% da altura da caixa do texto.
    const base = h * 0.8
    const options: { box: Box; spot: LabelSpot }[] = [
      { box: { x: p.x - w / 2, y: p.y + r + gap, w, h }, spot: { dx: 0, dy: r + gap + base, anchor: 'middle' } },
      { box: { x: p.x - w / 2, y: p.y - r - gap - h, w, h }, spot: { dx: 0, dy: -r - gap - h + base, anchor: 'middle' } },
      { box: { x: p.x + r + gap + 1, y: p.y - h / 2, w, h }, spot: { dx: r + gap + 1, dy: -h / 2 + base, anchor: 'start' } },
      { box: { x: p.x - r - gap - 1 - w, y: p.y - h / 2, w, h }, spot: { dx: -r - gap - 1, dy: -h / 2 + base, anchor: 'end' } },
    ]
    let best = options[0]
    let bestCost = Infinity
    for (const o of options) {
      let cost = 0
      for (const b of placed) cost += overlap(o.box, b)
      for (const c of circles) if (c.id !== n.id) cost += overlap(o.box, c.box)
      // Fora da área também custa: o nome cortado na borda não se lê.
      const out =
        Math.max(0, pad - o.box.x) + Math.max(0, o.box.x + o.box.w - (width - pad)) + Math.max(0, pad - o.box.y) + Math.max(0, o.box.y + o.box.h - (height - pad))
      cost += out * h * 2
      // Uma linha passando por cima do nome atrapalha menos que outro nome, mas atrapalha.
      for (const e of edges) {
        const a = pos.get(e.from)
        const b = pos.get(e.to)
        if (a && b && crosses(a, b, o.box)) cost += h * 4
      }
      if (cost < bestCost) {
        best = o
        bestCost = cost
        if (cost === 0) break
      }
    }
    placed.push(best.box)
    out.set(n.id, best.spot)
  }
  return out
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
