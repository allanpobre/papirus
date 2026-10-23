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
