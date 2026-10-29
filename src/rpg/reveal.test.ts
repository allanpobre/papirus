import { describe, expect, it } from 'vitest'
import { createUniverse, draftEntity, draftFact, draftGroup, insert, patch } from '../model/universe'
import { codexSnapshot, revealedSince } from '../share/snapshot'
import { deeper, keptSecrets, revealNow } from './reveal'

function world() {
  let u = createUniverse('Ostria')
  let g, palido, rhea, porto
  ;[u, g] = insert(u, 'groups', draftGroup('Mesa de sexta'))
  ;[u, palido] = insert(u, 'entities', { ...draftEntity('personagem', 'Homem Pálido'), canon: 'secreto' as const })
  ;[u, rhea] = insert(u, 'entities', draftEntity('personagem', 'Rhea'))
  ;[u, porto] = insert(u, 'entities', draftEntity('lugar', 'Porto'))
  let fact
  ;[u, fact] = insert(u, 'facts', draftFact({ subjectId: rhea.id, predicate: 'trouxe', value: 'o Homem Pálido' }))
  u = patch(u, 'facts', fact.id, { canon: 'secreto' })
  return { u, g: g.id, palido: palido.id, rhea: rhea.id, porto: porto.id, fact: fact.id }
}

describe('segredos à mão na mesa', () => {
  it('guardados: fichas e fatos secretos que a mesa não sabe; e quem ela conhece só em parte', () => {
    const w = world()
    let u = revealNow(w.u, w.g, null, 'entidade', w.rhea, 'nome')
    const kept = keptSecrets(u, w.g)
    expect(kept.entities.map((e) => e.name)).toEqual(['Homem Pálido'])
    expect(kept.facts.map((f) => f.id)).toEqual([w.fact])
    expect(kept.partial.map((p) => [p.entity.name, p.depth])).toEqual([['Rhea', 'nome']])

    u = revealNow(u, w.g, null, 'entidade', w.palido, 'resumo')
    u = revealNow(u, w.g, null, 'fato', w.fact)
    u = revealNow(u, w.g, null, 'entidade', w.rhea, deeper('nome')!)
    const after = keptSecrets(u, w.g)
    expect(after.entities).toEqual([])
    expect(after.facts).toEqual([])
    expect(after.partial.map((p) => [p.entity.name, p.depth])).toEqual([
      ['Homem Pálido', 'resumo'],
      ['Rhea', 'resumo'],
    ])
    expect(deeper('completo')).toBeNull()
  })

  it('o celular sabe o que acabou de ser revelado', () => {
    const w = world()
    const before = codexSnapshot(w.u, w.g)
    let u = revealNow(w.u, w.g, null, 'entidade', w.palido, 'nome')
    const mid = codexSnapshot(u, w.g)
    expect(revealedSince(before, mid)).toEqual(['Homem Pálido'])
    u = revealNow(u, w.g, null, 'entidade', w.palido, 'resumo')
    u = revealNow(u, w.g, null, 'entidade', w.porto, 'nome')
    expect(revealedSince(mid, codexSnapshot(u, w.g))).toEqual(['mais sobre Homem Pálido', 'Porto'])
    expect(revealedSince(mid, mid)).toEqual([])
  })
})
