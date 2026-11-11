import { describe, expect, it } from 'vitest'
import { addScene, createUniverse, draftEntity, insert } from '../model/universe'
import type { Universe } from '../model/schema'
import { families } from './cloudCopy'
import { Library } from './repository'
import { memoryStore } from './storage'
import { addVersion, baseName, confirmRepeats, keepVersion, repeatHints, replaceWith, tidyGroup, trimVersions, versionLabel } from './versions'

async function put(lib: Library, u: Universe) {
  await lib.repository(u.id).save(u)
  await lib.touch(u)
}
const at = (u: Universe, day: number, name = u.name): Universe => ({ ...u, name, updatedAt: new Date(Date.UTC(2026, 0, day)).toISOString() })

/** Um universo com duas cenas e uma ficha. */
function book(name: string): Universe {
  let u = createUniverse(name)
  ;[u] = addScene(u, null, 'Um')
  ;[u] = addScene(u, null, 'Dois')
  ;[u] = insert(u, 'entities', draftEntity('personagem', 'Kael'))
  return u
}
/** A mesma história com outro id (uma cópia). */
const copyOf = (u: Universe, name: string, day: number): Universe => at({ ...u, id: crypto.randomUUID() }, day, name)
const names = async (lib: Library) => families(await lib.list()).map((f) => [f.main.name, f.versions.length])

describe('versões guardadas', () => {
  it('"Ficar com esta versão": a versão vira o universo (com o mesmo id) e o que era o universo fica guardado', async () => {
    const lib = new Library(memoryStore())
    const u = at(book('Ostria'), 10)
    await put(lib, u)
    const v = await addVersion(lib, u.id, at({ ...u, description: 'a da nuvem' }, 8), 'nuvem')
    await keepVersion(lib, u.id, v.id, at(u, 12).updatedAt)

    const main = (await lib.repository(u.id).load())!
    expect(main).toMatchObject({ id: u.id, description: 'a da nuvem', cloudCopyOf: null, versionKind: null })
    // Data nova: a sincronização envia o que ficou.
    expect(main.updatedAt).toBe(at(u, 12).updatedAt)
    expect(await lib.repository(v.id).load()).toMatchObject({ id: v.id, description: '', cloudCopyOf: u.id, versionKind: 'anterior' })
    expect(await names(lib)).toEqual([['Ostria', 1]])
  })

  it('backup de um universo que já está aqui: guardar como versão, ou substituir (o de antes fica guardado)', async () => {
    const lib = new Library(memoryStore())
    const u = at(book('Ostria'), 10)
    await put(lib, u)
    const backup = at({ ...u, description: 'do backup' }, 5, 'Ostria (importado)')
    const v = await addVersion(lib, u.id, backup, 'backup')
    expect(v).toMatchObject({ name: 'Ostria', cloudCopyOf: u.id, versionKind: 'backup' })
    expect(versionLabel(v.versionKind)).toBe('backup importado')

    await replaceWith(lib, u.id, backup)
    expect(await lib.repository(u.id).load()).toMatchObject({ id: u.id, name: 'Ostria', description: 'do backup', cloudCopyOf: null })
    const list = await lib.list()
    expect(list.filter((e) => e.cloudCopyOf === u.id).map((e) => e.versionKind).sort()).toEqual(['anterior', 'backup'])
  })

  it('ficam as 5 versões mais recentes; a mais antiga sai', async () => {
    const lib = new Library(memoryStore())
    const u = at(book('Ostria'), 20)
    await put(lib, u)
    for (let day = 1; day <= 7; day++) await addVersion(lib, u.id, at(u, day), 'nuvem')
    const out = await trimVersions(lib, u.id)
    expect(out.map((e) => new Date(e.updatedAt).getUTCDate()).sort()).toEqual([1, 2])
    expect(await names(lib)).toEqual([['Ostria', 5]])
  })
})

