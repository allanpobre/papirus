import { describe, expect, it } from 'vitest'
import {
  addScene,
  addStory,
  createUniverse,
  removeScene,
  removeStory,
  renameStory,
  scenesOf,
  updateScene,
} from './universe'

describe('operações do universo', () => {
  it('cria cenas soltas e cenas de história com ordem própria', () => {
    const [u1, story] = addStory(createUniverse())
    const [u2, a] = addScene(u1, story.id)
    const [u3, b] = addScene(u2, story.id)
    const [u4, loose] = addScene(u3, null)

    expect(scenesOf(u4, story.id).map((s) => s.id)).toEqual([a.id, b.id])
    expect(scenesOf(u4, null).map((s) => s.id)).toEqual([loose.id])
    expect([a.order, b.order, loose.order]).toEqual([0, 1, 0])
  })

  it('não altera o universo original', () => {
    const u = createUniverse()
    const [next] = addScene(u, null)
    expect(u.scenes).toHaveLength(0)
    expect(next.scenes).toHaveLength(1)
  })

  it('atualiza título e texto de uma cena mantendo o ID', () => {
    const [u, scene] = addScene(createUniverse(), null)
    const next = updateScene(u, scene.id, { title: 'Capítulo 1', text: 'Era uma vez' })
    expect(next.scenes[0]).toMatchObject({ id: scene.id, title: 'Capítulo 1', text: 'Era uma vez' })
  })

  it('remover uma história não apaga suas cenas: elas viram cenas soltas', () => {
    const [u1, story] = addStory(createUniverse())
    const [u2] = addScene(u1, null)
    const [u3, s] = addScene(u2, story.id)
    const next = removeStory(u3, story.id)

    expect(next.stories).toHaveLength(0)
    expect(next.scenes).toHaveLength(2)
    expect(scenesOf(next, null).map((x) => x.id)).toContain(s.id)
    expect(new Set(scenesOf(next, null).map((x) => x.order)).size).toBe(2)
  })

  it('renomeia história e remove cena', () => {
    const [u1, story] = addStory(createUniverse())
    const [u2, scene] = addScene(renameStory(u1, story.id, 'Livro'), story.id)
    expect(u2.stories[0].title).toBe('Livro')
    expect(removeScene(u2, scene.id).scenes).toHaveLength(0)
  })
})

import {
  byId,
  draftEntity,
  draftEvent,
  draftFact,
  draftKnowledge,
  draftRelation,
  draftSeed,
  forkUniverse,
  insert,
  manuscriptOrder,
  moveScene,
  moveSceneTo,
  removeEntity,
  removeFact,
} from './universe'

describe('fichas e referências', () => {
  const setup = () => {
    let u = createUniverse()
    let kael, ostria, vaelor, scene, fact
    ;[u, kael] = insert(u, 'entities', draftEntity('personagem', 'Kael'))
    ;[u, vaelor] = insert(u, 'entities', draftEntity('personagem', 'Vaelor'))
    ;[u, ostria] = insert(u, 'entities', { ...draftEntity('lugar', 'Ostria') })
    ;[u] = insert(u, 'relations', draftRelation(kael.id, vaelor.id, 'rival de'))
    ;[u, scene] = addScene(u, null)
    u = updateScene(u, scene.id, { povId: kael.id, placeId: ostria.id, presentIds: [kael.id, vaelor.id] })
    ;[u] = insert(u, 'events', { ...draftEvent('Queda', 340), entityIds: [kael.id], placeId: ostria.id })
    ;[u, fact] = insert(u, 'facts', draftFact({ subjectId: kael.id, objectId: ostria.id, predicate: 'nasceu em' }))
    ;[u] = insert(u, 'knowledge', draftKnowledge(kael.id, fact.id))
    ;[u] = insert(u, 'seeds', { ...draftSeed('Cicatriz'), entityIds: [kael.id] })
    return { u, kael, ostria, vaelor, scene, fact }
  }

  it('remover uma ficha limpa as referências sem apagar cenas, eventos ou fatos', () => {
    const { u, kael, vaelor, scene } = setup()
    const next = removeEntity(u, kael.id)

    expect(next.entities.map((e) => e.name)).toEqual(['Vaelor', 'Ostria'])
    expect(next.relations).toHaveLength(0)
    expect(byId(next, 'scenes', scene.id)).toMatchObject({ povId: null, presentIds: [vaelor.id] })
    expect(next.events[0].entityIds).toEqual([])
    expect(next.facts[0].subjectId).toBeNull()
    expect(next.knowledge).toHaveLength(0)
    expect(next.seeds[0].entityIds).toEqual([])
  })

  it('remover um fato remove também quem sabia dele', () => {
    const { u, fact } = setup()
    const next = removeFact(u, fact.id)
    expect(next.facts).toHaveLength(0)
    expect(next.knowledge).toHaveLength(0)
  })

  it('remover uma cena limpa a fonte dos fatos', () => {
    const { u, scene, fact } = setup()
    const withSource = updateScene(u, scene.id, {})
    const linked = { ...withSource, facts: withSource.facts.map((f) => ({ ...f, sourceSceneId: scene.id })) }
    expect(byId(removeScene(linked, scene.id), 'facts', fact.id)?.sourceSceneId).toBeNull()
  })

  it('cria um "E se…?" com novo ID e o mesmo conteúdo', () => {
    const { u } = setup()
    const fork = forkUniverse(u, 'E se Kael morresse?')
    expect(fork.id).not.toBe(u.id)
    expect(fork.entities).toEqual(u.entities)
    expect(fork.entities).not.toBe(u.entities)
  })
})

describe('ordem do manuscrito', () => {
  it('ordena histórias e depois cenas soltas, e move cenas', () => {
    let [u, story] = addStory(createUniverse())
    let a, b, c
    ;[u, a] = addScene(u, story.id, 'A')
    ;[u, b] = addScene(u, story.id, 'B')
    ;[u, c] = addScene(u, null, 'C')
    expect(manuscriptOrder(u).map((s) => s.title)).toEqual(['A', 'B', 'C'])

    u = moveScene(u, b.id, -1)
    expect(manuscriptOrder(u).map((s) => s.title)).toEqual(['B', 'A', 'C'])
    expect(moveScene(u, b.id, -1)).toBe(u)

    u = moveSceneTo(u, c.id, story.id)
    expect(manuscriptOrder(u).map((s) => s.title)).toEqual(['B', 'A', 'C'])
    expect(byId(u, 'scenes', c.id)?.storyId).toBe(story.id)
    void a
  })
})
