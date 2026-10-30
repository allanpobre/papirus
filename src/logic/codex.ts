import { unmarkReveals } from './reveals'
import { kindLabel, kindPlural } from '../model/labels'
import type { AtlasMap, Entity, Fact, Relation, Revelation, Seed, Sheet, TimelineEvent, Universe } from '../model/schema'
import { byId, entityName } from '../model/universe'
import { stripSecrets } from './secrets'

const DEPTH_RANK: Record<Revelation['depth'], number> = { nome: 0, resumo: 1, completo: 2 }

export interface CodexEntry {
  entity: Entity
  depth: Revelation['depth']
}

export interface Codex {
  entries: CodexEntry[]
  facts: Fact[]
  events: TimelineEvent[]
  clues: { seed: Seed; clue: Seed['clues'][number] }[]
  /** Mapas revelados, com os marcadores que a mesa conhece. */
  maps: { map: AtlasMap; pins: AtlasMap['pins'] }[]
  /** Fichas dos personagens dos jogadores (se a mesa mostra). */
  sheets: Sheet[]
  /** Ligações reveladas (quem conhece quem, quem serve a quem…). */
  relations: Relation[]
  /** O que foi revelado na sessão mais recente (para destacar como novo). */
  fresh: Set<string>
}

/**
 * O que um grupo de jogadores já descobriu. Só entra o que o mestre revelou
 * explicitamente; nada é inferido. Com `untilSession`, considera apenas as
 * revelações feitas até aquela sessão (inclusive) e as que não têm sessão.
 */
export function codexFor(universe: Universe, groupId: string, untilSession?: number): Codex {
  const sessionNumber = (id: string | null) =>
    id === null ? -Infinity : (byId(universe, 'sessions', id)?.number ?? -Infinity)

  const revs = universe.revelations.filter(
    (r) => r.groupId === groupId && (untilSession === undefined || sessionNumber(r.sessionId) <= untilSession),
  )

  const depth = new Map<string, Revelation['depth']>()
  const ids: Record<Exclude<Revelation['target'], 'entidade'>, Set<string>> = {
    fato: new Set(),
    evento: new Set(),
    pista: new Set(),
    mapa: new Set(),
    marcador: new Set(),
    relacao: new Set(),
  }
  for (const r of revs) {
    if (r.target !== 'entidade') {
      ids[r.target].add(r.targetId)
      continue
    }
    const prev = depth.get(r.targetId)
    if (!prev || DEPTH_RANK[r.depth] > DEPTH_RANK[prev]) depth.set(r.targetId, r.depth)
  }

  const entries = [...depth.entries()]
    .map(([id, d]) => ({ entity: byId(universe, 'entities', id)!, depth: d }))
    .filter((e) => e.entity)
    .sort((a, b) => a.entity.name.localeCompare(b.entity.name, 'pt'))

  const clues = universe.seeds.flatMap((seed) => seed.clues.filter((c) => ids.pista.has(c.id)).map((clue) => ({ seed, clue })))
  // Um marcador aparece se foi revelado, ou se a ficha do lugar já é conhecida.
  const maps = universe.maps
    .filter((m) => ids.mapa.has(m.id))
    .map((map) => ({ map, pins: map.pins.filter((p) => ids.marcador.has(p.id) || depth.has(p.entityId)) }))
  const group = byId(universe, 'groups', groupId)
  const sheets = group?.showSheetsInCodex ? universe.sheets.filter((s) => s.groupId === groupId && s.role === 'pj') : []

  // Novidades: o que entrou na última sessão com revelações.
  const latest = Math.max(-Infinity, ...revs.filter((r) => r.sessionId).map((r) => sessionNumber(r.sessionId)))
  const fresh = new Set(Number.isFinite(latest) ? revs.filter((r) => sessionNumber(r.sessionId) === latest).map((r) => r.targetId) : [])

  return {
    relations: universe.relations.filter((r) => ids.relacao.has(r.id)),
    fresh,
    entries,
    facts: universe.facts.filter((f) => ids.fato.has(f.id)),
    events: universe.events.filter((e) => ids.evento.has(e.id)).sort((a, b) => a.year - b.year),
    clues,
    maps,
    sheets,
  }
}

/** Nome legível do que foi revelado. */
export function revelationLabel(universe: Universe, r: Revelation): string {
  switch (r.target) {
    case 'entidade':
      return byId(universe, 'entities', r.targetId)?.name ?? 'Ficha removida'
    case 'fato': {
      const f = byId(universe, 'facts', r.targetId)
      return f ? factSentence(universe, f) : 'Fato removido'
    }
    case 'evento':
      return byId(universe, 'events', r.targetId)?.title ?? 'Evento removido'
    case 'pista': {
      for (const s of universe.seeds) {
        const c = s.clues.find((x) => x.id === r.targetId)
        if (c) return `Pista: ${c.text}`
      }
      return 'Pista removida'
    }
    case 'mapa':
      return `Mapa: ${byId(universe, 'maps', r.targetId)?.name ?? 'removido'}`
    case 'relacao': {
      const rel = byId(universe, 'relations', r.targetId)
      return rel ? `Ligação: ${entityName(universe, rel.fromId)} ${rel.type} ${entityName(universe, rel.toId)}` : 'Ligação removida'
    }
    case 'marcador': {
      for (const m of universe.maps) {
        const p = m.pins.find((x) => x.id === r.targetId)
        if (p) return `Marcador: ${p.label || entityName(universe, p.entityId)} (${m.name})`
      }
      return 'Marcador removido'
    }
  }
}

