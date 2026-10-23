// @vitest-environment jsdom
import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it } from 'vitest'
import { createUniverse } from '../model/universe'
import type { Universe } from '../model/schema'
import { Library } from '../persistence/repository'
import { memoryStore } from '../persistence/storage'
import { removeFromCloud, syncAll } from './cloud'

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

    // Os dois mudaram: fica o daqui e a versão da nuvem vira cópia.
    const base = (await a.repository(u.id).load())!
    await put(a, later(base, 2000, 'Ostria (aqui)'))
    await sb.from('papirus_universes').upsert({ id: u.id, name: 'x', words: 0, data: { schemaVersion: 2, revision: 0, universe: later(base, 3000, 'Ostria (lá)') }, updated_at: later(base, 3000).updatedAt, deleted: false } as never)
    expect(await syncAll(sb, 'ana', a)).toMatchObject({ conflicts: 1 })
    const names = (await a.list()).map((e) => e.name).sort()
    expect(names).toEqual(['Ostria (aqui)', 'Ostria (lá) (versão da nuvem)'])
    expect((cloud.get(u.id)!.data as { universe: Universe }).universe.name).toBe('Ostria (aqui)')
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
