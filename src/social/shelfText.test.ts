import { describe, expect, it } from 'vitest'
import { ostriaUniverse } from '../model/sampleOstria'
import { addBook } from '../export/shelf'
import { shelfTextOf } from './shelfText'

describe('texto na estante', () => {
  it('vai sem segredos, sem a mesa de RPG e só com as histórias do livro', () => {
    let u = ostriaUniverse()
    const secret = u.entities.find((e) => e.canon === 'secreto')
    const story = u.stories[0]
    let book
    ;[u, book] = addBook(u, { title: 'Só a primeira', storyIds: [story.id] })
    const t = shelfTextOf(u, book)!
    expect(t.universe.sessions).toEqual([])
    expect(t.universe.sheets).toEqual([])
    expect(t.universe.inbox).toEqual([])
    expect(t.universe.stories.map((s) => s.id)).toEqual([story.id])
    expect(t.universe.scenes.every((s) => s.storyId === story.id)).toBe(true)
    if (secret) expect(t.universe.entities.some((e) => e.id === secret.id)).toBe(false)
    expect(t.universe.name).toBe('Só a primeira')
  })
})