describe('arrumar os repetidos', () => {
  it('sem abrir nada: há o que arrumar se uma versão ainda está na nuvem ou se dois universos têm o mesmo nome', async () => {
    const lib = new Library(memoryStore())
    const u = at(book('Ostria'), 10)
    await put(lib, u)
    const v = await addVersion(lib, u.id, at(u, 8), 'nuvem')
    await put(lib, at(book('Brumas'), 9))
    const none = () => false
    expect(repeatHints(await lib.list(), none)).toEqual([])
    expect(repeatHints(await lib.list(), (id) => id === v.id).map((g) => g.map((e) => e.name))).toEqual([['Ostria', 'Ostria']])

    const imported = copyOf(u, 'Ostria (importado)', 3)
    await put(lib, imported)
    expect(baseName('Ostria (importado)')).toBe('Ostria')
    expect(repeatHints(await lib.list(), none)).toHaveLength(1)
    // "São universos diferentes": o par deixa de aparecer.
    expect(repeatHints(await lib.list(), none, new Set([[u.id, imported.id].sort().join('|')]))).toEqual([])
  })

  it('só junta o que é mesmo o mesmo livro: nome igual com outra história fica de fora', async () => {
    const lib = new Library(memoryStore())
    const u = at(book('Ostria'), 10)
    const imported = copyOf(u, 'Ostria (importado)', 3)
    const other = at(book('Ostria'), 7)
    await put(lib, u)
    await put(lib, imported)
    await put(lib, other)
    const groups = await confirmRepeats(lib, repeatHints(await lib.list(), () => false))
    expect(groups).toHaveLength(1)
    expect(groups[0].entries.map((e) => e.id)).toEqual([u.id, imported.id])
    expect(groups[0].suggested).toBe(u.id)
  })

  it('guardar as outras como versões: fica um universo, os outros saem da nuvem e viram versões dele', async () => {
    const lib = new Library(memoryStore())
    const u = at(book('Ostria'), 10)
    const old = copyOf(u, 'Ostria (versão da nuvem)', 8)
    const imported = copyOf(u, 'Ostria (importado)', 3)
    await put(lib, u)
    await put(lib, old)
    await put(lib, imported)
    const [group] = await confirmRepeats(lib, repeatHints(await lib.list(), (id) => id === old.id))
    expect(group.entries).toHaveLength(3)

    const r = await tidyGroup(lib, group, u.id, true)
    expect(r.mainId).toBe(u.id)
    expect(r.leaveCloud.sort()).toEqual([old.id, imported.id].sort())
    expect(await names(lib)).toEqual([['Ostria', 2]])
    expect((await lib.list()).filter((e) => e.cloudCopyOf).map((e) => e.versionKind).sort()).toEqual(['backup', 'nuvem'])
  })

  it('a principal pode ser uma versão: ela troca de lugar com o universo, que mantém o id', async () => {
    const lib = new Library(memoryStore())
    const u = at(book('Ostria'), 10)
    await put(lib, u)
    const v = await addVersion(lib, u.id, at({ ...u, description: 'a boa' }, 8), 'nuvem')
    const [group] = await confirmRepeats(lib, repeatHints(await lib.list(), (id) => id === v.id))
    const r = await tidyGroup(lib, group, v.id, true)
    expect(r.mainId).toBe(u.id)
    expect((await lib.repository(u.id).load())?.description).toBe('a boa')
    expect(await lib.repository(v.id).load()).toMatchObject({ cloudCopyOf: u.id, versionKind: 'anterior', description: '' })
  })

  it('a principal fora da nuvem troca de lugar com o universo que já está lá: fica o id que tem a dupla', async () => {
    const lib = new Library(memoryStore())
    const u = at(book('Ostria'), 10)
    const imported = at({ ...copyOf(u, 'Ostria (importado)', 12), description: 'a boa' }, 12)
    await put(lib, u)
    await put(lib, imported)
    const [group] = await confirmRepeats(lib, repeatHints(await lib.list(), () => false))
    const r = await tidyGroup(lib, group, imported.id, true, (id) => id === u.id)
    expect(r.mainId).toBe(u.id)
    expect(await lib.repository(u.id).load()).toMatchObject({ name: 'Ostria', description: 'a boa', cloudCopyOf: null })
    expect(await lib.repository(imported.id).load()).toMatchObject({ cloudCopyOf: u.id, versionKind: 'anterior', description: '' })
    // O que sai da nuvem é o outro id; o do universo continua lá.
    expect(r.leaveCloud).toEqual([imported.id])
  })

  it('apagar as outras: fica só a principal', async () => {
    const lib = new Library(memoryStore())
    const u = at(book('Ostria'), 10)
    const imported = copyOf(u, 'Ostria (importado)', 12)
    await put(lib, u)
    await put(lib, imported)
    const [group] = await confirmRepeats(lib, repeatHints(await lib.list(), () => false))
    expect(group.suggested).toBe(imported.id)
    const r = await tidyGroup(lib, group, imported.id, false)
    expect(r.removed.map((e) => e.id)).toEqual([u.id])
    expect((await lib.list()).map((e) => [e.id, e.name])).toEqual([[imported.id, 'Ostria']])
  })
})
