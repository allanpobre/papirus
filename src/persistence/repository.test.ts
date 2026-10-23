// @vitest-environment jsdom
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { addScene, createUniverse, updateScene } from '../model/universe'
import { countWords, Library, UniverseRepository, wordCount } from './repository'
import { localStorageStore, memoryStore, openIndexedDbStore, type KeyValueStore } from './storage'

const stores: [string, () => Promise<KeyValueStore>][] = [
  ['IndexedDB', () => openIndexedDbStore(new IDBFactory())],
  ['localStorage', async () => localStorageStore(window.localStorage)],
  ['memória', async () => memoryStore()],
]

beforeEach(() => window.localStorage.clear())

const later = (ms = 1000) => new Date(Date.now() + ms).toISOString()

describe.each(stores)('UniverseRepository com %s', (_name, open) => {
  it('retorna null quando não há nada salvo', async () => {
    expect(await new UniverseRepository(await open(), 'x').load()).toBeNull()
  })

  it('salva e carrega o universo com os mesmos IDs e conteúdo', async () => {
    const store = await open()
    const [u, scene] = addScene(createUniverse('Mundo'), null, 'Abertura')
    const universe = updateScene(u, scene.id, { text: 'Era noite.' })

    await new UniverseRepository(store, universe.id).save(universe)
    expect(await new UniverseRepository(store, universe.id).load()).toEqual(universe)
  })

  it('incrementa a revisão e guarda a versão anterior', async () => {
    const store = await open()
    const first = createUniverse('Primeiro')
    const repo = new UniverseRepository(store, first.id)
    await repo.save(first)
    await repo.save({ ...first, name: 'Segundo' })

    const current = (await store.get(`universe:${first.id}:current`)) as { revision: number }
    const previous = (await store.get(`universe:${first.id}:previous`)) as {
      revision: number
      universe: { name: string }
    }
    expect(current.revision).toBe(2)
    expect(previous.revision).toBe(1)
    expect(previous.universe.name).toBe('Primeiro')
  })

  it('cria um snapshot automático na primeira gravação e não repete em seguida', async () => {
    const store = await open()
    const u = createUniverse()
    const repo = new UniverseRepository(store, u.id)
    await repo.save(u)
    await repo.save({ ...u, name: 'Outro' })
    const snaps = await repo.listSnapshots()
    expect(snaps).toHaveLength(1)
    expect(snaps[0].auto).toBe(true)
  })

  it('cria, lê e apaga snapshots nomeados', async () => {
    const store = await open()
    const u = createUniverse('Antes da guerra')
    const repo = new UniverseRepository(store, u.id)
    const snap = await repo.createSnapshot(u, 'Antes de reescrever o ato 2')
    expect(await repo.readSnapshot(snap.id)).toEqual(u)
    await repo.deleteSnapshot(snap.id)
    expect(await repo.listSnapshots()).toEqual([])
    await expect(repo.readSnapshot(snap.id)).rejects.toThrow()
  })
})

describe('cópia de emergência', () => {
  it('recupera alterações gravadas ao sair que a gravação principal não concluiu', async () => {
    const store = memoryStore()
    const saved = createUniverse('Salvo')
    const repo = new UniverseRepository(store, saved.id, window.localStorage)
    await repo.save(saved)

    const newer = { ...saved, name: 'Mais novo', updatedAt: later() }
    repo.saveEmergency(newer)

    const reopened = new UniverseRepository(store, saved.id, window.localStorage)
    expect(await reopened.load()).toEqual(newer)
    expect(reopened.recoveredFromEmergency).toBe(true)

    await reopened.save(newer)
    expect(window.localStorage.getItem(`papirus:emergency:${saved.id}`)).toBeNull()
  })

  it('ignora uma cópia de emergência mais antiga que a principal', async () => {
    const store = memoryStore()
    const old = createUniverse('Antigo')
    const repo = new UniverseRepository(store, old.id, window.localStorage)
    repo.saveEmergency(old)
    await repo.save({ ...old, name: 'Atual', updatedAt: later() })

    const reopened = new UniverseRepository(store, old.id, window.localStorage)
    expect((await reopened.load())?.name).toBe('Atual')
    expect(reopened.recoveredFromEmergency).toBe(false)
  })

  it('não descarta uma cópia de emergência mais nova ao concluir uma gravação antiga', async () => {
    const old = createUniverse('Antigo')
    const repo = new UniverseRepository(memoryStore(), old.id, window.localStorage)
    repo.saveEmergency({ ...old, updatedAt: later() })
    await repo.save(old)
    expect(window.localStorage.getItem(`papirus:emergency:${old.id}`)).not.toBeNull()
  })

  it('ignora uma cópia de emergência corrompida', async () => {
    const store = memoryStore()
    const u = createUniverse('Bom')
    await new UniverseRepository(store, u.id).save(u)
    window.localStorage.setItem(`papirus:emergency:${u.id}`, '{quebrado')
    expect((await new UniverseRepository(store, u.id, window.localStorage).load())?.name).toBe('Bom')
  })
})

describe('Library', () => {
  it('lista universos do mais recente para o mais antigo', async () => {
    const lib = new Library(memoryStore())
    const a = { ...createUniverse('A'), updatedAt: '2026-01-01T00:00:00.000Z' }
    const b = { ...createUniverse('B'), updatedAt: '2026-02-01T00:00:00.000Z' }
    await lib.touch(a)
    await lib.touch(b)
    await lib.touch({ ...a, name: 'A renomeado' })
    expect((await lib.list()).map((e) => e.name)).toEqual(['B', 'A renomeado'])
  })

  it('remove um universo e seus dados', async () => {
    const store = memoryStore()
    const lib = new Library(store)
    const u = createUniverse('Some')
    await lib.repository(u.id).save(u)
    await lib.touch(u)
    await lib.remove(u.id)
    expect(await lib.list()).toEqual([])
    expect(await lib.repository(u.id).load()).toBeNull()
  })

  it('adota o save da primeira versão (formato 1, chave única) sem perder nada', async () => {
    const store = memoryStore()
    await store.set('universe:current', {
      schemaVersion: 1,
      revision: 4,
      universe: {
        id: 'antigo',
        name: 'Meu universo',
        stories: [],
        scenes: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    })
    const lib = new Library(store, window.localStorage)
    const list = await lib.list()
    expect(list.map((e) => e.id)).toEqual(['antigo'])
    expect((await lib.repository('antigo').load())?.name).toBe('Meu universo')
    expect(await store.get('universe:current')).toBeUndefined()
  })
})

describe('contagem de palavras', () => {
  it('conta palavras com acentos, hífens e apóstrofos', () => {
    expect(wordCount('— Quem está aí? — perguntou Kael.')).toBe(5)
    expect(wordCount("guarda-chuva d'água 1984")).toBe(3)
    expect(wordCount('')).toBe(0)
  })

  it('soma as palavras de todas as cenas', () => {
    let [u, a] = addScene(createUniverse(), null)
    u = updateScene(u, a.id, { text: 'um dois três' })
    expect(countWords(u)).toBe(3)
  })
})
