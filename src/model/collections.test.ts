import { describe, expect, it } from 'vitest'
import { chosenBook, collectionBookId, collectionOfBook, collectionStoryIds, collectionTree, looseStories } from './universe'
import { createUniverse } from './universe'

const u = () => {
  const base = createUniverse('Papilio')
  const story = (id: string, title: string, collectionId?: string) => ({ id, title, synopsis: '', structure: 'livre' as const, collectionId, createdAt: '', updatedAt: '' })
  return {
    ...base,
    collections: [
      { id: 'pap', name: 'Tales of Papilio' },
      { id: 'mal', name: 'Tales of Malkai', parentId: 'pap' },
    ],
    stories: [story('a', 'Purple Sea', 'pap'), story('b', 'The Sea Monkey', 'pap'), story('c', 'Little General', 'mal'), story('d', 'The Mommy', 'mal'), story('e', 'Avulso')],
  }
}

describe('coleções de livros', () => {
  it('o Malkai está dentro do Papilio; o Papilio traz os livros dos dois', () => {
    const x = u()
    expect(collectionTree(x, 'pap')).toEqual(['pap', 'mal'])
    expect(collectionStoryIds(x, 'mal')).toEqual(['c', 'd'])
    expect(collectionStoryIds(x, 'pap')).toEqual(['a', 'b', 'c', 'd'])
  })
  it('escolher uma coleção guarda os livros dela juntos, e o nome da coleção aparece', () => {
    const x = u()
    expect(collectionBookId(x, 'mal')).toBe('c,d')
    expect(collectionOfBook(x, 'c,d')?.name).toBe('Tales of Malkai')
    expect(chosenBook(x, 'a,b,c,d')?.title).toBe('Tales of Papilio')
    expect(chosenBook(x, 'a')?.title).toBe('Purple Sea')
  })
  it('livro solto fica de fora das coleções; um ciclo não trava', () => {
    const x = u()
    expect(looseStories(x).map((s) => s.id)).toEqual(['e'])
    x.collections[0].parentId = 'mal'
    expect(collectionTree(x, 'pap').length).toBe(2)
  })
})
