import { describe, expect, it } from 'vitest'
import { ostriaUniverse as sampleUniverse } from '../model/sampleOstria'
import { addScene, addStory, createUniverse, removeEntity, removeScene, removeStory, updateScene } from '../model/universe'
import { purgeTrash, restoreTrash, revertTo, track } from './history'

describe('lixeira e histórico', () => {
  const u = sampleUniverse()
  const kael = u.entities.find((e) => e.name === 'Kael')!

  it('apagar leva o item (e o que saiu junto) para a lixeira, e dá para recuperar', () => {
    const after = track(u, removeEntity(u, kael.id), 'ana')
    expect(after.trash).toHaveLength(1)
    expect(after.trash[0].label).toMatch(/^Kael \(e \d+ ligaç/)
    expect(after.history[0]).toMatchObject({ action: 'apagou', label: 'Kael', by: 'ana' })
    const back = restoreTrash(after, after.trash[0].id, 'bia')
    expect(back.entities.some((e) => e.id === kael.id)).toBe(true)
    expect(back.relations.length).toBe(u.relations.length)
    expect(back.trash).toHaveLength(0)
    expect(back.history[0]).toMatchObject({ action: 'recuperou', by: 'bia' })
  })

  it('edições seguidas viram uma linha; dá para voltar como estava', () => {
    const [base, scene] = addScene(createUniverse(), null, 'Cena')
    const t0 = new Date('2026-01-01T10:00:00Z')
    let v = track(base, updateScene(base, scene.id, { synopsis: 'um' }), 'ana', t0)
    v = track(v, updateScene(v, scene.id, { synopsis: 'dois' }), 'ana', new Date('2026-01-01T10:05:00Z'))
    expect(v.history.filter((h) => h.recordId === scene.id)).toHaveLength(1)
    // Outra pessoa: nova linha.
    v = track(v, updateScene(v, scene.id, { synopsis: 'três' }), 'bia', new Date('2026-01-01T10:06:00Z'))
    expect(v.history.filter((h) => h.recordId === scene.id)).toHaveLength(2)
    const back = revertTo(v, v.history[0].id, 'ana')
    expect(back.scenes[0].synopsis).toBe('dois')
  })

  it('a lixeira esquece depois de 30 dias', () => {
    const after = track(u, removeEntity(u, kael.id), null, new Date('2026-01-01T00:00:00Z'))
    expect(purgeTrash(after, Date.parse('2026-01-20T00:00:00Z')).trash).toHaveLength(1)
    expect(purgeTrash(after, Date.parse('2026-02-05T00:00:00Z')).trash).toHaveLength(0)
  })

  /** Dois livros, cada um com duas cenas; a segunda cena do livro 2 é a que usamos nos testes. */
  function twoBooks() {
    let v = createUniverse()
    let a: ReturnType<typeof addStory>[1]
    let b: ReturnType<typeof addStory>[1]
    ;[v, a] = addStory(v, 'Livro 1')
    ;[v, b] = addStory(v, 'Livro 2')
    const scenes: string[] = []
    for (const [story, title] of [[a, 'A1'], [a, 'A2'], [b, 'B1'], [b, 'B2']] as const) {
      const [next, scene] = addScene(v, story.id, title)
      v = next
      scenes.push(scene.id)
    }
    return { v, a, b, scenes }
  }

  it('apagar um livro leva as cenas junto de volta: ao recuperar, cada cena volta para o livro e na ordem de antes', () => {
    const { v, b, scenes } = twoBooks()
    const before = v.scenes.filter((s) => s.storyId === b.id).map((s) => [s.id, s.order])
    const gone = track(v, removeStory(v, b.id), 'ana')
    // As cenas não somem: viram soltas (como sempre foi), e o livro vai para a lixeira.
    expect(gone.scenes.filter((s) => s.storyId === null)).toHaveLength(2)
    expect(gone.trash).toHaveLength(1)
    expect(gone.trash[0]).toMatchObject({ kind: 'stories', label: 'Livro 2' })
    const back = restoreTrash(gone, gone.trash[0].id, 'ana')
    expect(back.stories.map((s) => s.title)).toEqual(['Livro 1', 'Livro 2'])
    expect(back.scenes.filter((s) => s.storyId === b.id).map((s) => [s.id, s.order])).toEqual(before)
    expect(back.scenes.filter((s) => s.storyId === null)).toHaveLength(0)
    expect(scenes).toHaveLength(4)
  })

  it('o que mudou depois de apagar o livro não é desfeito ao recuperar', () => {
    const { v, b, scenes } = twoBooks()
    const gone = track(v, removeStory(v, b.id), 'ana')
    // Uma das cenas soltas foi para o livro 1 na mão: ao recuperar o livro 2, ela fica onde a pessoa pôs.
    const [, a] = [0, v.stories[0]]
    const moved = updateScene(gone, scenes[2], { storyId: a.id })
    const back = restoreTrash(moved, moved.trash[0].id, 'ana')
    expect(back.scenes.find((s) => s.id === scenes[2])!.storyId).toBe(a.id)
    expect(back.scenes.find((s) => s.id === scenes[3])!.storyId).toBe(b.id)
  })

  it('apagar uma cena e recuperar: volta para o mesmo livro, e os vínculos que ela tinha (fatos, tramas, ligações) voltam', () => {
    const o = sampleUniverse()
    const withScene = o.scenes.find((s) => o.facts.some((f) => f.sourceSceneId === s.id) || o.seeds.some((x) => x.setupSceneId === s.id || x.payoffSceneId === s.id || x.clues.some((c) => c.sceneId === s.id)))
    expect(withScene, 'o exemplo tem uma cena ligada a fato ou trama').toBeTruthy()
    const scene = withScene!
    const gone = track(o, removeScene(o, scene.id), 'ana')
    expect(gone.scenes.some((s) => s.id === scene.id)).toBe(false)
    const back = restoreTrash(gone, gone.trash[0].id, 'ana')
    const same = back.scenes.find((s) => s.id === scene.id)!
    expect(same.storyId).toBe(scene.storyId)
    expect(same.order).toBe(scene.order)
    expect(back.facts.map((f) => f.sourceSceneId)).toEqual(o.facts.map((f) => f.sourceSceneId))
    expect(back.seeds.map((x) => [x.setupSceneId, x.payoffSceneId, x.clues.map((c) => c.sceneId)])).toEqual(o.seeds.map((x) => [x.setupSceneId, x.payoffSceneId, x.clues.map((c) => c.sceneId)]))
    expect(back.relations.map((r) => r.scope)).toEqual(o.relations.map((r) => r.scope))
  })

  it('apagar uma ficha e recuperar: volta com as ligações e com os lugares onde aparecia (cenas, eventos, mapa, fichas de jogo, filhos)', () => {
    const o = u
    const gone = track(o, removeEntity(o, kael.id), 'ana')
    expect(gone.trash).toHaveLength(1)
    const back = restoreTrash(gone, gone.trash[0].id, 'ana')
    expect(back.relations.map((r) => r.id).sort()).toEqual(o.relations.map((r) => r.id).sort())
    expect(back.scenes.map((s) => [s.id, s.povId, s.placeId, s.presentIds])).toEqual(o.scenes.map((s) => [s.id, s.povId, s.placeId, s.presentIds]))
    expect(back.events.map((e) => [e.id, e.entityIds, e.placeId])).toEqual(o.events.map((e) => [e.id, e.entityIds, e.placeId]))
    expect(back.facts.map((f) => [f.id, f.subjectId, f.objectId, f.speakerId])).toEqual(o.facts.map((f) => [f.id, f.subjectId, f.objectId, f.speakerId]))
    expect(back.maps.map((m) => m.pins.map((p) => p.entityId))).toEqual(o.maps.map((m) => m.pins.map((p) => p.entityId)))
    expect(back.sheets.map((s) => [s.id, s.entityId])).toEqual(o.sheets.map((s) => [s.id, s.entityId]))
    expect(back.entities.map((e) => [e.id, e.parentId]).sort()).toEqual(o.entities.map((e) => [e.id, e.parentId]).sort())
    expect(back.seeds.map((s) => s.entityIds)).toEqual(o.seeds.map((s) => s.entityIds))
  })

  it('o que a pessoa mexeu depois de apagar a ficha não é desfeito, e o que ela ainda não tinha é só somado', () => {
    const o = u
    const scene = o.scenes.find((s) => s.presentIds.includes(kael.id))!
    const gone = track(o, removeEntity(o, kael.id), 'ana')
    // Depois de apagar, a cena ganhou outra pessoa presente e outro ponto de vista.
    const other = o.entities.find((e) => e.id !== kael.id && e.kind === 'personagem')!
    const edited = updateScene(gone, scene.id, { presentIds: [other.id], povId: other.id })
    const back = restoreTrash(edited, edited.trash[0].id, 'ana')
    const after = back.scenes.find((s) => s.id === scene.id)!
    expect(after.povId).toBe(other.id)
    expect(after.presentIds).toContain(other.id)
    expect(after.presentIds).toContain(kael.id)
  })

  it('recuperar uma cena cujo livro também foi para a lixeira traz o livro junto (a cena não fica perdida)', () => {
    const { v, b, scenes } = twoBooks()
    const noScene = track(v, removeScene(v, scenes[3]), 'ana')
    const noBook = track(noScene, removeStory(noScene, b.id), 'ana')
    expect(noBook.trash.map((t) => t.kind)).toEqual(['stories', 'scenes'])
    const sceneItem = noBook.trash.find((t) => t.kind === 'scenes')!
    const back = restoreTrash(noBook, sceneItem.id, 'ana')
    const scene = back.scenes.find((s) => s.id === scenes[3])!
    expect(scene.storyId).toBe(b.id)
    expect(back.stories.some((s) => s.id === b.id)).toBe(true)
    // A outra cena do livro 2 também voltou para ele.
    expect(back.scenes.find((s) => s.id === scenes[2])!.storyId).toBe(b.id)
    expect(back.trash).toHaveLength(0)
  })

  it('universos antigos (lixeira sem os vínculos guardados) continuam recuperando como antes', () => {
    const o = u
    const gone = track(o, removeEntity(o, kael.id), 'ana')
    const old = { ...gone, trash: gone.trash.map(({ refs: _refs, ...rest }) => rest) }
    const back = restoreTrash(old, old.trash[0].id, 'ana')
    expect(back.entities.some((e) => e.id === kael.id)).toBe(true)
    expect(back.relations).toHaveLength(o.relations.length)
  })
})
