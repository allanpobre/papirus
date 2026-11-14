import type { Universe } from '../model/schema'
import { entityName } from '../model/universe'
import { inside } from './regions'

/** Um lugar e tudo o que fica dentro dele ("fica em"), em qualquer fundo. Nunca trava num ciclo. */
export function placesWithin(u: Universe, placeId: string): Set<string> {
  const out = new Set([placeId])
  const children = new Map<string, string[]>()
  for (const e of u.entities) if (e.parentId) children.set(e.parentId, [...(children.get(e.parentId) ?? []), e.id])
  const queue = [placeId]
  while (queue.length) {
    for (const id of children.get(queue.shift()!) ?? []) {
      if (out.has(id)) continue
      out.add(id)
      queue.push(id)
    }
  }
  return out
}

export interface RegionChoice {
  /** `mapa:região`, para escolher uma. */
  key: string
  label: string
}

/** As regiões pintadas em todos os mapas, com o nome do dono (e o do mapa, se há mais de um). */
export function regionChoices(u: Universe): RegionChoice[] {
  const out: RegionChoice[] = []
  for (const map of u.maps) {
    for (const r of map.regions ?? []) {
      const owner = entityName(u, r.entityId) || 'Região'
      out.push({ key: `${map.id}:${r.id}`, label: u.maps.length > 1 ? `${owner} (${map.name || 'Mapa'})` : owner })
    }
  }
  return out
}

/**
 * Os lugares de uma região do mapa: o dono dela, os lugares com marcador dentro do desenho e, de cada um,
 * o que fica dentro dele. Vazio se a região não existe mais.
 */
export function placesInRegion(u: Universe, key: string): Set<string> {
  const [mapId, regionId] = key.split(':')
  const map = u.maps.find((m) => m.id === mapId)
  const region = map?.regions?.find((r) => r.id === regionId)
  const out = new Set<string>()
  if (!map || !region) return out
  const seeds = [region.entityId, ...map.pins.filter((p) => inside([p.x, p.y], region.points)).map((p) => p.entityId)]
  for (const id of seeds) for (const inner of placesWithin(u, id)) out.add(inner)
  return out
}
