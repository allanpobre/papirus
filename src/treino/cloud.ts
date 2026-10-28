import type { SupabaseClient } from '@supabase/supabase-js'
import { clearDeleted, mergeFromCloud, pendingFor, type Treino } from './treino'

/**
 * Os treinos na nuvem da conta (tabela papirus_treinos, de supabase/treinos.sql).
 * Cada tentativa é imutável: sobe o que falta, desce o que veio de outro aparelho,
 * e o que foi apagado aqui some de lá.
 */
const TABLE = 'papirus_treinos'
const COLUMNS = 'id, day, prompt, daily, minutes, target, unit, words, chars, seconds, done, text, at'

export class TreinoCloudError extends Error {}

const explain = (message: string) =>
  /relation .*papirus_treinos.* does not exist|schema cache|Could not find the table/i.test(message)
    ? 'O servidor ainda não tem a tabela de treinos. Rode o script supabase/treinos.sql no SQL Editor do Supabase.'
    : /Failed to fetch|NetworkError|Load failed/i.test(message)
      ? 'Sem conexão com o servidor.'
      : message

/** Sobe, apaga e baixa. Devolve quantos treinos chegaram de fora. */
export async function syncTreinos(sb: SupabaseClient, userId: string): Promise<number> {
  const { upload, remove } = pendingFor(userId)
  if (upload.length) {
    const { error } = await sb
      .from(TABLE)
      .upsert(
        upload.map((t) => ({ ...t, user_id: userId })),
        { onConflict: 'user_id,id', ignoreDuplicates: true },
      )
    if (error) throw new TreinoCloudError(explain(error.message))
  }
  if (remove.length) {
    const { error } = await sb.from(TABLE).delete().eq('user_id', userId).in('id', remove)
    if (error) throw new TreinoCloudError(explain(error.message))
    clearDeleted(remove)
  }
  const { data, error } = await sb.from(TABLE).select(COLUMNS).eq('user_id', userId).order('at', { ascending: false }).limit(1000)
  if (error) throw new TreinoCloudError(explain(error.message))
  const remote = (data ?? []).map((r) => ({ ...r, day: String(r.day).slice(0, 10) }) as Treino)
  const before = new Set(pendingFor(userId).upload.map((t) => t.id))
  mergeFromCloud(userId, remote, upload.map((t) => t.id))
  return remote.filter((t) => !before.has(t.id)).length
}
