import { fold } from '../logic/text'
import type { Entity, GameSystem, Sheet, Universe } from '../model/schema'

/**
 * Bônus do mundo na ficha de jogo: a espécie (ou cultura, origem) ligada ao personagem dá
 * traços e modificadores. A ficha guarda a soma à vista ("+2 Elfo"), sempre em dia com o Mundo.
 */
export type SheetBonus = NonNullable<Sheet['bonuses']>[number]

/** Tipos de ficha que podem ter "No jogo". */
export const GAME_KINDS = ['especie', 'cultura']

const hasGame = (e: Entity | undefined): e is Entity => Boolean(e?.game && (e.game.traits.some((t) => t.trim()) || Object.values(e.game.mods).some((n) => n !== 0)))

/** As fichas com "No jogo" ligadas ao personagem: por campo do tipo ficha ou por ligação (qualquer lado). */
export function gameSourcesOf(u: Universe, characterId: string): Entity[] {
  const byId = new Map(u.entities.map((e) => [e.id, e]))
  const me = byId.get(characterId)
  if (!me) return []
  const ids = new Set<string>()
  for (const f of me.fields) if (f.ref) ids.add(f.ref)
  for (const r of u.relations) {
    if (r.fromId === characterId) ids.add(r.toId)
    if (r.toId === characterId) ids.add(r.fromId)
  }
  return [...ids].map((id) => byId.get(id)).filter(hasGame)
}

/** Os bônus que a ficha de jogo deve ter agora, no sistema dela (siglas que o sistema não tem ficam de fora). */
export function bonusesFor(u: Universe, sheet: Sheet, system: GameSystem | undefined): SheetBonus[] {
  if (!sheet.entityId) return []
  return gameSourcesOf(u, sheet.entityId).map((src) => {
    const attrs: Record<string, number> = {}
    for (const [abbr, n] of Object.entries(src.game!.mods)) {
      const a = system?.attributes.find((x) => fold(x.abbr) === fold(abbr))
      if (a && n) attrs[a.id] = (attrs[a.id] ?? 0) + n
    }
    return { sourceId: src.id, name: src.name, attrs, traits: src.game!.traits.map((t) => t.trim()).filter(Boolean) }
  })
}

/** Soma dos bônus de um atributo na ficha (zero com os bônus desligados). */
export function bonusOf(sheet: Sheet | null | undefined, attributeId: string): number {
  if (!sheet?.bonuses || sheet.bonusesOff) return 0
  return sheet.bonuses.reduce((sum, b) => sum + (b.attrs[attributeId] ?? 0), 0)
}

/** Deixa os bônus de todas as fichas de jogo em dia com o mundo. Devolve o mesmo universo se nada mudou. */
export function syncWorldBonuses(u: Universe): Universe {
  let changed = false
  const sheets = u.sheets.map((s) => {
    const want = bonusesFor(u, s, u.systems.find((x) => x.id === s.systemId))
    const have = s.bonuses ?? []
    if (JSON.stringify(want) === JSON.stringify(have)) return s
    changed = true
    const next = { ...s }
    if (want.length) next.bonuses = want
    else delete next.bonuses
    return next
  })
  return changed ? { ...u, sheets } : u
}
