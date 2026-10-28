import type { GameSystem, Sheet } from '../model/schema'

export type SheetDraft = Omit<Sheet, 'id' | 'createdAt' | 'updatedAt'>

/** Ficha nova com os valores padrão do sistema. */
export function draftSheet(
  name: string,
  system: GameSystem | null,
  fields: Partial<Pick<Sheet, 'role' | 'player' | 'entityId' | 'groupId'>> = {},
): SheetDraft {
  return {
    name,
    role: 'pj',
    player: '',
    entityId: null,
    groupId: null,
    systemId: system?.id ?? null,
    attributes: Object.fromEntries((system?.attributes ?? []).map((a) => [a.id, a.default])),
    resources: Object.fromEntries((system?.resources ?? []).map((r) => [r.id, { current: r.default, max: r.default }])),
    skills: Object.fromEntries((system?.skills ?? []).map((s) => [s.id, 0])),
    conditions: [],
    fields: Object.fromEntries((system?.fields ?? []).map((f) => [f, ''])),
    notes: '',
    image: null,
    attacks: [],
    abilities: [],
    inventory: [],
    ...fields,
  }
}

/** Aplica dano (negativo) ou cura (positivo) a um recurso, sem passar do máximo. */
export function adjustResource(sheet: Sheet, resourceId: string, delta: number): Sheet['resources'] {
  const r = sheet.resources[resourceId] ?? { current: 0, max: 0 }
  const next = r.max > 0 ? Math.min(r.max, r.current + delta) : r.current + delta
  return { ...sheet.resources, [resourceId]: { ...r, current: next } }
}

/** Valor de um atributo na ficha, ou o padrão do sistema. */
export function attributeOf(system: GameSystem, sheet: Sheet, attributeId: string): number {
  return sheet.attributes[attributeId] ?? system.attributes.find((a) => a.id === attributeId)?.default ?? 0
}

/** Primeiro recurso do sistema (normalmente a vida), para mostrar na iniciativa. */
export const mainResource = (system: GameSystem | undefined) => system?.resources[0]

type ResourceDef = GameSystem['resources'][number]

/**
 * Recurso que sobe e desce no jogo (vida, mana, sanidade), com barra, dano e cura.
 * Os outros (Defesa, CA, deslocamento) são um valor fixo da ficha.
 */
export const isPool = (r: ResourceDef) => !/^(def|ca|desl)/i.test(r.abbr.trim()) && !/defesa|armadura|deslocamento/i.test(r.name)

/** Recurso gasto por poderes e magias: PM, PE, mana… (ou o segundo que sobe e desce). */
export function costResource(system: GameSystem | undefined): ResourceDef | undefined {
  const pools = (system?.resources ?? []).filter(isPool)
  return pools.find((r) => /^(pm|pe|mp)$/i.test(r.abbr.trim()) || /mana|esfor[cç]o|magia/i.test(r.name)) ?? pools[1]
}

/** Margem de crítico de "19/x2", "18-20" ou "19" (20 quando não dá para ler, ou só "x3"). */
export function critFrom(critical: string): number {
  const m = critical.trim().match(/^(\d{1,2})(?!\d)/)
  const n = m ? Number(m[1]) : 20
  return n >= 2 && n <= 20 ? n : 20
}
