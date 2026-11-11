import { fold } from '../logic/text'
import type { Universe } from '../model/schema'
import { insert } from '../model/universe'
import type { TableSheet } from '../share/server'
import { linkToWorld } from './oneCharacter'
import { draftSheet } from './sheets'

/** Quantos personagens de jogador um grupo aceita pelo convite (o link é de quem o mestre passou, mas não tem senha). */
export const MAX_PLAYER_SHEETS = 10

const playerSheets = (u: Universe, groupId: string) => u.sheets.filter((s) => s.groupId === groupId && s.role === 'pj')

/** O grupo já tem o máximo de personagens de jogador. */
export const playerSheetsFull = (u: Universe, groupId: string) => playerSheets(u, groupId).length >= MAX_PLAYER_SHEETS

/**
 * O personagem que um jogador criou pelo convite vira ficha de jogador no grupo, e ganha a ficha
 * no Mundo (um personagem só). Entram só os atributos e os campos que o sistema do grupo tem,
 * dentro do mínimo e do máximo. Se o grupo já tem um personagem com esse nome (o pedido chegou
 * duas vezes, ou o mestre já tinha criado), nada muda. `null` = não entrou.
 */
export function acceptSheet(universe: Universe, groupId: string, incoming: TableSheet): { universe: Universe; sheetId: string } | null {
  const group = universe.groups.find((g) => g.id === groupId)
  const name = incoming.name.trim()
  if (!group || !name) return null
  const mine = playerSheets(universe, groupId)
  if (mine.length >= MAX_PLAYER_SHEETS || mine.some((s) => fold(s.name) === fold(name))) return null
  const system = universe.systems.find((s) => s.id === group.systemId) ?? null
  const draft = draftSheet(name, system, { role: 'pj', groupId, player: incoming.player.trim() })
  for (const [id, value] of incoming.attrs) {
    const a = system?.attributes.find((x) => x.id === id)
    if (a) draft.attributes[id] = Math.min(a.max, Math.max(a.min, value))
  }
  for (const [key, value] of incoming.fields) if (key in draft.fields) draft.fields[key] = value
  const [next, sheet] = insert(universe, 'sheets', draft)
  return { universe: linkToWorld(next, sheet.id), sheetId: sheet.id }
}
