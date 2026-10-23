import type { SupabaseClient } from '@supabase/supabase-js'
import { migrate } from '../model/migrations'
import { CURRENT_SCHEMA_VERSION, type Universe } from '../model/schema'
import { newId } from '../model/universe'
import { countWords, type Library } from '../persistence/repository'

/**
 * Universos na nuvem da conta. Regras (nunca perdem trabalho):
 * - só num lado: copia para o outro;
 * - mudou só de um lado desde a última sincronização: vale o lado que mudou;
 * - mudou dos dois lados: fica o deste aparelho, e o da nuvem vira uma cópia "(versão da nuvem)";
 * - apagado em outro aparelho: some daqui só se não foi mexido aqui desde então.
 */
export interface CloudRow {
  id: string
  name: string
  words: number
  updated_at: string
  deleted: boolean
}

export interface SyncReport {
  uploaded: number
  downloaded: number
  conflicts: number
  removed: number
}

const TABLE = 'papirus_universes'
const time = (iso: string) => Date.parse(iso)

/** Última versão sincronizada de cada universo, por conta, neste navegador. */
export function syncedMap(userId: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(`papirus:nuvem:${userId}`) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}

function setSynced(userId: string, id: string, updatedAt: string | null) {
  const map = syncedMap(userId)
  if (updatedAt === null) delete map[id]
  else map[id] = updatedAt
  try {
    localStorage.setItem(`papirus:nuvem:${userId}`, JSON.stringify(map))
  } catch {
    // Sem armazenamento: na próxima vez, compara só pelas datas.
  }
}

export class CloudError extends Error {}

const explain = (message: string) =>
  /relation .*papirus_universes.* does not exist|schema cache/i.test(message)
    ? 'O servidor ainda não tem a tabela de universos. Rode o script supabase/contas.sql no SQL Editor do Supabase.'
    : /Failed to fetch|NetworkError|Load failed/i.test(message)
      ? 'Sem conexão com o servidor.'
      : message

function check<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new CloudError(explain(r.error.message))
  return r.data
}

export async function listCloud(sb: SupabaseClient): Promise<CloudRow[]> {
  return check(await sb.from(TABLE).select('id,name,words,updated_at,deleted')) as CloudRow[]
}

export async function upload(sb: SupabaseClient, userId: string, universe: Universe) {
  check(
    await sb.from(TABLE).upsert(
      {
        user_id: userId,
        id: universe.id,
        name: universe.name,
        words: countWords(universe),
        data: { schemaVersion: CURRENT_SCHEMA_VERSION, revision: 0, universe },
        updated_at: universe.updatedAt,
        deleted: false,
      },
      { onConflict: 'user_id,id' },
    ),
  )
  setSynced(userId, universe.id, universe.updatedAt)
}

async function download(sb: SupabaseClient, id: string): Promise<Universe> {
  const row = check(await sb.from(TABLE).select('data').eq('id', id).single()) as { data: unknown }
  return migrate(row.data).universe
}

/** Marca como apagado na nuvem (os outros aparelhos ficam sabendo). */
export async function removeFromCloud(sb: SupabaseClient, userId: string, id: string) {
  check(await sb.from(TABLE).update({ deleted: true, data: null, updated_at: new Date().toISOString() }).eq('id', id))
  setSynced(userId, id, null)
}

async function saveLocal(lib: Library, universe: Universe) {
  await lib.repository(universe.id).save(universe)
  await lib.touch(universe)
}

/** Sincroniza todos os universos deste navegador com a conta. */
export async function syncAll(sb: SupabaseClient, userId: string, lib: Library): Promise<SyncReport> {
  const report: SyncReport = { uploaded: 0, downloaded: 0, conflicts: 0, removed: 0 }
  const cloud = new Map((await listCloud(sb)).map((r) => [r.id, r]))
  const local = new Map((await lib.list()).map((e) => [e.id, e]))
  const synced = syncedMap(userId)

  for (const [id, entry] of local) {
    const row = cloud.get(id)
    const last = synced[id]
    const localChanged = !last || time(entry.updatedAt) !== time(last)
    if (!row) {
      const u = await lib.repository(id).load()
      if (u) {
        await upload(sb, userId, u)
        report.uploaded++
      }
      continue
    }
    const cloudChanged = !last || time(row.updated_at) !== time(last)
    if (row.deleted) {
      if (last && !localChanged) {
        await lib.remove(id)
        setSynced(userId, id, null)
        report.removed++
      } else {
        // Mexido aqui depois de apagado lá: o trabalho daqui volta para a nuvem.
        const u = await lib.repository(id).load()
        if (u) {
          await upload(sb, userId, u)
          report.uploaded++
        }
      }
      continue
    }
    if (time(row.updated_at) === time(entry.updatedAt)) {
      setSynced(userId, id, entry.updatedAt)
      continue
    }
    if (localChanged && cloudChanged && last) {
      // Os dois lados mudaram: guarda a versão da nuvem como cópia e sobe a daqui.
      const theirs = await download(sb, id)
      await saveLocal(lib, { ...theirs, id: newId(), name: `${theirs.name} (versão da nuvem)` })
      const mine = await lib.repository(id).load()
      if (mine) await upload(sb, userId, mine)
      report.conflicts++
    } else if (time(entry.updatedAt) > time(row.updated_at)) {
      const u = await lib.repository(id).load()
      if (u) {
        await upload(sb, userId, u)
        report.uploaded++
      }
    } else {
      const u = await download(sb, id)
      await saveLocal(lib, u)
      setSynced(userId, id, u.updatedAt)
      report.downloaded++
    }
  }

  for (const [id, row] of cloud) {
    if (local.has(id) || row.deleted) continue
    const u = await download(sb, id)
    await saveLocal(lib, u)
    setSynced(userId, id, u.updatedAt)
    report.downloaded++
  }
  return report
}
