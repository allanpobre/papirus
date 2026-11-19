import { describe, expect, it } from 'vitest'
import { ostriaUniverse } from './sampleOstria'
import { addStory, bookIdsOf, bookOnly, bookScenes, chosenBook, inBook, isSeries, seriesId } from './universe'

describe('série: vários livros juntos no seletor', () => {
  let u = ostriaUniverse()
  const [a] = u.stories
  let b, c
  ;[u, b] = addStory(u, 'Livro dois')
  ;[u, c] = addStory(u, 'Livro três')

  it('a série é guardada na ordem do universo; um livro só é o id dele; nenhum, null', () => {
    expect(seriesId(u, [c.id, a.id])).toBe(`${a.id},${c.id}`)
    expect(seriesId(u, [b.id])).toBe(b.id)
    expect(seriesId(u, ['sumiu'])).toBeNull()
    expect(isSeries(`${a.id},${c.id}`)).toBe(true)
    expect(isSeries(a.id)).toBe(false)
    expect(bookIdsOf(null)).toBeNull()
  })

  it('cenas, universo e título seguem a série', () => {
    const s = `${a.id},${c.id}`
    expect(inBook(s, a.id) && inBook(s, c.id) && !inBook(s, b.id)).toBe(true)
    expect(bookScenes(u, s).every((x) => x.storyId === a.id || x.storyId === c.id)).toBe(true)
    expect(bookOnly(u, s).stories.map((x) => x.id)).toEqual([a.id, c.id])
    expect(chosenBook(u, s)?.title).toBe(`${a.title} + Livro três`)
    expect(chosenBook(u, b.id)?.title).toBe('Livro dois')
  })
})
