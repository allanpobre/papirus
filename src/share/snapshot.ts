import { unmarkReveals } from '../logic/reveals'
import { codexFor, factSentence, playerTag } from '../logic/codex'
import { stripSecrets } from '../logic/secrets'
import { formatYear, kindPlural } from '../model/labels'
import type { GameSystem, Sheet, Universe } from '../model/schema'
import { byId, entityName } from '../model/universe'
import { mesaTheme } from '../rpg/themes'
import { bonusLabel, expandFormula, skillExpression } from '../rpg/rolls'
import { costResource, isPool } from '../rpg/sheets'

/**
 * O Codex de uma mesa como os jogadores o veem, em dados simples e já filtrados:
 * só o que foi revelado, sem trechos secretos, sem rótulo de mentira. É isto que
 * vai para o servidor; nada do universo além disto sai do computador do mestre.
 */
export interface CodexSnapshot {
  v: 1
  universe: string
  group: string
  at: string
  party: {
    name: string
    player: string
    fields: [string, string][]
    attrs: [string, number][]
    /** A ficha toda, só para consulta (retratos antigos não têm). */
    image?: string
    pools?: [string, number, number][]
    values?: [string, number][]
    conditions?: string[]
    skills?: [string, string][]
    attacks?: { name: string; test: string; damage: string; critical: string }[]
    abilities?: { name: string; cost: string; text: string }[]
    inventory?: [string, number][]
  }[]
  sections: { title: string; entries: { name: string; summary: string; description: string; depth: 'nome' | 'resumo' | 'completo'; fresh?: boolean; image?: string }[] }[]
  events: { when: string; title: string; year?: number; fresh?: boolean }[]
  /** Ligações reveladas, pelo nome (opcional: retratos antigos não têm). */
  relations?: { from: string; to: string; text: string; fresh?: boolean }[]
  facts: { text: string; tag: string }[]
  clues: { text: string; mystery: string }[]
  maps: { name: string; image: string; width: number; height: number; pins: { x: number; y: number; label: string }[] }[]
  /** Tema da mesa (cores por gênero) escolhido pelo mestre; os jogadores só escolhem claro ou escuro. */
  theme?: string | null
}

export function codexSnapshot(universe: Universe, groupId: string, untilSession?: number): CodexSnapshot {
  const codex = codexFor(universe, groupId, untilSession)
  const group = byId(universe, 'groups', groupId)
  const system = group?.systemId ? universe.systems.find((x) => x.id === group.systemId) : undefined
  const suffix = universe.settings.calendarSuffix
  const kinds = [...new Set(codex.entries.map((e) => e.entity.kind))]

  return {
    v: 1,
    universe: universe.name,
    group: group?.name ?? '',
    theme: mesaTheme(group?.theme, system?.name),
    at: new Date().toISOString(),
    party: codex.sheets.map((s) => {
      const system = universe.systems.find((x) => x.id === s.systemId)
      const res = (id: string, def: number) => s.resources[id] ?? { current: def, max: def }
      const cost = costResource(system)
      const signed = (n: number) => (n >= 0 ? `+${n}` : String(n))
      const portrait = s.image ?? (s.entityId ? byId(universe, 'entities', s.entityId)?.image : null)
      return {
        name: s.name,
        player: s.player,
        fields: Object.entries(s.fields).filter(([, v]) => v.trim()),
        attrs: (system?.attributes ?? []).map((a) => [a.abbr, s.attributes[a.id] ?? a.default] as [string, number]),
        ...(portrait ? { image: portrait } : {}),
        pools: (system?.resources ?? []).filter(isPool).map((r) => [r.abbr, res(r.id, r.default).current, res(r.id, r.default).max] as [string, number, number]),
        values: (system?.resources ?? []).filter((r) => !isPool(r)).map((r) => [r.abbr, res(r.id, r.default).current] as [string, number]),
        conditions: s.conditions,
        skills: system ? system.skills.filter((k) => (s.skills[k.id] ?? 0) !== 0).map((k) => [k.name, bonusLabel(skillExpression(system, s, k.id))] as [string, string]) : [],
        attacks: (s.attacks ?? []).map((a) => ({ name: a.name, test: system?.resolution === 'total' ? signed(a.bonus) : '', damage: damageText(a.damage, system, s), critical: a.critical })),
        abilities: (s.abilities ?? []).map((a) => ({ name: a.name, cost: a.cost > 0 && cost ? `${a.cost} ${cost.abbr}` : '', text: a.text })),
        inventory: (s.inventory ?? []).map((i) => [i.name, i.qty] as [string, number]),
      }
    }),
    sections: kinds.map((k) => ({
      title: kindPlural(k),
      entries: codex.entries
        .filter((e) => e.entity.kind === k)
        .map(({ entity, depth }) => ({
          name: entity.name,
          depth,
          fresh: codex.fresh.has(entity.id),
          summary: depth === 'nome' ? '' : unmarkReveals(stripSecrets(entity.summary)),
          description: depth === 'completo' ? unmarkReveals(stripSecrets(entity.description)) : '',
          // O retrato aparece quando a mesa já sabe mais que o nome.
          ...(depth !== 'nome' && entity.image ? { image: entity.image } : {}),
        })),
    })),
    events: codex.events.map((e) => ({
      when: e.endYear !== null ? `${formatYear(e.year, suffix)} – ${formatYear(e.endYear, suffix)}` : formatYear(e.year, suffix),
      title: e.title,
      year: e.year,
      fresh: codex.fresh.has(e.id),
    })),
    relations: codex.relations.map((r) => {
      // Quem está por trás só aparece se a mesa já conhece essa ficha.
      const known = new Set(codex.entries.map((e) => e.entity.id))
      const via = r.via.filter((v) => known.has(v.entityId)).map((v) => `${v.role || 'com'} ${entityName(universe, v.entityId)}`)
      const from = entityName(universe, r.fromId)
      const to = entityName(universe, r.toId)
      return { from, to, text: `${from} ${r.type} ${to}${via.length ? `, ${via.join(', ')}` : ''}`, fresh: codex.fresh.has(r.id) }
    }),
    facts: codex.facts.map((f) => ({ text: factSentence(universe, f), tag: playerTag(universe, f) })),
    clues: codex.clues.map(({ seed, clue }) => ({ text: clue.text, mystery: seed.kind === 'misterio' ? seed.title : '' })),
    maps: codex.maps.map(({ map, pins }) => ({
      name: map.name,
      image: map.image,
      width: map.width,
      height: map.height,
      pins: pins.map((p) => ({ x: p.x, y: p.y, label: p.label || entityName(universe, p.entityId) })),
    })),
  }
}

export const isEmptySnapshot = (s: CodexSnapshot) =>
  !s.party.length && !s.sections.length && !s.events.length && !s.facts.length && !s.clues.length && !s.maps.length && !(s.relations ?? []).length

/** Compara dois retratos ignorando a hora, para saber se vale publicar de novo. */
export const sameContent = (a: CodexSnapshot, b: CodexSnapshot) => JSON.stringify({ ...a, at: '' }) === JSON.stringify({ ...b, at: '' })

/** Dano com os atributos já trocados pelos números ("1d8+{FOR}" vira "1d8+3"). */
function damageText(damage: string, system: GameSystem | undefined, sheet: Sheet): string {
  if (!system || !damage.trim()) return damage
  try {
    return expandFormula(damage, { system, sheet })
  } catch {
    return damage
  }
}
