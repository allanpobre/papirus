import { CANON_LABEL, formatYear, kindLabel, KNOWLEDGE_LABEL } from '../model/labels'
import type { Entity, Universe } from '../model/schema'
import { byId, entityName, manuscriptOrder } from '../model/universe'
import { factSentence } from './codex'
import { MentionMatcher } from './detection'
import { searchUniverse } from './search'
import { snippet } from './text'

export interface ContextOptions {
  /** Inclui fichas, fatos e relações marcados como secretos. */
  includeSecrets: boolean
  /** Inclui trechos do texto das cenas (texto livre do autor). */
  includeManuscript: boolean
  /** Fichas sempre incluídas, além das encontradas pela pergunta. */
  pinnedIds?: string[]
}

export interface ArchivistContext {
  /** Texto exato que será enviado ao modelo. */
  text: string
  entityIds: string[]
  /** Quantos registros ficaram de fora por serem secretos. */
  hiddenSecrets: number
}

const MAX_ENTITIES = 14
const MAX_SCENE_SNIPPETS = 6

/**
 * Monta o contexto enviado ao Archivist a partir dos registros relevantes para a
 * pergunta. Nunca envia o universo inteiro. Segredos e texto do manuscrito só
 * entram se o autor pedir; o texto é mostrado ao autor antes do envio.
 */
