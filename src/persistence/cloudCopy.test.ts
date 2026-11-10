import { describe, expect, it } from 'vitest'
import { addScene, createUniverse, draftEntity, insert } from '../model/universe'
import type { Universe } from '../model/schema'
import { families, sharedShare } from './cloudCopy'
import { Library, type LibraryEntry } from './repository'
import { memoryStore } from './storage'

const entry = (id: string, name: string, at: number, cloudCopyOf?: string): LibraryEntry => ({ id, name, words: 0, updatedAt: new Date(2026, 0, at).toISOString(), ...(cloudCopyOf ? { cloudCopyOf } : {}) })

async function put(lib: Library, u: Universe) {
  await lib.repository(u.id).save(u)
  await lib.touch(u)
}

/** Um universo com duas cenas e uma ficha. */
function book(name: string): Universe {
  let u = createUniverse(name)
  ;[u] = addScene(u, null, 'Um')
  ;[u] = addScene(u, null, 'Dois')
  ;[u] = insert(u, 'entities', draftEntity('personagem', 'Kael'))
  return u
}
/** A mesma história com outro id (como a cópia de um conflito). */
const copyOf = (u: Universe, name: string): Universe => ({ ...u, id: crypto.randomUUID(), name })

describe('a lista em duplas', () => {
  it('um item por universo, com as versões guardadas dentro, da mais nova para a mais antiga', () => {
    const list = [entry('a', 'Ostria', 5), entry('c1', 'Ostria', 2, 'a'), entry('b', 'Brumas', 4), entry('c2', 'Ostria', 3, 'a')]
    expect(families(list).map((f) => [f.main.id, f.versions.map((v) => v.id)])).toEqual([
      ['a', ['c2', 'c1']],
      ['b', []],
    ])
  })

  it('a versão de uma versão é do mesmo universo; sem o original aqui, a versão aparece como universo', () => {
    const list = [entry('a', 'Ostria', 5), entry('c1', 'Ostria', 2, 'a'), entry('c2', 'Ostria', 1, 'c1'), entry('solta', 'Brumas', 3, 'sumiu')]
    expect(families(list).map((f) => [f.main.id, f.versions.map((v) => v.id)])).toEqual([
      ['a', ['c1', 'c2']],
      ['solta', []],
    ])
  })
})

describe('cópias antigas, de antes da marca', () => {
  it('"Nome (versão da nuvem)" vira versão guardada do universo de mesmo nome, com o nome limpo', async () => {
    const lib = new Library(memoryStore())
    const u = book('Ostria')
    const old = copyOf(u, 'Ostria (versão da nuvem)')
    const older = copyOf(u, 'Ostria (versão da nuvem) (versão da nuvem)')
    await put(lib, u)
    await put(lib, old)
    await put(lib, older)
    await put(lib, book('Brumas'))

    const list = await lib.list()
    expect(list.filter((e) => e.cloudCopyOf === u.id).map((e) => e.id).sort()).toEqual([old.id, older.id].sort())
    expect(list.map((e) => e.name).sort()).toEqual(['Brumas', 'Ostria', 'Ostria', 'Ostria'])
    // A marca fica gravada no universo: não depende de adivinhar de novo.
    expect((await lib.repository(old.id).load())?.cloudCopyOf).toBe(u.id)
    expect(families(list).map((f) => [f.main.name, f.versions.length]).sort()).toEqual([
      ['Brumas', 0],
      ['Ostria', 2],
    ])
  })

  it('se o original mudou de nome, acha pelas cenas e fichas em comum; sem nada em comum, a cópia fica como universo', async () => {
    const lib = new Library(memoryStore())
    const u = book('As Cinzas de Ostria')
    const old = copyOf(u, 'Ostria (versão da nuvem)')
    const stranger = book('Sal (versão da nuvem)')
    await put(lib, u)
    await put(lib, old)
    await put(lib, stranger)
    const list = await lib.list()
    expect(list.find((e) => e.id === old.id)?.cloudCopyOf).toBe(u.id)
    expect(list.find((e) => e.id === stranger.id)?.cloudCopyOf).toBeUndefined()
  })

  it('com dois universos de mesmo nome, escolhe o que tem as mesmas cenas', async () => {
    const lib = new Library(memoryStore())
    const mine = book('Ostria')
    const other = book('Ostria')
    const old = copyOf(mine, 'Ostria (versão da nuvem)')
    await put(lib, other)
    await put(lib, mine)
    await put(lib, old)
    expect((await lib.list()).find((e) => e.id === old.id)?.cloudCopyOf).toBe(mine.id)
    expect(sharedShare(old, mine)).toBe(1)
    expect(sharedShare(old, other)).toBe(0)
  })
})
