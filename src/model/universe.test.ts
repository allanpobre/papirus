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
