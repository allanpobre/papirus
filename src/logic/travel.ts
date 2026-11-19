import type { AtlasMap, Universe } from '../model/schema'
import { byId, manuscriptOrder } from '../model/universe'
import { daysInYear } from './calendar'
import { routeOn } from './route'

/*
 * Viagem no mapa: rotas entre marcadores, dias de viagem (a pé, a cavalo, de barco) e o aviso de quando a
 * história faz alguém viajar rápido demais entre duas cenas com data.
 */

export type Route = NonNullable<AtlasMap['routes']>[number]
export type RouteKind = Route['kind']
export type Mode = 'pe' | 'cavalo' | 'barco'

export const ROUTE_LABEL: Record<RouteKind, string> = { estrada: 'Estrada', trilha: 'Trilha', rio: 'Rio', mar: 'Mar' }
export const MODE_LABEL: Record<Mode, string> = { pe: 'a pé', cavalo: 'a cavalo', barco: 'de barco' }

/** Pela escala, quanto um trecho rende por tipo: trilha é mais lenta que estrada; no mar, a escala vale de barco. */
const SCALE_KIND: Record<RouteKind, number> = { estrada: 1, trilha: 1.4, rio: 1.2, mar: 0.5 }
/** Quanto dos dias da rota cada jeito gasta (null: não dá). Na rota de mar, os dias já são de barco. */
const FACTOR: Record<Mode, Record<RouteKind, number | null>> = {
  pe: { estrada: 1, trilha: 1, rio: 1, mar: null },
  cavalo: { estrada: 0.4, trilha: 0.5, rio: 0.5, mar: null },
  barco: { estrada: null, trilha: null, rio: 0.4, mar: 1 },
}

/** Dias da rota (a pé; no mar, de barco): o número escrito, ou a distância pela escala do mapa. Sem nenhum dos dois, null. */
export function routeDays(map: AtlasMap, r: Route): number | null {
  if (r.days !== null) return r.days
  if (!map.widthDays) return null
  const a = map.pins.find((p) => p.id === r.from)
  const b = map.pins.find((p) => p.id === r.to)
  if (!a || !b) return null
  const ratio = map.height / map.width
  const dist = Math.hypot(a.x - b.x, (a.y - b.y) * ratio)
  return Math.round(dist * map.widthDays * SCALE_KIND[r.kind] * 10) / 10
}

/** Dias de uma rota num jeito de viajar (null: não dá ou não se sabe). */
export function modeDays(map: AtlasMap, r: Route, mode: Mode): number | null {
  const base = routeDays(map, r)
  const f = FACTOR[mode][r.kind]
  return base === null || f === null ? null : Math.round(base * f * 10) / 10
}

/** O jeito mais rápido de fazer a rota (para o aviso de viagem rápida). */
export function fastestDays(map: AtlasMap, r: Route): number | null {
  const all = (['pe', 'cavalo', 'barco'] as Mode[]).map((m) => modeDays(map, r, m)).filter((d): d is number => d !== null)
  return all.length ? Math.min(...all) : null
}

/** O menor tempo entre dois marcadores pelas rotas (cada trecho do jeito mais rápido). null: sem caminho. */
export function travelDays(map: AtlasMap, fromPin: string, toPin: string): number | null {
  if (fromPin === toPin) return 0
  const routes = map.routes ?? []
  const dist = new Map<string, number>([[fromPin, 0]])
  const done = new Set<string>()
  for (;;) {
    let cur: string | null = null
    for (const [k, v] of dist) if (!done.has(k) && (cur === null || v < dist.get(cur)!)) cur = k
    if (cur === null) return null
    if (cur === toPin) return Math.round(dist.get(cur)! * 10) / 10
    done.add(cur)
    for (const r of routes) {
      const next = r.from === cur ? r.to : r.to === cur ? r.from : null
      const d = next ? fastestDays(map, r) : null
      if (!next || d === null) continue
      const nd = dist.get(cur)! + d
      if (nd < (dist.get(next) ?? Infinity)) dist.set(next, nd)
    }
  }
}

/** Dias desde o começo dos tempos (para subtrair duas datas). Sem calendário, um ano tem 365 dias. */
const dayNumber = (u: Universe, date: { year: number; day: number | null }) => date.year * (daysInYear(u.settings.calendarMonths) ?? 365) + (date.day ?? 0)

export interface FastTravel {
  from: string
  to: string
  /** Dias entre a última cena num lugar e a primeira no outro. */
  elapsed: number
  /** O mínimo que a viagem leva pelas rotas. */
  needed: number
  scenes: [number, number]
}

/** Onde o personagem chega rápido demais: entre duas cenas com data em lugares ligados por rotas. */
export function fastTravels(u: Universe, map: AtlasMap, entityId: string): FastTravel[] {
  const stops = routeOn(u, map, entityId)
  const order = manuscriptOrder(u)
  const dateOf = (n: number) => byId(u, 'scenes', order[n - 1]?.id ?? '')?.date ?? null
  const out: FastTravel[] = []
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1]
    const b = stops[i]
    const lastA = a.scenes[a.scenes.length - 1]
    const firstB = b.scenes[0]
    const da = dateOf(lastA)
    const db = dateOf(firstB)
    // Sem dia (só o ano), não dá para dizer.
    if (!da || !db || da.day === null || db.day === null) continue
    const needed = travelDays(map, a.pinId, b.pinId)
    if (needed === null || needed === 0) continue
    const elapsed = dayNumber(u, db) - dayNumber(u, da)
    if (elapsed >= 0 && elapsed < needed) out.push({ from: a.place, to: b.place, elapsed, needed, scenes: [lastA, firstB] })
  }
  return out
}

/** "3 dias", "1 dia", "12 horas". */
export function daysText(d: number): string {
  // Menos de um dia vira horas ("19 horas").
  if (d < 1) {
    const h = Math.max(1, Math.round(d * 24))
    return `${h} ${h === 1 ? 'hora' : 'horas'}`
  }
  const n = Math.round(d * 10) / 10
  return `${String(n).replace('.', ',')} ${n === 1 ? 'dia' : 'dias'}`
}
