import type { AtlasMap, Universe } from '../model/schema'
import { existsIn } from './timeMachine'

export type Region = NonNullable<AtlasMap['regions']>[number]

/** O centro de uma região (média dos pontos), para pôr o nome. */
export function centroid(points: [number, number][]): [number, number] {
  if (!points.length) return [0.5, 0.5]
  const [sx, sy] = points.reduce(([ax, ay], [x, y]) => [ax + x, ay + y], [0, 0])
  return [sx / points.length, sy / points.length]
}

/** A região vale neste ano? Sem ano escolhido, todas valem; senão, o período dela e o dono precisam existir. */
export function regionIn(u: Universe, r: Region, year: number | null): boolean {
  if (year === null) return true
  if ((r.fromYear !== null && year < r.fromYear) || (r.toYear !== null && year > r.toYear)) return false
  const owner = u.entities.find((e) => e.id === r.entityId)
  return !owner || existsIn(owner, year)
}

/** Um ponto está dentro da região? (para "quem domina aqui") */
export function inside([x, y]: [number, number], pts: [number, number][]): boolean {
  let hit = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]
    const [xj, yj] = pts[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}
