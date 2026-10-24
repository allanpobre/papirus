import { describe, expect, it } from 'vitest'
import { ostriaUniverse as sampleUniverse } from '../model/sampleOstria'
import { addStory } from '../model/universe'
import { defaultDesign } from './bookDesign'
import { addBook, copyStyle, removeBook, shelf, storiesOutsideBooks, updateBook } from './shelf'

describe('estante', () => {
  it('o livro do formato antigo aparece na estante e vira livro de verdade ao mudar', () => {
    const u = { ...sampleUniverse(), book: { ...defaultDesign(), title: 'Antigo', bodyFont: 'lora' as const } }
    expect(shelf(u).map((b) => b.title)).toEqual(['Antigo'])
    const v = updateBook(u, shelf(u)[0].id, { subtitle: 'Volume 1' })
    expect(v.book).toBeNull()
    expect(v.books).toHaveLength(1)
    expect(v.books[0]).toMatchObject({ title: 'Antigo', subtitle: 'Volume 1', bodyFont: 'lora' })
  })

  it('novo livro pega as histórias que ainda não estão em livro e pode copiar o estilo', () => {
    let u = sampleUniverse()
    const livro1 = u.stories[0]
    ;[u] = addStory(u, 'Livro II — A Torre')
    let first
    ;[u, first] = addBook(u, { storyIds: [livro1.id] })
    u = updateBook(u, first.id, { bodyFont: 'baskerville', chapterStyle: 'ornamentado', ornament: '⚜', cover: 'data:x', title: 'Volume 1' })
    expect(storiesOutsideBooks(u)).toEqual([u.stories[1].id])
    let second
    ;[u, second] = addBook(u, { title: 'Volume 2', styleFrom: first.id })
    expect(second).toMatchObject({ title: 'Volume 2', bodyFont: 'baskerville', chapterStyle: 'ornamentado', ornament: '⚜', cover: null, storyIds: [u.stories[1].id] })
    // Copiar estilo depois, mantendo capa e título.
    u = updateBook(u, second.id, { bodyFont: 'mono', cover: 'data:y' })
    u = copyStyle(u, first.id, second.id)
    expect(u.books[1]).toMatchObject({ bodyFont: 'baskerville', cover: 'data:y', title: 'Volume 2' })
    expect(removeBook(u, first.id).books.map((b) => b.title)).toEqual(['Volume 2'])
  })
})