export function buildArchivistContext(universe: Universe, question: string, options: ContextOptions): ArchivistContext {
  const suffix = universe.settings.calendarSuffix
  const isSecret = (canon: string) => canon === 'secreto'
  let hiddenSecrets = 0

  // Fichas citadas na pergunta, as fixadas e as encontradas pela busca.
  const picked = new Set<string>(options.pinnedIds ?? [])
  for (const m of new MentionMatcher(universe.entities).find(question)) picked.add(m.entityId)
  for (const r of searchUniverse(universe, question, 30)) if (r.kind === 'ficha') picked.add(r.id)
  // Busca por palavra, para perguntas longas.
  for (const word of question.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 4)) {
    for (const r of searchUniverse(universe, word, 8)) if (r.kind === 'ficha') picked.add(r.id)
  }
  // Vizinhos diretos das fichas citadas.
  for (const id of [...picked]) {
    for (const rel of universe.relations) {
      if (rel.fromId === id) picked.add(rel.toId)
      if (rel.toId === id) picked.add(rel.fromId)
    }
  }

  const entities: Entity[] = []
  for (const id of picked) {
    const e = byId(universe, 'entities', id)
    if (!e) continue
    if (isSecret(e.canon) && !options.includeSecrets) {
      hiddenSecrets++
      continue
    }
    entities.push(e)
    if (entities.length >= MAX_ENTITIES) break
  }
  const ids = new Set(entities.map((e) => e.id))

  const lines: string[] = []
  lines.push(`# Universo: ${universe.name}`)
  if (universe.description) lines.push(universe.description)
  if (suffix) lines.push(`Calendário: anos seguidos de “${suffix}”.`)

  lines.push('', '## Fichas')
  if (!entities.length) lines.push('(nenhuma ficha relevante encontrada)')
  for (const e of entities) {
    const span = [formatYear(e.startYear, suffix), formatYear(e.endYear, suffix)].filter(Boolean).join(' – ')
    lines.push(`### ${e.name} (${kindLabel(e.kind)}; canon: ${CANON_LABEL[e.canon]})`)
    if (e.aliases.length) lines.push(`Outros nomes: ${e.aliases.join(', ')}`)
    if (e.parentId) lines.push(`Fica em: ${entityName(universe, e.parentId)}`)
    if (span) lines.push(`Período: ${span}`)
    if (e.summary) lines.push(`Resumo: ${e.summary}`)
    if (e.description) lines.push(`Descrição: ${e.description}`)
    for (const f of e.fields) if (f.key || f.value) lines.push(`${f.key}: ${f.value}`)
    if (e.tags.length) lines.push(`Etiquetas: ${e.tags.join(', ')}`)
  }

  const relations = universe.relations.filter((r) => ids.has(r.fromId) && ids.has(r.toId))
  const visibleRelations = relations.filter((r) => options.includeSecrets || !isSecret(r.canon))
  hiddenSecrets += relations.length - visibleRelations.length
  if (visibleRelations.length) {
    lines.push('', '## Relações')
    for (const r of visibleRelations) {
      lines.push(`- ${entityName(universe, r.fromId)} ${r.type} ${entityName(universe, r.toId)} (canon: ${CANON_LABEL[r.canon]})`)
    }
  }

  const facts = universe.facts.filter((f) => (f.subjectId && ids.has(f.subjectId)) || (f.objectId && ids.has(f.objectId)))
  const visibleFacts = facts.filter((f) => options.includeSecrets || !isSecret(f.canon))
  hiddenSecrets += facts.length - visibleFacts.length
  if (visibleFacts.length) {
    lines.push('', '## Fatos registrados')
    for (const f of visibleFacts) {
      const who = f.speakerId ? `segundo ${entityName(universe, f.speakerId)}` : 'segundo o narrador'
      lines.push(`- ${factSentence(universe, f)} (${who}; canon: ${CANON_LABEL[f.canon]})`)
      const holders = universe.knowledge.filter((k) => k.factId === f.id && ids.has(k.holderId))
      for (const k of holders) lines.push(`  - ${entityName(universe, k.holderId)}: ${KNOWLEDGE_LABEL[k.state].toLowerCase()}`)
    }
  }

  const events = universe.events
    .filter((ev) => ev.entityIds.some((id) => ids.has(id)) || (ev.placeId && ids.has(ev.placeId)))
    .filter((ev) => options.includeSecrets || !isSecret(ev.canon))
    .sort((a, b) => a.year - b.year)
  if (events.length) {
    lines.push('', '## Linha do tempo')
    for (const ev of events) {
      const range = ev.endYear !== null ? `${formatYear(ev.year, suffix)}–${formatYear(ev.endYear, suffix)}` : formatYear(ev.year, suffix)
      lines.push(`- ${range}: ${ev.title}${ev.description ? ` — ${ev.description}` : ''}`)
    }
  }

  const seeds = universe.seeds.filter((s) => s.entityIds.some((id) => ids.has(id)))
  if (seeds.length) {
    lines.push('', '## Tramas e mistérios')
    for (const s of seeds) lines.push(`- ${s.title} (${s.kind === 'misterio' ? 'mistério' : 'semente'}, ${s.status})${s.description ? `: ${s.description}` : ''}`)
  }

  if (options.includeManuscript && entities.length) {
    const matcher = new MentionMatcher(entities)
    const snippets: string[] = []
    for (const scene of manuscriptOrder(universe)) {
      const found = matcher.find(scene.text)
      if (!found.length) continue
      snippets.push(`- Em “${scene.title || 'Sem título'}”: ${snippet(scene.text, found[0].from, found[0].to, 160)}`)
      if (snippets.length >= MAX_SCENE_SNIPPETS) break
    }
    if (snippets.length) lines.push('', '## Trechos do manuscrito', ...snippets)
  }

  return { text: lines.join('\n'), entityIds: [...ids], hiddenSecrets }
}

/** Instruções fixas do Archivist (mantidas iguais entre perguntas). */
export const ARCHIVIST_SYSTEM = `Você é o Archivist, o arquivista de um universo ficcional dentro do Papirus, um ambiente de escrita.
O autor é quem decide o que é verdade no universo. Você ajuda a investigar a lore registrada; não inventa canon.

Responda em português, de forma direta. Organize a resposta nestas seções, omitindo as vazias:
- **Registrado**: o que os registros enviados dizem, citando o nome da ficha, fato ou evento de onde veio.
- **Inferência**: conclusões que você tira combinando registros, deixando claro que são inferências.
- **Contradições**: registros que se contradizem ou datas que não fecham.
- **Sugestões**: ideias opcionais para o autor, marcadas como sugestão.
- **Desconhecido**: o que os registros não dizem.

Respeite o canon de cada registro: rumor, lenda, disputado e falso não são verdade estabelecida; não os trate como tal.
Mistérios e lacunas podem ser intencionais; não trate ausência de informação como erro.
Use apenas o contexto enviado. Se a pergunta exigir algo que não está nele, diga isso.`
