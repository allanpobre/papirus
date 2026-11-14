import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { docFromParagraphs } from '../model/sample'
import type { Universe } from '../model/schema'
import { addScene, addStory, createUniverse, updateScene } from '../model/universe'
import { addBook, shelf, updateBook } from '../export/shelf'
import { continueReading } from './community'
import { shelfId, syncShelf } from './social'

/*
 * A estante com vários volumes: publicar, atualizar e tirar da estante age só no volume escolhido, e quem lê o volume 1
 * não recebe aviso de capítulo novo do volume 2. Servidor de mentira na memória (só o que a estante usa).
 */

type Row = Record<string, unknown>

/** Um "Supabase" na memória: select/eq/in/order, insert, upsert (pela chave) e delete. */
function fakeServer(tables: Record<string, Row[]> = {}) {
  const t = (name: string) => (tables[name] ??= [])
  const calls: { op: string; table: string; rows?: Row[] }[] = []
  const from = (name: string) => {
    const filters: ((r: Row) => boolean)[] = []
    let mode: 'select' | 'delete' = 'select'
    const run = () => {
      const rows = t(name).filter((r) => filters.every((f) => f(r)))
      if (mode === 'delete') {
        calls.push({ op: 'delete', table: name, rows })
        tables[name] = t(name).filter((r) => !rows.includes(r))
        return { data: null, error: null }
      }
      return { data: rows.map((r) => ({ ...r })), error: null }
    }
    const q: Record<string, unknown> = {
      select: () => q,
      eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
      in: (k: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[k])), q),
      order: () => q,
      delete: () => ((mode = 'delete'), q),
      insert: (rows: Row | Row[]) => {
        const list = Array.isArray(rows) ? rows : [rows]
        calls.push({ op: 'insert', table: name, rows: list })
        t(name).push(...list.map((r) => ({ ...r })))
        return Promise.resolve({ data: null, error: null })
      },
      upsert: (rows: Row | Row[], opts?: { onConflict?: string }) => {
        const list = Array.isArray(rows) ? rows : [rows]
        calls.push({ op: 'upsert', table: name, rows: list })
        const keys = (opts?.onConflict ?? 'id').split(',')
        for (const r of list) {
          const at = t(name).findIndex((x) => keys.every((k) => x[k] === r[k]))
          if (at >= 0) t(name)[at] = { ...t(name)[at], ...r }
          else t(name).push({ ...r })
        }
        return Promise.resolve({ data: null, error: null })
      },
      then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(run()).then(ok, bad),
    }
    return q
  }
  return { sb: { from } as unknown as SupabaseClient, tables, calls }
}

const text = (n: number) => Array.from({ length: n }, () => 'mar').join(' ')

/** Dois volumes, cada um com a sua história e um capítulo; os dois visíveis na estante. */
function twoVolumes(visibility: 'publico' | 'amigos' = 'publico') {
  let u: Universe = createUniverse('Saga')
  let a, b, s1, s2
  ;[u, a] = addStory(u, 'Volume 1')
  ;[u, b] = addStory(u, 'Volume 2')
  ;[u, s1] = addScene(u, a.id, 'Cap. 1')
  ;[u, s2] = addScene(u, b.id, 'Cap. 1')
  u = updateScene(u, s1.id, { doc: docFromParagraphs([text(60)]), text: text(60) })
  u = updateScene(u, s2.id, { doc: docFromParagraphs([text(60)]), text: text(60) })
  let v1, v2
  ;[u, v1] = addBook(u, { title: 'Volume 1', storyIds: [a.id] })
  ;[u, v2] = addBook(u, { title: 'Volume 2', storyIds: [b.id] })
  u = updateBook(u, v1.id, { shelfVisibility: visibility })
  u = updateBook(u, v2.id, { shelfVisibility: visibility })
  return { u, a, b, v1: shelf(u).find((x) => x.id === v1.id)!, v2: shelf(u).find((x) => x.id === v2.id)! }
}

