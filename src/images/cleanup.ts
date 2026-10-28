import type { SupabaseClient } from '@supabase/supabase-js'
import type { Library } from '../persistence/repository'
import { listCloudImages, removeCloudImages } from './cloud'
import { imageIdsIn } from './ref'
import { deleteImage, listImages } from './store'

const DAY = 24 * 3600 * 1000

/** Imagens citadas pelos universos deste navegador, incluindo snapshots e a versão anterior salva. */
export async function imagesInUseHere(library: Library): Promise<Set<string>> {
  const used = new Set<string>()
  for (const e of await library.list()) {
    const repo = library.repository(e.id)
    imageIdsIn(await repo.load(), used)
    imageIdsIn(await library.store.get(`universe:${e.id}:previous`), used)
    for (const s of await repo.listSnapshots()) {
      try {
        imageIdsIn(await repo.readSnapshot(s.id), used)
      } catch {
        // Snapshot ilegível: não muda nada.
      }
    }
  }
  return used
}

/** Quanto as imagens ocupam neste navegador. */
export async function localImageStats(): Promise<{ count: number; bytes: number }> {
  const all = await listImages()
  return { count: all.length, bytes: all.reduce((n, i) => n + i.blob.size, 0) }
}

/**
 * Apaga deste navegador as imagens que nenhum universo daqui usa. As de menos de um dia
 * ficam (podem ser de algo que ainda está sendo salvo, ou de um universo compartilhado aberto agora).
 * As que vieram de universos de outras pessoas voltam a ser baixadas se aparecerem de novo.
 */
export async function cleanLocalImages(library: Library): Promise<{ count: number; bytes: number }> {
  const used = await imagesInUseHere(library)
  let count = 0
  let bytes = 0
  for (const img of await listImages()) {
    if (used.has(img.id) || Date.now() - Date.parse(img.at) < DAY) continue
    await deleteImage(img.id)
    count++
    bytes += img.blob.size
  }
  return { count, bytes }
}

/**
 * Apaga do servidor as imagens desta conta que não aparecem em nenhum lugar: nem nos universos
 * deste navegador, nem nos da conta (todos os aparelhos), nem nos compartilhados com você.
 * As enviadas na última semana ficam, por segurança (outro aparelho pode estar no meio de salvar).
 */
export async function cleanCloudImages(sb: SupabaseClient, userId: string, email: string, library: Library): Promise<{ count: number; bytes: number; ids: string[] }> {
  const used = await imagesInUseHere(library)
  const mine = await sb.from('papirus_universes').select('data').eq('user_id', userId)
  if (mine.error) throw new Error(mine.error.message)
  for (const r of mine.data ?? []) imageIdsIn(r.data, used)
  const invites = await sb.from('papirus_members').select('universe_id').eq('email', email.trim().toLowerCase())
  if (invites.error) throw new Error(invites.error.message)
  const ids = (invites.data ?? []).map((i) => i.universe_id as string)
  if (ids.length) {
    const shared = await sb.from('papirus_shares').select('data').in('universe_id', ids)
    if (shared.error) throw new Error(shared.error.message)
    for (const r of shared.data ?? []) imageIdsIn(r.data, used)
  }
  const gone = (await listCloudImages(sb)).filter((i) => !used.has(i.id) && (!i.at || Date.now() - Date.parse(i.at) > 7 * DAY))
  await removeCloudImages(
    sb,
    gone.map((i) => i.id),
  )
  return { count: gone.length, bytes: gone.reduce((n, i) => n + i.size, 0), ids: gone.map((i) => i.id) }
}
