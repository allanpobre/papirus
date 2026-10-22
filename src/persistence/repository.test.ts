// @vitest-environment jsdom
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { addScene, createUniverse, updateScene } from '../model/universe'
import { UniverseRepository } from './repository'
import { localStorageStore, memoryStore, openIndexedDbStore, type KeyValueStore } from './storage'

const stores: [string, () => Promise<KeyValueStore>][] = [
  ['IndexedDB', () => openIndexedDbStore(new IDBFactory())],
  ['localStorage', async () => localStorageStore(window.localStorage)],
  ['memória', async () => memoryStore()],
]

beforeEach(() => window.localStorage.clear())

describe.each(stores)('UniverseRepository com %s', (_name, open) => {
  it('retorna null quando não há nada salvo', async () => {
    expect(await new UniverseRepository(await open()).load()).toBeNull()
  })

  it('salva e carrega o universo com os mesmos IDs e conteúdo', async () => {
    const store = await open()
    const [u, scene] = addScene(createUniverse('Mundo'), null, 'Abertura')
    const universe = updateScene(u, scene.id, { text: 'Era noite.' })

    await new UniverseRepository(store).save(universe)
    expect(await new UniverseRepository(store).load()).toEqual(universe)
  })

  it('incrementa a revisão e guarda a versão anterior', async () => {
    const store = await open()
    const repo = new UniverseRepository(store)
    const first = createUniverse('Primeiro')
    await repo.save(first)
    await repo.save({ ...first, name: 'Segundo' })

    const current = (await store.get('universe:current')) as { revision: number }
    const previous = (await store.get('universe:previous')) as {
      revision: number
      universe: { name: string }
    }
    expect(current.revision).toBe(2)
    expect(previous.revision).toBe(1)
    expect(previous.universe.name).toBe('Primeiro')
  })

  it('continua a contagem de revisões depois de recarregar', async () => {
    const store = await open()
    await new UniverseRepository(store).save(createUniverse())
    const repo = new UniverseRepository(store)
    const loaded = await repo.load()
    await repo.save(loaded!)
    expect(((await store.get('universe:current')) as { revision: number }).revision).toBe(2)
  })
})

describe('cópia de emergência', () => {
  it('recupera alterações gravadas ao sair que a gravação principal não concluiu', async () => {
    const store = memoryStore()
    const repo = new UniverseRepository(store, window.localStorage)
    const saved = createUniverse('Salvo')
    await repo.save(saved)

    const newer = { ...saved, name: 'Mais novo', updatedAt: new Date(Date.now() + 1000).toISOString() }
    repo.saveEmergency(newer)

    const reopened = new UniverseRepository(store, window.localStorage)
    expect(await reopened.load()).toEqual(newer)
    expect(reopened.recoveredFromEmergency).toBe(true)

    await reopened.save(newer)
    expect(window.localStorage.getItem('papirus:emergency')).toBeNull()
  })

  it('ignora uma cópia de emergência mais antiga que a principal', async () => {
    const store = memoryStore()
    const repo = new UniverseRepository(store, window.localStorage)
    const old = createUniverse('Antigo')
    repo.saveEmergency(old)
    const current = { ...old, name: 'Atual', updatedAt: new Date(Date.now() + 1000).toISOString() }
    await repo.save(current)

    const reopened = new UniverseRepository(store, window.localStorage)
    expect((await reopened.load())?.name).toBe('Atual')
    expect(reopened.recoveredFromEmergency).toBe(false)
  })

  it('não descarta uma cópia de emergência mais nova ao concluir uma gravação antiga', async () => {
    const repo = new UniverseRepository(memoryStore(), window.localStorage)
    const old = createUniverse('Antigo')
    repo.saveEmergency({ ...old, updatedAt: new Date(Date.now() + 1000).toISOString() })
    await repo.save(old)
    expect(window.localStorage.getItem('papirus:emergency')).not.toBeNull()
  })

  it('ignora uma cópia de emergência corrompida', async () => {
    const store = memoryStore()
    await new UniverseRepository(store).save(createUniverse('Bom'))
    window.localStorage.setItem('papirus:emergency', '{quebrado')
    expect((await new UniverseRepository(store, window.localStorage).load())?.name).toBe('Bom')
  })
})
