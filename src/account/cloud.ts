import type { SupabaseClient } from '@supabase/supabase-js'
import { migrate } from '../model/migrations'
import { CURRENT_SCHEMA_VERSION, type Universe } from '../model/schema'
import { countWords, type Library } from '../persistence/repository'
import { keepCloudCopy, sameUniverse } from '../persistence/cloudCopy'
import { addVersion, trimVersions } from '../persistence/versions'
import { mergeUniverse, stableJson } from '../share/merge'

/**
 * Universos na nuvem da conta. Regras (nunca perdem trabalho):
 * - só num lado: copia para o outro;
 * - mudou só de um lado desde a última sincronização: vale o lado que mudou;
 * - mudou dos dois lados, em lugares diferentes (uma cena aqui, uma ficha lá): junta sozinho,
 *   a partir do ponto em comum guardado na última sincronização;
 * - mudou dos dois lados no mesmo lugar (a mesma cena, a mesma ficha, o nome): nada é enviado nem
 *   recebido; fica à espera da escolha da pessoa (juntar, ficar com a daqui, ficar com a da nuvem);
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
  /** Universos à espera de uma escolha (os dois lados mudaram no mesmo lugar). */
  conflicts: number
  removed: number
  /** Universos em que as mudanças dos dois lados foram juntadas sozinhas. */
  merged: number
}

/** Quantas cenas e fichas diferem (mudaram, entraram ou saíram). */
export interface Diff {
  scenes: number
  entities: number
}

/** Um universo cujos dois lados mudaram no mesmo lugar: o que a dupla mostra enquanto a pessoa não escolhe. */
export interface PendingConflict {
  /** A data e o tamanho do lado da nuvem. */
  cloudAt: string
  cloudWords: number
  /** O que cada lado mudou desde o ponto em comum (se ele foi guardado). */
  here?: Diff
  cloud?: Diff
  /** O que difere entre os dois lados. */
  between: Diff
  /** Há ponto em comum guardado: dá para juntar. */
  canMerge: boolean
  /** O que mudou dos dois lados ao mesmo tempo ("A chegada", "o nome"). */
  overlap: string[]
}

const byId = (list: { id: string }[]) => new Map(list.map((x) => [x.id, stableJson(x)]))
const countDiff = (a: { id: string }[], b: { id: string }[]) => {
  const [ma, mb] = [byId(a), byId(b)]
  let n = 0
  for (const [id, json] of ma) if (mb.get(id) !== json) n++
  for (const id of mb.keys()) if (!ma.has(id)) n++
  return n
}
/** O que difere entre dois universos, em cenas e fichas. */
export const differences = (a: Universe, b: Universe): Diff => ({ scenes: countDiff(a.scenes, b.scenes), entities: countDiff(a.entities, b.entities) })

const LOOSE_LABEL: Record<string, string> = { name: 'o nome', description: 'a descrição', settings: 'os ajustes do universo', book: 'o livro' }
/**
 * Campos soltos (nome, descrição, ajustes) que os dois lados mudaram de jeitos diferentes. Juntar
 * sozinho ficaria com um e perderia o outro, então isso também pede a escolha da pessoa.
 */
function looseClashes(base: Universe, mine: Universe, theirs: Universe): string[] {
  const skip = new Set(['updatedAt', 'history', 'dailyStart', 'cloudCopyOf', 'versionKind', 'id'])
  const out: string[] = []
  for (const key of Object.keys(mine) as (keyof Universe)[]) {
    if (skip.has(key) || Array.isArray(mine[key])) continue
    const [b, m, t] = [stableJson(base[key]), stableJson(mine[key]), stableJson(theirs[key])]
    if (m !== b && t !== b && m !== t) out.push(LOOSE_LABEL[key] ?? key)
  }
  return out
}

/** Universos à espera de uma escolha, por conta, neste navegador. */
export function pendingConflicts(userId: string): Record<string, PendingConflict> {
  try {
    return JSON.parse(localStorage.getItem(`papirus:conflitos:${userId}`) ?? '{}') as Record<string, PendingConflict>
  } catch {
    return {}
  }
}

