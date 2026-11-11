// @vitest-environment jsdom
import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it } from 'vitest'
import { addScene, createUniverse, draftEntity, insert, patch } from '../model/universe'
import type { Universe } from '../model/schema'
import { Library } from '../persistence/repository'
import { memoryStore } from '../persistence/storage'
import { pendingConflicts, removeFromCloud, resolveConflict, syncAll } from './cloud'

type Row = { user_id: string; id: string; name: string; words: number; data: unknown; updated_at: string; deleted: boolean }

/** Imita o pedaço da API do Supabase que a sincronização usa, com o RLS de "só o dono". */
function fakeSupabase(rows: Map<string, Row>, userId: string): SupabaseClient {
  const mine = () => [...rows.values()].filter((r) => r.user_id === userId)
  const query = (pick: (r: Row) => unknown) => {
    let list = mine()
    const q = {
      eq: (col: keyof Row, v: unknown) => {
        list = list.filter((r) => r[col] === v)
        return q
      },
      single: async () => ({ data: list[0] ? pick(list[0]) : null, error: list[0] ? null : { message: 'não achou' } }),
      maybeSingle: async () => ({ data: list[0] ? pick(list[0]) : null, error: null }),
      then: (ok: (v: { data: unknown; error: null }) => void) => ok({ data: list.map(pick), error: null }),
    }
    return q
  }
  return {
    from: () => ({
      select: (cols: string) => query((r) => Object.fromEntries(cols.split(',').map((c) => [c, r[c as keyof Row]]))),
      upsert: async (row: Row) => {
        rows.set(row.id, { ...row, user_id: userId })
        return { data: null, error: null }
      },
      update: (patch: Partial<Row>) => {
        const where: [keyof Row, unknown][] = []
        const q = {
          eq: (c: keyof Row, v: unknown) => {
            where.push([c, v])
            return q
          },
          then: (ok: (v: { data: null; error: null }) => void) => {
            for (const r of mine()) if (where.every(([c, v]) => r[c] === v)) rows.set(r.id, { ...r, ...patch })
            ok({ data: null, error: null })
          },
        }
        return q
      },
    }),
  } as unknown as SupabaseClient
}

const later = (u: Universe, ms: number, name?: string): Universe => ({ ...u, name: name ?? u.name, updatedAt: new Date(Date.parse(u.updatedAt) + ms).toISOString() })

