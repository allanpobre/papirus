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

/** O segmento de `a` a `b` passa pela caixa? (Liang–Barsky, com uma rejeição rápida antes.) */
function crosses(a: Point, b: Point, box: Box): boolean {
  const x1 = box.x + box.w
  const y1 = box.y + box.h
  // Rápido: o segmento inteiro de um lado só da caixa.
  if ((a.x < box.x && b.x < box.x) || (a.x > x1 && b.x > x1) || (a.y < box.y && b.y < box.y) || (a.y > y1 && b.y > y1)) return false
  const dx = b.x - a.x
  const dy = b.y - a.y
  let t0 = 0
  let t1 = 1
  // As quatro bordas: (p, q) = (-dx, a.x - x), (dx, x1 - a.x), (-dy, a.y - y), (dy, y1 - a.y).
  for (let i = 0; i < 4; i++) {
    const p = i === 0 ? -dx : i === 1 ? dx : i === 2 ? -dy : dy
    const q = i === 0 ? a.x - box.x : i === 1 ? x1 - a.x : i === 2 ? a.y - box.y : y1 - a.y
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

interface Placement {
  spot: LabelSpot
  box: Box
}

/** Um segmento (uma linha do mapa) com as pontas vivas: se a bolinha anda, a linha acompanha. */
interface Seg {
  from: string
  to: string
  a: Point
  b: Point
}

interface Bounds {
  width: number
  height: number
  pad: number
}

/**
 * Os lugares possíveis do nome, do melhor para o pior: embaixo (o de sempre), em cima, à direita e
 * à esquerda; depois nos quatro cantos; por último, esses mesmos um pouco mais afastados.
 */
function labelPlacements(n: LabelNode, p: Point, gap: number): Placement[] {
  const { width: w, height: h, r } = n
  // A linha de base fica a ~80% da altura da caixa do texto.
  const base = h * 0.8
  const at = (x: number, y: number, dx: number, dy: number, anchor: LabelSpot['anchor']): Placement => ({ box: { x, y, w, h }, spot: { dx, dy, anchor } })
  const k = r * 0.72 + 1
  const g = gap + 12
  return [
    at(p.x - w / 2, p.y + r + gap, 0, r + gap + base, 'middle'),
    at(p.x - w / 2, p.y - r - gap - h, 0, -r - gap - h + base, 'middle'),
    at(p.x + r + gap + 1, p.y - h / 2, r + gap + 1, -h / 2 + base, 'start'),
    at(p.x - r - gap - 1 - w, p.y - h / 2, -r - gap - 1, -h / 2 + base, 'end'),
    at(p.x + k, p.y + k + gap, k, k + gap + base, 'start'),
    at(p.x - k - w, p.y + k + gap, -k, k + gap + base, 'end'),
    at(p.x + k, p.y - k - gap - h, k, -k - gap - h + base, 'start'),
    at(p.x - k - w, p.y - k - gap - h, -k, -k - gap - h + base, 'end'),
    at(p.x - w / 2, p.y + r + g, 0, r + g + base, 'middle'),
    at(p.x - w / 2, p.y - r - g - h, 0, -r - g - h + base, 'middle'),
    at(p.x + r + g + 1, p.y - h / 2, r + g + 1, -h / 2 + base, 'start'),
    at(p.x - r - g - 1 - w, p.y - h / 2, -r - g - 1, -h / 2 + base, 'end'),
  ]
}

/**
 * Quanto atrapalha pôr o nome ali (0 = lugar livre). `labels` e `circles` têm uma caixa por ficha, na ordem de
 * `nodes` (sem caixa ainda = o nome dela não foi posto); a ficha `self` não conta contra si mesma.
 */
function placementCost(o: Placement, n: LabelNode, self: number, labels: (Box | undefined)[], circles: (Box | undefined)[], segs: Seg[], { width, height, pad }: Bounds): number {
  let cost = 0
  for (let i = 0; i < labels.length; i++) {
    if (i === self) continue
    // Encostar em outro nome ou em outra bolinha é o pior: custa mais que qualquer linha por baixo.
    const l = labels[i]
    if (l) {
      const a = overlap(o.box, l)
      if (a > 0) cost += 10000 + a
    }
    const c = circles[i]
    if (c) {
      const a = overlap(o.box, c)
      if (a > 0) cost += 5000 + a
    }
  }
  // Fora da área também custa: o nome cortado na borda não se lê.
  const out = Math.max(0, pad - o.box.x) + Math.max(0, o.box.x + o.box.w - (width - pad)) + Math.max(0, pad - o.box.y) + Math.max(0, o.box.y + o.box.h - (height - pad))
  cost += out * n.height * 2
  // Uma linha passando por cima do nome atrapalha menos que outro nome, mas atrapalha.
  for (const e of segs) if (crosses(e.a, e.b, o.box)) cost += n.height * 4
  return cost
}

const circleBox = (p: Point, r: number): Box => ({ x: p.x - r, y: p.y - r, w: 2 * r, h: 2 * r })

function segmentsOf(pos: Map<string, Point>, edges: GraphEdge[]): Seg[] {
  const segs: Seg[] = []
  for (const e of edges) {
    const a = pos.get(e.from)
    const b = pos.get(e.to)
    if (a && b) segs.push({ from: e.from, to: e.to, a, b })
  }
  return segs
}

/** Escolhe o melhor lugar do nome de `n` entre os possíveis (o primeiro que não atrapalha em nada, se houver). */
function bestPlacement(n: LabelNode, p: Point, self: number, labels: (Box | undefined)[], circles: (Box | undefined)[], segs: Seg[], gap: number, bounds: Bounds, from?: Placement): { place: Placement; cost: number } {
  let best = from
  let bestCost = from ? placementCost(from, n, self, labels, circles, segs, bounds) : Infinity
  if (bestCost > 0) {
    for (const o of labelPlacements(n, p, gap)) {
      const cost = placementCost(o, n, self, labels, circles, segs, bounds)
      if (cost < bestCost) {
        best = o
        bestCost = cost
        if (cost === 0) break
      }
    }
  }
  return { place: best!, cost: bestCost }
}

function placeAll(nodes: LabelNode[], pos: Map<string, Point>, segs: Seg[], gap: number, bounds: Bounds): { places: (Placement | undefined)[]; labels: (Box | undefined)[]; circles: (Box | undefined)[] } {
  const places: (Placement | undefined)[] = nodes.map(() => undefined)
  const labels: (Box | undefined)[] = nodes.map(() => undefined)
  const circles = nodes.map((n) => {
    const p = pos.get(n.id)
    return p ? circleBox(p, n.r) : undefined
  })
  nodes.forEach((n, i) => {
    const p = pos.get(n.id)
    if (!p) return
    const { place } = bestPlacement(n, p, i, labels, circles, segs, gap, bounds)
    places[i] = place
    labels[i] = place.box
  })
  return { places, labels, circles }
}

/**
 * Onde escrever o nome de cada bolinha para que os nomes não fiquem uns sobre os outros, sobre
 * outra bolinha, cortados na borda nem riscados por uma linha: embaixo (o lugar de sempre), em cima,
 * à direita ou à esquerda, e, se as linhas tomam esses quatro, nos cantos. Na ordem recebida: quem
 * vem primeiro escolhe primeiro. Sem lugar livre, fica onde atrapalha menos.
 */
export function placeLabels(
  nodes: LabelNode[],
  pos: Map<string, Point>,
  { width = Infinity, height = Infinity, gap = 4, pad = 0, edges = [] as GraphEdge[] } = {},
): Map<string, LabelSpot> {
  const { places } = placeAll(nodes, pos, segmentsOf(pos, edges), gap, { width, height, pad })
  const out = new Map<string, LabelSpot>()
  nodes.forEach((n, i) => {
    const o = places[i]
    if (o) out.set(n.id, o.spot)
  })
  return out
}

/**
 * Quantos nomes têm uma linha passando por cima, dado onde cada nome foi posto. (Para medir o desenho
 * e para os testes; o desenho usa `settleLabels`.)
 */
export function crossedLabels(nodes: LabelNode[], pos: Map<string, Point>, spots: Map<string, LabelSpot>, edges: GraphEdge[]): number {
  const segs = segmentsOf(pos, edges)
  let count = 0
  for (const n of nodes) {
    const p = pos.get(n.id)
    const s = spots.get(n.id)
    if (!p || !s) continue
    const base = n.height * 0.8
    const x = s.anchor === 'middle' ? p.x + s.dx - n.width / 2 : s.anchor === 'start' ? p.x + s.dx : p.x + s.dx - n.width
    const box = { x, y: p.y + s.dy - base, w: n.width, h: n.height }
    if (segs.some((e) => crosses(e.a, e.b, box))) count++
  }
  return count
}

const DIRECTIONS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [0.7071, 0.7071],
  [-0.7071, 0.7071],
  [0.7071, -0.7071],
  [-0.7071, -0.7071],
]

/**
 * Põe os nomes (como `placeLabels`) e, para quem ainda ficou com uma linha passando por cima do nome,
 * afasta um pouco a bolinha (ou a de quem a linha liga), só se isso tirar a linha do nome sem encostar
 * em mais nada. Cada bolinha anda no máximo `reach` e nunca sai da área; o nome do outro lado também
 * é testado a cada passo. Determinístico: o mesmo desenho sai sempre igual. `maxTrials` limita o
 * trabalho em mundos muito grandes (o que passar disso fica como está).
 */
export function settleLabels(
  nodes: LabelNode[],
  pos: Map<string, Point>,
  { width = Infinity, height = Infinity, gap = 4, pad = 0, edges = [] as GraphEdge[], reach = 36, step = 6, spacing = 4, maxTrials = 6000 } = {},
): { pos: Map<string, Point>; labels: Map<string, LabelSpot> } {
  const cur = new Map([...pos].map(([id, p]) => [id, { x: p.x, y: p.y }]))
  const bounds: Bounds = { width, height, pad }
  const segs = segmentsOf(cur, edges)
  const incident = new Map<string, Seg[]>()
  for (const e of segs) {
    for (const id of e.from === e.to ? [e.from] : [e.from, e.to]) {
      const list = incident.get(id)
      if (list) list.push(e)
      else incident.set(id, [e])
    }
  }
  const { places, labels, circles } = placeAll(nodes, cur, segs, gap, bounds)

  /** Quantas linhas riscam o nome da ficha `i`, ou riscam o nome de outra ao sair dela. */
  const crossingsAround = (i: number) => {
    let c = 0
    const own = labels[i]
    if (own) for (const e of segs) if (crosses(e.a, e.b, own)) c++
    for (const e of incident.get(nodes[i].id) ?? []) {
      for (let j = 0; j < labels.length; j++) {
        const l = labels[j]
        if (j !== i && l && crosses(e.a, e.b, l)) c++
      }
    }
    return c
  }
  /** Cada nome volta a escolher o melhor lugar, agora sabendo onde estão todos os outros. */
  const relabel = () => {
    nodes.forEach((n, i) => {
      const p = cur.get(n.id)
      if (!p) return
      const { place } = bestPlacement(n, p, i, labels, circles, segs, gap, bounds, places[i])
      places[i] = place
      labels[i] = place.box
    })
  }

  let trials = 0
  for (let pass = 0; pass < 3 && trials < maxTrials; pass++) {
    relabel()
    let moved = false
    for (let i = 0; i < nodes.length && trials < maxTrials; i++) {
      const n = nodes[i]
      const p = cur.get(n.id)
      if (!p) continue
      const before = crossingsAround(i)
      if (before === 0) continue
      const home = { x: p.x, y: p.y }
      const homePlace = places[i]!
      const mine = circles[i]!
      let best: { x: number; y: number; place: Placement; count: number } | null = null
      // Do mais perto para o mais longe: no primeiro lugar que deixa tudo limpo, para.
      search: for (let d = step; d <= reach; d += step) {
        for (const [ux, uy] of DIRECTIONS) {
          trials++
          p.x = home.x + ux * d
          p.y = home.y + uy * d
          if (p.x - n.r < pad || p.y - n.r < pad || p.x + n.r > width - pad || p.y + n.r > height - pad) continue
          mine.x = p.x - n.r
          mine.y = p.y - n.r
          const grown = { x: mine.x - spacing, y: mine.y - spacing, w: mine.w + 2 * spacing, h: mine.h + 2 * spacing }
          let free = true
          for (let j = 0; j < nodes.length && free; j++) {
            if (j === i) continue
            const c = circles[j]
            const l = labels[j]
            if ((c && overlap(grown, c) > 0) || (l && overlap(grown, l) > 0)) free = false
          }
          if (!free) continue
          // O nome desta bolinha, no melhor lugar que ela tem ali (sem encostar em mais nada).
          const { place, cost } = bestPlacement(n, p, i, labels, circles, segs, gap, bounds)
          if (cost >= 5000) continue
          labels[i] = place.box
          const count = crossingsAround(i)
          if (count < before && (!best || count < best.count)) best = { x: p.x, y: p.y, place, count }
          if (best?.count === 0) break search
        }
      }
      p.x = best ? best.x : home.x
      p.y = best ? best.y : home.y
      mine.x = p.x - n.r
      mine.y = p.y - n.r
      places[i] = best ? best.place : homePlace
      labels[i] = places[i]!.box
      if (best) moved = true
    }
    if (!moved) break
  }
  relabel()
  const out = new Map<string, LabelSpot>()
  nodes.forEach((n, i) => {
    const o = places[i]
    if (o) out.set(n.id, o.spot)
  })
  return { pos: cur, labels: out }
}

export interface SeparateBox {
  /** Largura e altura do espaço da ficha (bolinha e nome). */
  w: number
  h: number
  /** Do centro da bolinha até o alto da caixa (negativo: a caixa começa acima do centro). */
  top: number
}

/**
 * Afasta as fichas até nenhuma caixa (bolinha com o nome embaixo) encostar em outra. Cada par que
 * se sobrepõe é empurrado na direção de um centro para o outro, metade para cada um, e repete até
 * ninguém mais se tocar. Determinístico, como o layout: o mesmo desenho sai sempre igual.
 */
export function separate(pos: Map<string, Point>, boxes: Map<string, SeparateBox>, { gap = 6, iterations = 400 } = {}): Map<string, Point> {
  const out = new Map([...pos].map(([id, p]) => [id, { x: p.x, y: p.y }]))
  const items = [...out].filter(([id]) => boxes.has(id)).map(([id, p]) => ({ p, b: boxes.get(id)! }))
  for (let it = 0; it < iterations; it++) {
    let moved = false
    for (let i = 0; i < items.length; i++) {
      const a = items[i]
      for (let j = i + 1; j < items.length; j++) {
        const b = items[j]
        const ay = a.p.y + a.b.top + a.b.h / 2
        const by = b.p.y + b.b.top + b.b.h / 2
        const ox = (a.b.w + b.b.w) / 2 + gap - Math.abs(a.p.x - b.p.x)
        if (ox <= 0) continue
        const oy = (a.b.h + b.b.h) / 2 + gap - Math.abs(ay - by)
        if (oy <= 0) continue
        moved = true
        // Empurra na direção de um centro para o outro (assim o desenho cresce por igual, sem virar
        // uma coluna), só o bastante para as caixas deixarem de se tocar; metade para cada um.
        let dx = b.p.x - a.p.x
        let dy = by - ay
        if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
          // No mesmo lugar: um ângulo que depende só da posição na lista.
          dx = Math.cos(j * 2.39996)
          dy = Math.sin(j * 2.39996)
        }
        const len = Math.hypot(dx, dy)
        const ux = dx / len
        const uy = dy / len
        const t = Math.min(Math.abs(ux) > 1e-6 ? ox / Math.abs(ux) : Infinity, Math.abs(uy) > 1e-6 ? oy / Math.abs(uy) : Infinity) + 0.5
        a.p.x -= (ux * t) / 2
        a.p.y -= (uy * t) / 2
        b.p.x += (ux * t) / 2
        b.p.y += (uy * t) / 2
      }
    }
    if (!moved) break
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