export function setPending(userId: string, id: string, info: PendingConflict | null) {
  const map = pendingConflicts(userId)
  if (info === null && !(id in map)) return
  if (info === null) delete map[id]
  else map[id] = info
  try {
    localStorage.setItem(`papirus:conflitos:${userId}`, JSON.stringify(map))
  } catch {
    // Sem armazenamento: o conflito é achado de novo na próxima sincronização.
  }
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

export function setSynced(userId: string, id: string, updatedAt: string | null) {
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

// Sempre filtra pelo dono: quem pode editar o universo de outra pessoa também o enxerga na tabela.
export async function listCloud(sb: SupabaseClient, userId: string): Promise<CloudRow[]> {
  return check(await sb.from(TABLE).select('id,name,words,updated_at,deleted').eq('user_id', userId)) as CloudRow[]
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

/** Grava só se ninguém gravou desde `stamp`. `false` = outra pessoa ou aparelho gravou antes. */
export async function uploadIfUnchanged(sb: SupabaseClient, userId: string, universe: Universe, stamp: string): Promise<boolean> {
  const rows = check(
    await sb
      .from(TABLE)
      .update({
        name: universe.name,
        words: countWords(universe),
        data: { schemaVersion: CURRENT_SCHEMA_VERSION, revision: 0, universe },
        updated_at: universe.updatedAt,
        deleted: false,
      })
      .eq('user_id', userId)
      .eq('id', universe.id)
      .eq('updated_at', stamp)
      .select('id'),
  ) as unknown[]
  if (rows.length) setSynced(userId, universe.id, universe.updatedAt)
  return rows.length > 0
}

/** Data da última gravação na nuvem (ou `null` se não está lá). */
export async function cloudStamp(sb: SupabaseClient, userId: string, id: string): Promise<{ updated_at: string; deleted: boolean } | null> {
  return check(await sb.from(TABLE).select('updated_at,deleted').eq('user_id', userId).eq('id', id).maybeSingle()) as { updated_at: string; deleted: boolean } | null
}

export async function download(sb: SupabaseClient, userId: string, id: string): Promise<Universe> {
  const row = check(await sb.from(TABLE).select('data').eq('user_id', userId).eq('id', id).single()) as { data: unknown }
  return migrate(row.data).universe
}

/** Marca como apagado na nuvem (os outros aparelhos ficam sabendo). */
export async function removeFromCloud(sb: SupabaseClient, userId: string, id: string) {
  check(await sb.from(TABLE).update({ deleted: true, data: null, updated_at: new Date().toISOString() }).eq('user_id', userId).eq('id', id))
  setSynced(userId, id, null)
}

async function saveLocal(lib: Library, universe: Universe) {
  await lib.repository(universe.id).save(universe)
  await lib.touch(universe)
}

/** Sincroniza todos os universos deste navegador com a conta. */
export async function syncAll(sb: SupabaseClient, userId: string, lib: Library): Promise<SyncReport> {
  const report: SyncReport = { uploaded: 0, downloaded: 0, conflicts: 0, removed: 0, merged: 0 }
  /** Envia e guarda o ponto em comum: daqui em diante, este aparelho e a nuvem estão iguais. */
  const send = async (u: Universe) => {
    await upload(sb, userId, u)
    await lib.repository(u.id).saveBase(u)
    setPending(userId, u.id, null)
  }
  const cloud = new Map((await listCloud(sb, userId)).map((r) => [r.id, r]))
  const local = new Map((await lib.list()).map((e) => [e.id, e]))
  const synced = syncedMap(userId)

  for (const [id, entry] of local) {
    // O exemplo fica só neste aparelho; a versão da nuvem guardada ao lado também.
    if (entry.sample || entry.cloudCopyOf) continue
    const row = cloud.get(id)
    const last = synced[id]
    const localChanged = !last || time(entry.updatedAt) !== time(last)
    if (!row) {
      const u = await lib.repository(id).load()
      if (u) {
        await send(u)
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
          await send(u)
          report.uploaded++
        }
      }
      continue
    }
    if (time(row.updated_at) === time(entry.updatedAt)) {
      setSynced(userId, id, entry.updatedAt)
      setPending(userId, id, null)
      // Iguais agora: se ainda não há ponto em comum guardado (universos de antes disto), guarda.
      const repo = lib.repository(id)
      if (!(await repo.baseAt())) {
        const u = await repo.load()
        if (u) await repo.saveBase(u)
      }
      continue
    }
    if (localChanged && cloudChanged && last) {
      // Os dois lados mudaram.
      const repo = lib.repository(id)
      const theirs = await download(sb, userId, id)
      const mine = await repo.load()
      if (!mine) continue
      if (sameUniverse(mine, theirs)) {
        // Ficaram iguais: nada a escolher.
        await send(mine)
        continue
      }
      const base = await repo.loadBase()
      const merge = base ? mergeUniverse(base, mine, theirs, 'outro aparelho') : null
      const overlap = base && merge ? [...merge.copies, ...looseClashes(base, mine, theirs)] : []
      if (merge && !overlap.length) {
        // Mexeram em lugares diferentes: junta sozinho, e os dois lados ficam com o resultado.
        const merged = merge.universe
        if (merged !== mine) await saveLocal(lib, merged)
        await send(merged)
        report.merged++
      } else {
        // O mesmo lugar mudou dos dois lados (ou não há ponto em comum): espera a escolha. Nada é enviado nem recebido.
        setPending(userId, id, {
          cloudAt: row.updated_at,
          cloudWords: countWords(theirs),
          ...(base ? { here: differences(base, mine), cloud: differences(base, theirs) } : {}),
          between: differences(mine, theirs),
          canMerge: Boolean(base),
          overlap,
        })
        report.conflicts++
      }
    } else if (time(entry.updatedAt) > time(row.updated_at)) {
      const u = await lib.repository(id).load()
      if (u) {
        await send(u)
        report.uploaded++
      }
    } else {
      const u = await download(sb, userId, id)
      await saveLocal(lib, u)
      setSynced(userId, id, u.updatedAt)
      await lib.repository(id).saveBase(u)
      setPending(userId, id, null)
      report.downloaded++
    }
  }

  for (const [id, row] of cloud) {
    if (local.has(id) || row.deleted) continue
    const u = await download(sb, userId, id)
    await saveLocal(lib, u)
    setSynced(userId, id, u.updatedAt)
    await lib.repository(id).saveBase(u)
    report.downloaded++
  }

  // Uma versão guardada cujo universo não existe mais (nem aqui, nem na conta) é a única que sobrou:
  // volta a ser um universo, e sobe na próxima sincronização.
  const here = await lib.list()
  const ids = new Set(here.map((e) => e.id))
  for (const e of here) {
    if (!e.cloudCopyOf || ids.has(e.cloudCopyOf)) continue
    const u = await lib.repository(e.id).load()
    if (u) await saveLocal(lib, { ...u, cloudCopyOf: null, versionKind: null })
  }
  return report
}

/**
 * A escolha da pessoa quando os dois lados mudaram no mesmo lugar:
 * - `juntar`: junta as duas a partir do ponto em comum; onde o mesmo item mudou dos dois lados,
 *   fica o daqui e o da nuvem entra ao lado, com "(versão de outro aparelho)" no nome;
 * - `aqui`: fica a deste aparelho; a da nuvem vira versão guardada;
 * - `nuvem`: fica a da nuvem; a deste aparelho vira versão guardada.
 * Devolve os itens que entraram ao lado (só em `juntar`).
 */
export async function resolveConflict(sb: SupabaseClient, userId: string, lib: Library, id: string, how: 'juntar' | 'aqui' | 'nuvem'): Promise<string[]> {
  const repo = lib.repository(id)
  const theirs = await download(sb, userId, id)
  const mine = await repo.load()
  if (!mine) throw new CloudError('Não achei este universo neste aparelho.')
  const base = how === 'juntar' ? await repo.loadBase() : null
  let copies: string[] = []
  if (how === 'nuvem') {
    await addVersion(lib, id, mine, 'anterior')
    await saveLocal(lib, theirs)
    setSynced(userId, id, theirs.updatedAt)
    await repo.saveBase(theirs)
  } else {
    let keep = mine
    if (base) {
      const merge = mergeUniverse(base, mine, theirs, 'outro aparelho')
      keep = merge.universe
      copies = merge.copies
      if (keep !== mine) await saveLocal(lib, keep)
    } else {
      // Ficar com a daqui (ou não há como juntar): a da nuvem fica guardada.
      await keepCloudCopy(lib, id, theirs)
    }
    await upload(sb, userId, keep)
    await repo.saveBase(keep)
  }
  await trimVersions(lib, id)
  setPending(userId, id, null)
  return copies
}
