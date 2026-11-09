import { roll } from '../logic/dice'
import { fold } from '../logic/text'
import type { Entity, GameSystem, Monster, Session, Universe } from '../model/schema'
import { byId, newId, patch, type Draft } from '../model/universe'
import { initiativeOrder, parseHp } from './combat'
import { rollInitiative } from './rolls'

type Entry = Session['initiative'][number]

export const draftMonster = (name: string): Draft<'monsters'> => ({ name, hp: 10, defense: 12, initiative: 0, attacks: [], notes: '' })

/** "Goblin 2" → "Goblin". */
export const baseName = (name: string) => name.replace(/\s+\d+$/, '').trim()

/**
 * Os nomes dos que entram: "Goblin" sozinho; vários, "Goblin 1", "Goblin 2"… continuando
 * a contagem de quem já está na iniciativa com o mesmo nome.
 */
export function monsterNames(existing: string[], name: string, count: number): string[] {
  const same = existing.filter((n) => baseName(n) === name)
  if (count === 1 && !same.length) return [name]
  const used = same.map((n) => Number(n.match(/\s(\d+)$/)?.[1] ?? 1))
  const start = Math.max(0, ...used) + 1
  return Array.from({ length: count }, (_, i) => `${name} ${start + i}`)
}

/** Põe `count` inimigos prontos na iniciativa, cada um com a sua vida, Defesa, ataques e iniciativa rolada. */
export function addMonsters(u: Universe, sessionId: string, monsterId: string, count: number, system: GameSystem | undefined, random?: () => number): Universe {
  const s = byId(u, 'sessions', sessionId)
  const m = byId(u, 'monsters', monsterId)
  if (!s || !m || count < 1) return u
  const names = monsterNames(
    s.initiative.map((e) => e.name),
    m.name,
    Math.min(20, count),
  )
  const entries: Entry[] = names.map((name) => ({
    id: newId(),
    name,
    value: (system ? rollInitiative(system, null, random) : roll('1d20', random).total) + m.initiative,
    hp: `${m.hp}/${m.hp}`,
    note: '',
    sheetId: null,
    defense: m.defense,
    attacks: m.attacks.map((a) => ({ ...a, id: newId() })),
    monsterId: m.id,
    conditions: [],
    rolled: true,
  }))
  // A vez continua com quem estava jogando, mesmo que os novos entrem antes dele na ordem.
  const list = initiativeOrder(s)
  const current = list.length ? list[s.turn % list.length] : undefined
  const initiative = [...s.initiative, ...entries]
  const turn = current ? initiativeOrder({ ...s, initiative }).findIndex((e) => e.id === current.id) : 0
  return patch(u, 'sessions', s.id, { initiative, turn: Math.max(0, turn) })
}

/** Guarda um combatente avulso no bestiário: o nome sem o número, a vida máxima, a Defesa e o ataque que ele usou. */
export function monsterFromEntry(entry: Entry, attack?: { bonus: number; damage: string } | null): Draft<'monsters'> {
  const hp = parseHp(entry.hp)
  return {
    name: baseName(entry.name) || 'Inimigo',
    hp: hp ? (hp.max ?? hp.current) : 10,
    defense: entry.defense,
    initiative: 0,
    attacks: entry.attacks.length
      ? entry.attacks
      : attack && (attack.damage.trim() || attack.bonus)
        ? [{ id: newId(), name: 'Ataque', bonus: attack.bonus, damage: attack.damage.trim(), critical: '' }]
        : [],
    notes: '',
  }
}

export const sortedMonsters = (u: Universe): Monster[] => [...u.monsters].sort((a, b) => a.name.localeCompare(b.name, 'pt'))

/**
 * As criaturas do Mundo que ainda não estão no bestiário: as fichas do tipo Espécie, para virar
 * inimigo pronto com um toque (o nome e o resumo vêm da ficha).
 */
export function creaturesToAdd(u: Universe): Entity[] {
  const have = new Set(u.monsters.map((m) => fold(m.name.trim())))
  return u.entities.filter((e) => e.kind === 'especie' && e.name.trim() && e.canon !== 'falso' && !have.has(fold(e.name.trim()))).sort((a, b) => a.name.localeCompare(b.name, 'pt'))
}

/** Um inimigo pronto a partir de uma criatura do Mundo. */
export const monsterFromCreature = (e: Entity): Draft<'monsters'> => ({ ...draftMonster(e.name.trim()), notes: e.summary.trim() })
