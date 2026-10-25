import type { AtlasMap, Universe } from '../model/schema'
import { byId, manuscriptOrder } from '../model/universe'

export interface RouteStop {
  pinId: string
  x: number
  y: number
  place: string
  /** Números das cenas (1, 2, 3…) em que está ali. */
  scenes: number[]
}

/**
 * O caminho de um personagem num mapa: as cenas em que ele está (ponto de vista ou presente),
 * na ordem do manuscrito, levadas ao marcador do lugar da cena (ou do lugar que o contém).
 */
export function routeOn(universe: Universe, map: AtlasMap, entityId: string): RouteStop[] {
  const pinOf = (placeId: string | null): AtlasMap['pins'][number] | null => {
    const seen = new Set<string>()
    for (let id = placeId; id && !seen.has(id); id = byId(universe, 'entities', id)?.parentId ?? null) {
      seen.add(id)
      const pin = map.pins.find((p) => p.entityId === id)
      if (pin) return pin
    }
    return null
  }
  const stops: RouteStop[] = []
  manuscriptOrder(universe).forEach((s, i) => {
    if (s.povId !== entityId && !s.presentIds.includes(entityId)) return
    const pin = pinOf(s.placeId)
    if (!pin) return
    const last = stops[stops.length - 1]
    if (last?.pinId === pin.id) last.scenes.push(i + 1)
    else stops.push({ pinId: pin.id, x: pin.x, y: pin.y, place: pin.label || byId(universe, 'entities', pin.entityId)?.name || '?', scenes: [i + 1] })
  })
  return stops
}

/** "1–4, 7" a partir de [1, 2, 3, 4, 7]. */
export function rangeText(ns: number[]): string {
  const parts: string[] = []
  for (let i = 0; i < ns.length; i++) {
    let j = i
    while (j + 1 < ns.length && ns[j + 1] === ns[j] + 1) j++
    parts.push(j > i ? `${ns[i]}–${ns[j]}` : `${ns[i]}`)
    i = j
  }
  return parts.join(', ')
}