describe('estante com vários volumes', () => {
  it('cada volume é uma linha própria, com os capítulos dele', async () => {
    const { u, v1, v2 } = twoVolumes()
    const { sb, tables } = fakeServer()
    expect(await syncShelf(sb, 'ana', u, null)).toBe(2)
    const rows = tables.papirus_shelf
    expect(rows.map((r) => r.id).sort()).toEqual([shelfId(u.id, v1.id), shelfId(u.id, v2.id)].sort())
    expect(rows.every((r) => r.chapters === 1)).toBe(true)
    expect(rows.find((r) => r.id === shelfId(u.id, v1.id))?.title).toBe('Volume 1')
  })

  it('um capítulo novo no volume 2 atualiza e avisa só o volume 2', async () => {
    const { u, b, v1, v2 } = twoVolumes()
    const { sb, tables, calls } = fakeServer()
    await syncShelf(sb, 'ana', u, null)
    calls.length = 0
    let u2: Universe
    let novo
    ;[u2, novo] = addScene(u, b.id, 'Cap. 2')
    u2 = updateScene(u2, novo.id, { doc: docFromParagraphs([text(50)]), text: text(50) })
    await syncShelf(sb, 'ana', u2, null)
    // Só a linha do volume 2 foi mandada de novo.
    const enviadas = calls.filter((c) => c.op === 'upsert' && c.table === 'papirus_shelf').flatMap((c) => c.rows!.map((r) => r.id))
    expect(enviadas).toEqual([shelfId(u.id, v2.id)])
    // O aviso de "capítulo novo" é do volume 2, com 1 capítulo.
    expect(tables.papirus_activity).toEqual([expect.objectContaining({ kind: 'capitulos', book_id: shelfId(u.id, v2.id), title: 'Volume 2', n: 1 })])
    expect(tables.papirus_shelf.find((r) => r.id === shelfId(u.id, v1.id))?.chapters).toBe(1)
    expect(tables.papirus_shelf.find((r) => r.id === shelfId(u.id, v2.id))?.chapters).toBe(2)
  })

  it('tirar um volume da estante (voltar para "Só eu") apaga só aquele volume', async () => {
    const { u, v1, v2 } = twoVolumes()
    const { sb, tables, calls } = fakeServer()
    await syncShelf(sb, 'ana', u, null)
    calls.length = 0
    const privado = updateBook(u, v1.id, { shelfVisibility: 'privado' })
    expect(await syncShelf(sb, 'ana', privado, null)).toBe(1)
    expect(calls.filter((c) => c.op === 'delete').flatMap((c) => c.rows!.map((r) => r.id))).toEqual([shelfId(u.id, v1.id)])
    expect(tables.papirus_shelf.map((r) => r.id)).toEqual([shelfId(u.id, v2.id)])
    // E publicar de volta o volume 1 não mexe no 2.
    calls.length = 0
    await syncShelf(sb, 'ana', u, null)
    expect(calls.filter((c) => c.op === 'upsert' && c.table === 'papirus_shelf').flatMap((c) => c.rows!.map((r) => r.id))).toEqual([shelfId(u.id, v1.id)])
  })

  it('quem lê o volume 1 não recebe aviso de capítulo novo do volume 2 (e o do volume 2 chega a quem o lê)', async () => {
    const { u, a, b, v1, v2 } = twoVolumes()
    const { sb, tables } = fakeServer({ papirus_profiles: [{ user_id: 'ana', handle: 'ana', name: 'Ana', bio: '', avatar: null }] })
    await syncShelf(sb, 'ana', u, null)
    // Bia leu o volume 1 e o volume 2 até onde há (1 capítulo cada).
    const agora = new Date().toISOString()
    tables.papirus_reading = [
      { user_id: 'bia', owner: 'ana', book_id: shelfId(u.id, v1.id), chapter_index: 0, furthest: 0, chapters_seen: 1, updated_at: agora },
      { user_id: 'bia', owner: 'ana', book_id: shelfId(u.id, v2.id), chapter_index: 0, furthest: 0, chapters_seen: 1, updated_at: agora },
    ]
    const novos = async () => Object.fromEntries((await continueReading(sb, 'bia')).map((r) => [r.book.id, r.newChapters]))
    expect(await novos()).toEqual({ [shelfId(u.id, v1.id)]: 0, [shelfId(u.id, v2.id)]: 0 })

    // Ana escreve um capítulo no volume 2.
    let u2: Universe
    let c2
    ;[u2, c2] = addScene(u, b.id, 'Cap. 2')
    u2 = updateScene(u2, c2.id, { doc: docFromParagraphs([text(40)]), text: text(40) })
    await syncShelf(sb, 'ana', u2, null)
    expect(await novos()).toEqual({ [shelfId(u.id, v1.id)]: 0, [shelfId(u.id, v2.id)]: 1 })

    // E um no volume 1: agora é o 1 que tem novidade.
    let c3
    ;[u2, c3] = addScene(u2, a.id, 'Cap. 2')
    u2 = updateScene(u2, c3.id, { doc: docFromParagraphs([text(40)]), text: text(40) })
    await syncShelf(sb, 'ana', u2, null)
    expect(await novos()).toEqual({ [shelfId(u.id, v1.id)]: 1, [shelfId(u.id, v2.id)]: 1 })
  })
})
