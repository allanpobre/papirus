import { CANON_LABEL, kindLabel, kindPlural } from '../model/labels'
import type { Entity, Fact, Revelation, Universe } from '../model/schema'
import { byId, entityName } from '../model/universe'

const DEPTH_RANK: Record<Revelation['depth'], number> = { nome: 0, resumo: 1, completo: 2 }

export interface CodexEntry {
  entity: Entity
  depth: Revelation['depth']
}

export interface Codex {
  entries: CodexEntry[]
  facts: Fact[]
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
  const factIds = new Set<string>()
  for (const r of revs) {
    if (r.target === 'fato') {
      factIds.add(r.targetId)
      continue
    }
    const prev = depth.get(r.targetId)
    if (!prev || DEPTH_RANK[r.depth] > DEPTH_RANK[prev]) depth.set(r.targetId, r.depth)
  }

  const entries = [...depth.entries()]
    .map(([id, d]) => ({ entity: byId(universe, 'entities', id)!, depth: d }))
    .filter((e) => e.entity)
    .sort((a, b) => a.entity.name.localeCompare(b.entity.name, 'pt'))

  return { entries, facts: universe.facts.filter((f) => factIds.has(f.id)) }
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
  const { entries, facts } = codexFor(universe, groupId, untilSession)
  const lines = [`# Codex — ${group?.name ?? 'Jogadores'}`, '']

  const kinds = [...new Set(entries.map((e) => e.entity.kind))]
  for (const kind of kinds) {
    lines.push(`## ${kindPlural(kind)}`, '')
    for (const { entity, depth } of entries.filter((e) => e.entity.kind === kind)) {
      lines.push(`### ${entity.name}`)
      if (depth !== 'nome' && entity.summary.trim()) lines.push('', entity.summary.trim())
      if (depth === 'completo' && entity.description.trim()) lines.push('', entity.description.trim())
      lines.push('')
    }
  }
  if (facts.length) {
    lines.push('## O que sabemos', '')
    for (const f of facts) {
      const tag = f.canon === 'estabelecido' ? '' : ` _(${CANON_LABEL[f.canon].toLowerCase()})_`
      lines.push(`- ${factSentence(universe, f)}${tag}`)
    }
    lines.push('')
  }
  if (!entries.length && !facts.length) lines.push('_Nada foi revelado ainda._', '')
  return lines.join('\n')
}

export { kindLabel }