describe('universos na nuvem', () => {
  let cloud: Map<string, Row>
  beforeEach(() => {
    localStorage.clear()
    cloud = new Map()
  })

  async function device() {
    const lib = new Library(memoryStore())
    return lib
  }
  async function put(lib: Library, u: Universe) {
    await lib.repository(u.id).save(u)
    await lib.touch(u)
  }

  it('leva os universos de um aparelho para outro', async () => {
    const a = await device()
    const u = createUniverse('Ostria')
    await put(a, u)
    const sb = fakeSupabase(cloud, 'ana')
    expect(await syncAll(sb, 'ana', a)).toMatchObject({ uploaded: 1, downloaded: 0 })

    localStorage.clear() // outro aparelho: nada sincronizado ainda
    const b = await device()
    expect(await syncAll(sb, 'ana', b)).toMatchObject({ downloaded: 1 })
    expect((await b.repository(u.id).load())?.name).toBe('Ostria')
    // Outra pessoa não vê nada.
    expect(await syncAll(fakeSupabase(cloud, 'bia'), 'bia', await device())).toMatchObject({ downloaded: 0, uploaded: 0 })
  })

  it('vale o lado que mudou; se os dois mudaram, nada se perde', async () => {
    const a = await device()
    const sb = fakeSupabase(cloud, 'ana')
    const u = createUniverse('Ostria')
    await put(a, u)
    await syncAll(sb, 'ana', a)

    // Só a nuvem mudou (outro aparelho): desce.
    await sb.from('papirus_universes').upsert({ id: u.id, name: 'Ostria', words: 0, data: { schemaVersion: 2, revision: 0, universe: later(u, 1000, 'Ostria (nuvem)') }, updated_at: later(u, 1000).updatedAt, deleted: false } as never)
    expect(await syncAll(sb, 'ana', a)).toMatchObject({ downloaded: 1 })
    expect((await a.repository(u.id).load())?.name).toBe('Ostria (nuvem)')

    // Os dois mudaram o nome: juntar sozinho perderia um dos dois, então nada é enviado nem recebido. Espera a escolha.
    const base = (await a.repository(u.id).load())!
    await put(a, later(base, 2000, 'Ostria (aqui)'))
    await sb.from('papirus_universes').upsert({ id: u.id, name: 'x', words: 0, data: { schemaVersion: 2, revision: 0, universe: later(base, 3000, 'Ostria (lá)') }, updated_at: later(base, 3000).updatedAt, deleted: false } as never)
    expect(await syncAll(sb, 'ana', a)).toMatchObject({ conflicts: 1, merged: 0, uploaded: 0, downloaded: 0 })
    expect((await a.list()).map((e) => e.name)).toEqual(['Ostria (aqui)'])
    expect((cloud.get(u.id)!.data as { universe: Universe }).universe.name).toBe('Ostria (lá)')
    expect(pendingConflicts('ana')[u.id]).toMatchObject({ canMerge: true, overlap: ['o nome'], cloudAt: later(base, 3000).updatedAt })

    // "Ficar com a deste aparelho": a da nuvem vira versão guardada, e a daqui sobe.
    await resolveConflict(sb, 'ana', a, u.id, 'aqui')
    expect(pendingConflicts('ana')[u.id]).toBeUndefined()
    const copy = (await a.list()).find((e) => e.cloudCopyOf === u.id)!
    expect(copy).toMatchObject({ name: 'Ostria (lá)', versionKind: 'nuvem' })
    expect((cloud.get(u.id)!.data as { universe: Universe }).universe.name).toBe('Ostria (aqui)')
    // A versão fica só neste aparelho.
    expect(cloud.has(copy.id)).toBe(false)
    expect(await syncAll(sb, 'ana', a)).toMatchObject({ conflicts: 0, uploaded: 0, downloaded: 0 })

    // Outra vez os dois mudaram; agora, "Ficar com a da nuvem": a daqui fica guardada como versão.
    const again = (await a.repository(u.id).load())!
    await put(a, later(again, 4000, 'Ostria (aqui 2)'))
    await sb.from('papirus_universes').upsert({ id: u.id, name: 'x', words: 0, data: { schemaVersion: 2, revision: 0, universe: later(again, 5000, 'Ostria (lá 2)') }, updated_at: later(again, 5000).updatedAt, deleted: false } as never)
    expect(await syncAll(sb, 'ana', a)).toMatchObject({ conflicts: 1 })
    await resolveConflict(sb, 'ana', a, u.id, 'nuvem')
    expect((await a.repository(u.id).load())?.name).toBe('Ostria (lá 2)')
    expect((await a.list()).filter((e) => e.cloudCopyOf === u.id).map((e) => [e.name, e.versionKind]).sort()).toEqual([
      ['Ostria (aqui 2)', 'anterior'],
      ['Ostria (lá)', 'nuvem'],
    ])
    expect(await syncAll(sb, 'ana', a)).toMatchObject({ conflicts: 0, uploaded: 0, downloaded: 0 })
  })

  it('os dois lados mudaram em lugares diferentes: junta sozinho, a partir do ponto em comum', async () => {
    const a = await device()
    const sb = fakeSupabase(cloud, 'ana')
    let u = createUniverse('Ostria')
    let s1, s2
    ;[u, s1] = addScene(u, null, 'A chegada')
    ;[u, s2] = addScene(u, null, 'A Torre')
    await put(a, u)
    await syncAll(sb, 'ana', a)
    expect((await a.repository(u.id).loadBase())?.updatedAt).toBe(u.updatedAt)

    // Aqui, a cena 1; no outro aparelho, a cena 2.
    const mine = later(patch(u, 'scenes', s1.id, { synopsis: 'mexida aqui' }), 2000)
    const theirs = later(patch(u, 'scenes', s2.id, { synopsis: 'mexida lá' }), 3000)
    await put(a, mine)
    await sb.from('papirus_universes').upsert({ id: u.id, name: 'Ostria', words: 0, data: { schemaVersion: 2, revision: 0, universe: theirs }, updated_at: theirs.updatedAt, deleted: false } as never)
    expect(await syncAll(sb, 'ana', a)).toMatchObject({ merged: 1, conflicts: 0 })

    const synopses = (x: Universe) => x.scenes.map((s) => s.synopsis)
    const here = (await a.repository(u.id).load())!
    expect(synopses(here)).toEqual(['mexida aqui', 'mexida lá'])
    expect(synopses((cloud.get(u.id)!.data as { universe: Universe }).universe)).toEqual(['mexida aqui', 'mexida lá'])
    // Nenhuma versão guardada, nada à espera, e o ponto em comum passa a ser o resultado.
    expect((await a.list()).length).toBe(1)
    expect(pendingConflicts('ana')).toEqual({})
    expect((await a.repository(u.id).loadBase())?.updatedAt).toBe(here.updatedAt)
    expect(await syncAll(sb, 'ana', a)).toMatchObject({ merged: 0, conflicts: 0, uploaded: 0, downloaded: 0 })
  })

  it('a mesma cena mudou dos dois lados: espera a escolha; "Juntar" fica com a daqui e põe a de lá ao lado', async () => {
    const a = await device()
    const sb = fakeSupabase(cloud, 'ana')
    let u = createUniverse('Ostria')
    let s1
    ;[u, s1] = addScene(u, null, 'A chegada')
    ;[u] = insert(u, 'entities', draftEntity('personagem', 'Kael'))
    await put(a, u)
    await syncAll(sb, 'ana', a)

    const mine = later(patch(u, 'scenes', s1.id, { synopsis: 'a daqui' }), 2000)
    let theirs = patch(u, 'scenes', s1.id, { synopsis: 'a de lá' })
    ;[theirs] = insert(theirs, 'entities', draftEntity('personagem', 'Brenn'))
    theirs = later(theirs, 3000)
    await put(a, mine)
    await sb.from('papirus_universes').upsert({ id: u.id, name: 'Ostria', words: 0, data: { schemaVersion: 2, revision: 0, universe: theirs }, updated_at: theirs.updatedAt, deleted: false } as never)
    expect(await syncAll(sb, 'ana', a)).toMatchObject({ merged: 0, conflicts: 1 })
    expect(pendingConflicts('ana')[u.id]).toMatchObject({ canMerge: true, overlap: ['A chegada'], here: { scenes: 1, entities: 0 }, cloud: { scenes: 1, entities: 1 }, between: { scenes: 1, entities: 1 } })
    // Enquanto espera, cada lado fica como está.
    expect((await a.repository(u.id).load())?.scenes[0].synopsis).toBe('a daqui')
    expect((cloud.get(u.id)!.data as { universe: Universe }).universe.scenes[0].synopsis).toBe('a de lá')

    expect(await resolveConflict(sb, 'ana', a, u.id, 'juntar')).toEqual(['A chegada'])
    const here = (await a.repository(u.id).load())!
    expect(here.scenes.map((s) => [s.title, s.synopsis])).toEqual([
      ['A chegada', 'a daqui'],
      ['A chegada (versão de outro aparelho)', 'a de lá'],
    ])
    // O que só o outro lado fez (a ficha nova) entra sem pergunta.
    expect(here.entities.map((e) => e.name)).toEqual(['Kael', 'Brenn'])
    expect((cloud.get(u.id)!.data as { universe: Universe }).universe.scenes).toHaveLength(2)
    expect(pendingConflicts('ana')).toEqual({})
    expect((await a.list()).length).toBe(1)
  })

  it('na nuvem, um só: cópia antiga não sobe mais, e versão sem universo volta a ser universo', async () => {
    const a = await device()
    const sb = fakeSupabase(cloud, 'ana')
    const u = createUniverse('Ostria')
    // Como era antes: a cópia de um conflito era um universo a mais, e subia.
    const old: Universe = { ...u, id: crypto.randomUUID(), name: 'Ostria (versão da nuvem)' }
    await put(a, u)
    await put(a, old)
    await syncAll(sb, 'ana', a)
    // Ao listar, a cópia já virou versão guardada de "Ostria"; o que subiu antes continua lá, mas ela não sobe mais.
    const before = cloud.get(old.id)?.updated_at
    await put(a, later({ ...old, name: 'Ostria', cloudCopyOf: u.id }, 5000))
    expect(await syncAll(sb, 'ana', a)).toMatchObject({ uploaded: 0, downloaded: 0 })
    expect(cloud.get(old.id)?.updated_at).toBe(before)
    expect((await a.list()).find((e) => e.id === old.id)?.cloudCopyOf).toBe(u.id)

    // O universo dela some (apagado aqui e na conta): a versão é a única que sobrou e volta a ser universo.
    await a.remove(u.id)
    await removeFromCloud(sb, 'ana', u.id)
    await syncAll(sb, 'ana', a)
    expect((await a.list()).find((e) => e.id === old.id)?.cloudCopyOf).toBeUndefined()
    expect((await a.repository(old.id).load())?.cloudCopyOf).toBeNull()
  })

  it('se os dois lados ficaram iguais, não guarda cópia', async () => {
    const a = await device()
    const sb = fakeSupabase(cloud, 'ana')
    const u = createUniverse('Igual')
    await put(a, u)
    await syncAll(sb, 'ana', a)
    const same = later(u, 1000, 'Igual 2')
    await put(a, same)
    await sb.from('papirus_universes').upsert({ id: u.id, name: 'x', words: 0, data: { schemaVersion: 2, revision: 0, universe: { ...same, updatedAt: later(u, 2000).updatedAt } }, updated_at: later(u, 2000).updatedAt, deleted: false } as never)
    expect(await syncAll(sb, 'ana', a)).toMatchObject({ conflicts: 0 })
    expect((await a.list()).length).toBe(1)
  })

  it('apagar em um aparelho apaga nos outros, a menos que tenham mexido', async () => {
    const a = await device()
    const sb = fakeSupabase(cloud, 'ana')
    const u = createUniverse('Ostria')
    const v = createUniverse('Brumas')
    await put(a, u)
    await put(a, v)
    await syncAll(sb, 'ana', a)
    await removeFromCloud(sb, 'ana', u.id)
    await removeFromCloud(sb, 'ana', v.id)
    // Este aparelho ainda tinha os dois; mexeu só em Brumas.
    localStorage.setItem('papirus:nuvem:ana', JSON.stringify({ [u.id]: u.updatedAt, [v.id]: v.updatedAt }))
    await put(a, later(v, 5000))
    const r = await syncAll(sb, 'ana', a)
    expect(r).toMatchObject({ removed: 1, uploaded: 1 })
    expect((await a.list()).map((e) => e.name)).toEqual(['Brumas'])
    expect(cloud.get(v.id)!.deleted).toBe(false)
  })
})
