import { roll } from '../logic/dice'
import { fold } from '../logic/text'
import type { Entity, GameSystem, Monster, Session, Universe } from '../model/schema'
import { gameOf } from './worldBonuses'
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
    // Os traços do "No jogo" (herdados da ficha do Mundo) aparecem junto do nome na iniciativa.
    note: (m.traits ?? []).join(' · '),
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
 * inimigo pronto com um toque (o nome, o resumo e o "No jogo" vêm da ficha).
 */
export function creaturesToAdd(u: Universe): Entity[] {
  // Já é inimigo se veio da ficha, ou se tem o mesmo nome (um criado à mão).
  const have = new Set(u.monsters.flatMap((m) => [fold(m.name.trim()), ...(m.entityId ? [m.entityId] : [])]))
  return u.entities
    .filter((e) => e.kind === 'especie' && e.name.trim() && e.canon !== 'falso' && !have.has(e.id) && !have.has(fold(e.name.trim())))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt'))
}

/** O que a ficha do Mundo passa ao inimigo: os traços e os modificadores do "No jogo" (vazio, se ela não tem). */
export function worldTraits(e: Entity | undefined): { traits: string[]; mods: Record<string, number> } {
  const g = gameOf(e)
  return { traits: g ? g.traits.map((t) => t.trim()).filter(Boolean) : [], mods: g ? Object.fromEntries(Object.entries(g.mods).filter(([, n]) => n !== 0)) : {} }
}

/**
 * Um inimigo pronto a partir de uma ficha do Mundo (espécie, criatura, um NPC…): o nome e o resumo vêm dela e ele
 * herda o "No jogo" (traços e modificadores). Fica ligado à ficha: se ela mudar, o inimigo acompanha (`syncMonstersFromWorld`).
 */
export function monsterFromCreature(e: Entity): Draft<'monsters'> {
  const { traits, mods } = worldTraits(e)
  return {
    ...draftMonster(e.name.trim()),
    notes: e.summary.trim(),
    entityId: e.id,
    type: e.kind === 'especie' ? 'Criatura' : '',
    level: null,
    ...(traits.length ? { traits } : {}),
    ...(Object.keys(mods).length ? { mods } : {}),
  }
}

/** Deixa os inimigos que vieram do Mundo em dia com o "No jogo" das fichas (o mesmo universo, se nada mudou). */
export function syncMonstersFromWorld(u: Universe): Universe {
  let changed = false
  const monsters = u.monsters.map((m) => {
    const e = m.entityId ? u.entities.find((x) => x.id === m.entityId) : undefined
    if (!e) return m
    const { traits, mods } = worldTraits(e)
    if (JSON.stringify(traits) === JSON.stringify(m.traits ?? []) && JSON.stringify(mods) === JSON.stringify(m.mods ?? {})) return m
    changed = true
    const next = { ...m }
    if (traits.length) next.traits = traits
    else delete next.traits
    if (Object.keys(mods).length) next.mods = mods
    else delete next.mods
    return next
  })
  return changed ? { ...u, monsters } : u
}

/** Busca e filtros do bestiário: texto (nome, tipo, notas, traços), tipo e nível. */
export function filterMonsters(monsters: Monster[], f: { text?: string; type?: string; level?: string }): Monster[] {
  const q = fold((f.text ?? '').trim())
  return monsters.filter((m) => {
    if (q && !fold([m.name, m.type ?? '', m.notes, ...(m.traits ?? [])].join(' ')).includes(q)) return false
    if (f.type && fold(m.type ?? '') !== fold(f.type)) return false
    if (f.level) {
      const lv = m.level ?? null
      if (f.level === 'sem') return lv === null
      if (lv === null) return false
      // "1-3", "4-6", "7+" ou um número só.
      const [a, b] = f.level.endsWith('+') ? [Number(f.level.slice(0, -1)), Infinity] : f.level.includes('-') ? f.level.split('-').map(Number) : [Number(f.level), Number(f.level)]
      return lv >= a && lv <= b
    }
    return true
  })
}

/** Os tipos que existem no bestiário, para o filtro (sem repetir, em ordem). */
export function monsterTypes(monsters: Monster[]): string[] {
  const seen = new Map<string, string>()
  for (const m of monsters) {
    const t = (m.type ?? '').trim()
    if (t && !seen.has(fold(t))) seen.set(fold(t), t)
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'pt'))
}
