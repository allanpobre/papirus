import type { Fact, Knowledge, Universe } from '../model/schema'
import { manuscriptOrder } from '../model/universe'

/** Posição de cada cena na ordem de leitura. */
export function sceneIndex(universe: Universe): Map<string, number> {
  return new Map(manuscriptOrder(universe).map((s, i) => [s.id, i]))
}

/**
 * O que uma ficha (personagem ou grupo) sabe, suspeita ou acredita no ponto da
 * cena indicada. Sem cena, considera tudo. Para cada fato vale o registro mais
 * recente até aquele ponto (alguém pode saber e depois esquecer).
 */
export function knowledgeAt(
  universe: Universe,
  holderId: string,
  sceneId: string | null,
): { fact: Fact; entry: Knowledge }[] {
  const index = sceneIndex(universe)
  const limit = sceneId === null ? Infinity : (index.get(sceneId) ?? Infinity)
  const pos = (k: Knowledge) => (k.sinceSceneId === null ? -1 : (index.get(k.sinceSceneId) ?? -1))

  const latest = new Map<string, Knowledge>()
  for (const k of universe.knowledge) {
    if (k.holderId !== holderId || pos(k) > limit) continue
    const prev = latest.get(k.factId)
    if (!prev || pos(k) >= pos(prev)) latest.set(k.factId, k)
  }

  const facts = new Map(universe.facts.map((f) => [f.id, f]))
  return [...latest.values()]
    .filter((k) => k.state !== 'esqueceu' && facts.has(k.factId))
    .map((entry) => ({ fact: facts.get(entry.factId)!, entry }))
}

/**
 * O que o leitor já pode saber ao terminar a cena indicada: fatos cuja fonte é
 * uma cena até aquele ponto. Fatos sem fonte no texto ficam de fora (são só do autor).
 */
export function readerKnowsAt(universe: Universe, sceneId: string): Fact[] {
  const index = sceneIndex(universe)
  const limit = index.get(sceneId)
  if (limit === undefined) return []
  return universe.facts.filter((f) => {
    const i = f.sourceSceneId === null ? undefined : index.get(f.sourceSceneId)
    return i !== undefined && i <= limit
  })
}

/** Quem sabe algo sobre um fato, com o estado atual de cada um. */
export function holdersOf(universe: Universe, factId: string): Knowledge[] {
  return universe.knowledge.filter((k) => k.factId === factId)
}
