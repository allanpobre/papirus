/*
 * Gerar um continente para quem não tem mapa: costa, montanhas, rios e florestas, por regras e com semente
 * (a mesma semente dá o mesmo mapa). Só a forma, em coordenadas de 0 a 1; quem desenha é a tela (canvas).
 */

export interface Continent {
  /** Contorno da terra (pontos de 0 a 1). */
  coast: [number, number][]
  /** Ilhas pequenas em volta. */
  islands: [number, number][][]
  mountains: [number, number][]
  forests: [number, number][]
  /** Cada rio, da nascente (perto das montanhas) até o mar. */
  rivers: [number, number][][]
}

/** Números aleatórios com semente (mulberry32). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Um contorno torto em volta de (cx, cy): raio que sobe e desce em ondas somadas. */
function blob(cx: number, cy: number, rx: number, ry: number, n: number, random: () => number): [number, number][] {
  const waves = [1, 2, 3, 5, 8].map((f) => ({ f, amp: (random() * 0.5) / f ** 0.6, ph: random() * Math.PI * 2 }))
  const pts: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2
    let r = 1
    for (const w of waves) r += w.amp * Math.sin(w.f * t + w.ph)
    r += (random() - 0.5) * 0.06
    r = Math.min(1.25, Math.max(0.4, r))
    pts.push([clamp(cx + Math.cos(t) * rx * r), clamp(cy + Math.sin(t) * ry * r)])
  }
  return pts
}

const clamp = (v: number) => Math.min(0.97, Math.max(0.03, v))

/** O ponto está dentro do contorno? (raio que cruza as bordas) */
export function insideShape([x, y]: [number, number], poly: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

export function generateContinent(seed: number): Continent {
  const random = seededRandom(seed)
  const coast = blob(0.5, 0.5, 0.33, 0.3, 140, random)
  const islands = Array.from({ length: 2 + Math.floor(random() * 3) }, () => {
    const a = random() * Math.PI * 2
    return blob(0.5 + Math.cos(a) * 0.43, 0.5 + Math.sin(a) * 0.42, 0.03 + random() * 0.03, 0.025 + random() * 0.03, 24, random)
  })
  const land = (p: [number, number]) => insideShape(p, coast)
  // Uma cordilheira: uma linha torta que atravessa parte da terra.
  const mountains: [number, number][] = []
  const a = random() * Math.PI
  const [mx, my] = [0.5 + (random() - 0.5) * 0.2, 0.5 + (random() - 0.5) * 0.2]
  for (let i = -6; i <= 6; i++) {
    const p: [number, number] = [mx + Math.cos(a) * i * 0.035 + (random() - 0.5) * 0.03, my + Math.sin(a) * i * 0.03 + (random() - 0.5) * 0.03]
    if (land(p)) mountains.push(p)
  }
  // Rios: começam perto de uma montanha e andam para longe do centro até achar o mar.
  const rivers: [number, number][][] = []
  for (let k = 0; k < 3 && mountains.length; k++) {
    let [x, y] = mountains[Math.floor(random() * mountains.length)]
    const dir = random() * Math.PI * 2
    const path: [number, number][] = [[x, y]]
    for (let step = 0; step < 60 && land([x, y]); step++) {
      const d = dir + (random() - 0.5) * 1.2
      x += Math.cos(d) * 0.014
      y += Math.sin(d) * 0.014
      path.push([x, y])
    }
    if (path.length > 4) rivers.push(path)
  }
  // Florestas: manchas de pontos longe das montanhas.
  const forests: [number, number][] = []
  for (let k = 0; k < 4; k++) {
    const c: [number, number] = [0.25 + random() * 0.5, 0.25 + random() * 0.5]
    for (let i = 0; i < 14; i++) {
      const p: [number, number] = [c[0] + (random() - 0.5) * 0.09, c[1] + (random() - 0.5) * 0.07]
      if (land(p) && !mountains.some((m) => Math.hypot(m[0] - p[0], m[1] - p[1]) < 0.04)) forests.push(p)
    }
  }
  return { coast, islands, mountains, forests, rivers }
}
