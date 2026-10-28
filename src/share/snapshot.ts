import { unmarkReveals } from '../logic/reveals'
import { codexFor, factSentence, playerTag } from '../logic/codex'
import { stripSecrets } from '../logic/secrets'
import { formatYear, kindPlural } from '../model/labels'
import type { Universe } from '../model/schema'
import { byId, entityName } from '../model/universe'

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
  party: { name: string; player: string; fields: [string, string][]; attrs: [string, number][] }[]
  sections: { title: string; entries: { name: string; summary: string; description: string; depth: 'nome' | 'resumo' | 'completo'; fresh?: boolean; image?: string }[] }[]
  events: { when: string; title: string; year?: number; fresh?: boolean }[]
  /** Ligações reveladas, pelo nome (opcional: retratos antigos não têm). */
  relations?: { from: string; to: string; text: string; fresh?: boolean }[]
  facts: { text: string; tag: string }[]
  clues: { text: string; mystery: string }[]
  maps: { name: string; image: string; width: number; height: number; pins: { x: number; y: number; label: string }[] }[]
}

export function codexSnapshot(universe: Universe, groupId: string, untilSession?: number): CodexSnapshot {
  const codex = codexFor(universe, groupId, untilSession)
  const suffix = universe.settings.calendarSuffix
  const kinds = [...new Set(codex.entries.map((e) => e.entity.kind))]

  return {
    v: 1,
    universe: universe.name,
    group: byId(universe, 'groups', groupId)?.name ?? '',
    at: new Date().toISOString(),
    party: codex.sheets.map((s) => {
      const system = universe.systems.find((x) => x.id === s.systemId)
      return {
        name: s.name,
        player: s.player,
        fields: Object.entries(s.fields).filter(([, v]) => v.trim()),
        attrs: (system?.attributes ?? []).map((a) => [a.abbr, s.attributes[a.id] ?? a.default] as [string, number]),
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
