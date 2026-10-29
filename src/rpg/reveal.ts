import { codexFor } from '../logic/codex'
import type { Entity, Fact, Revelation, Universe } from '../model/schema'
import { draftRevelation, insert } from '../model/universe'

const DEEPER: Record<Revelation['depth'], Revelation['depth'] | null> = { nome: 'resumo', resumo: 'completo', completo: null }

/** O próximo passo de quem a mesa conhece só em parte: do nome ao resumo, do resumo a tudo. */
export const deeper = (depth: Revelation['depth']) => DEEPER[depth]

/**
 * O que a mesa ainda não sabe e o mestre guardou como segredo (fichas e fatos secretos ou
 * desconhecidos), e quem ela conhece só em parte.
 */
export function keptSecrets(u: Universe, groupId: string): { entities: Entity[]; facts: Fact[]; partial: { entity: Entity; depth: Revelation['depth'] }[] } {
  const codex = codexFor(u, groupId)
  const known = new Set(codex.entries.map((e) => e.entity.id))
  const knownFacts = new Set(codex.facts.map((f) => f.id))
  return {
    entities: u.entities.filter((e) => (e.canon === 'secreto' || e.canon === 'desconhecido') && !known.has(e.id)).sort((a, b) => a.name.localeCompare(b.name, 'pt')),
    facts: u.facts.filter((f) => f.canon === 'secreto' && !knownFacts.has(f.id)),
    partial: codex.entries.filter((e) => e.depth !== 'completo'),
  }
}

/** Revela agora, na sessão em andamento (ou sem sessão): uma ficha até a profundidade pedida, ou um fato. */
export function revealNow(u: Universe, groupId: string, sessionId: string | null, target: 'entidade' | 'fato', targetId: string, depth: Revelation['depth'] = 'resumo'): Universe {
  return insert(u, 'revelations', { ...draftRevelation(groupId, target, targetId, sessionId), depth: target === 'entidade' ? depth : 'completo' })[0]
}