/** Texto de um fato, na forma "Sujeito relação valor". */
export function factSentence(universe: Universe, f: Fact): string {
  const subject = entityName(universe, f.subjectId)
  const object = f.objectId ? entityName(universe, f.objectId) : f.value
  return [subject, f.predicate, object].filter((x) => x && x.trim()).join(' ').trim() || f.quote
}

/** Codex do grupo em Markdown, pronto para entregar aos jogadores. */
export function codexMarkdown(universe: Universe, groupId: string, untilSession?: number): string {
  const group = byId(universe, 'groups', groupId)
  const { entries, facts, events, clues, maps, sheets, relations } = codexFor(universe, groupId, untilSession)
  const lines = [`# Codex — ${group?.name ?? 'Jogadores'}`, '']

  const kinds = [...new Set(entries.map((e) => e.entity.kind))]
  for (const kind of kinds) {
    lines.push(`## ${kindPlural(kind)}`, '')
    for (const { entity, depth } of entries.filter((e) => e.entity.kind === kind)) {
      lines.push(`### ${entity.name}`)
      // Trechos marcados como segredo nunca vão para os jogadores.
      const summary = unmarkReveals(stripSecrets(entity.summary))
      const description = unmarkReveals(stripSecrets(entity.description))
      if (depth !== 'nome' && summary) lines.push('', summary)
      if (depth === 'completo' && description) lines.push('', description)
      lines.push('')
    }
  }
  if (facts.length) {
    lines.push('## O que sabemos', '')
    for (const f of facts) {
      const t = playerTag(universe, f)
      const tag = t ? ` _(${t})_` : ''
      lines.push(`- ${factSentence(universe, f)}${tag}`)
    }
    lines.push('')
  }
  if (relations.length) {
    const known = new Set(entries.map((e) => e.entity.id))
    lines.push('## Ligações', '')
    for (const r of relations) {
      const via = r.via.filter((v) => known.has(v.entityId)).map((v) => `${v.role || 'com'} ${entityName(universe, v.entityId)}`)
      lines.push(`- ${entityName(universe, r.fromId)} ${r.type} ${entityName(universe, r.toId)}${via.length ? `, ${via.join(', ')}` : ''}`)
    }
    lines.push('')
  }
  if (events.length) {
    lines.push('## Linha do tempo', '')
    for (const e of events) lines.push(`- ${e.endYear !== null ? `${e.year}–${e.endYear}` : e.year}: ${e.title}`)
    lines.push('')
  }
  if (clues.length) {
    lines.push('## Pistas', '')
    for (const { seed, clue } of clues) lines.push(`- ${clue.text}${seed.kind === 'misterio' ? ` _(${seed.title})_` : ''}`)
    lines.push('')
  }
  if (maps.length) {
    lines.push('## Mapas', '')
    for (const { map, pins } of maps) lines.push(`- ${map.name}: ${pins.map((p) => p.label || entityName(universe, p.entityId)).join(', ') || 'sem marcadores conhecidos'}`)
    lines.push('')
  }
  if (sheets.length) {
    lines.push('## O grupo', '')
    for (const s of sheets) {
      const system = universe.systems.find((x) => x.id === s.systemId)
      lines.push(`### ${s.name}${s.player ? ` (${s.player})` : ''}`)
      const fields = Object.entries(s.fields).filter(([, v]) => v.trim())
      if (fields.length) lines.push('', fields.map(([k, v]) => `${k}: ${v}`).join(' · '))
      if (system?.attributes.length) lines.push('', system.attributes.map((a) => `${a.abbr} ${s.attributes[a.id] ?? a.default}`).join(' · '))
      lines.push('')
    }
  }
  if (!entries.length && !facts.length && !events.length && !clues.length && !maps.length && !sheets.length) lines.push('_Nada foi revelado ainda._', '')
  return lines.join('\n')
}

export { kindLabel }

/**
 * Como os jogadores veem a natureza de um fato revelado. Mentira e segredo nunca
 * aparecem como tais: mostram só quem disse. Boatos e lendas mantêm o rótulo.
 */
const PLAYER_CANON: Partial<Record<Fact['canon'], string>> = { rumor: 'rumor', lenda: 'lenda', disputado: 'disputado', desconhecido: 'desconhecido' }

export function playerTag(universe: Universe, f: Fact): string {
  const who = f.speakerId ? `segundo ${entityName(universe, f.speakerId)}` : ''
  if (f.canon === 'estabelecido' || f.canon === 'falso' || f.canon === 'secreto') return who
  return [PLAYER_CANON[f.canon], who].filter(Boolean).join(', ')
}
