import { roll } from '../logic/dice'
import type { GameSystem, Monster, Session, Universe } from '../model/schema'
import { byId, newId, patch, type Draft } from '../model/universe'
import { parseHp } from './combat'
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
  }))
  return patch(u, 'sessions', s.id, { initiative: [...s.initiative, ...entries] })
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
