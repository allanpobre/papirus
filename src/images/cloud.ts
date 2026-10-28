import type { SupabaseClient } from '@supabase/supabase-js'
import type { ServerConfig } from '../share/server'

/** Pasta pública no Supabase (script supabase/imagens.sql). O nome do arquivo é o id do conteúdo. */
export const BUCKET = 'papirus-imagens'
/** Limite por conta, para ninguém sozinho esgotar o plano grátis. */
export const QUOTA_BYTES = 100 * 1024 * 1024

export const publicImageUrl = (server: ServerConfig, id: string) => `${server.url.trim().replace(/\/+$/, '')}/storage/v1/object/public/${BUCKET}/${id}`

export class ImageCloudError extends Error {
  readonly reason: 'cota' | 'sem-servidor' | 'outro'
  constructor(message: string, reason: 'cota' | 'sem-servidor' | 'outro' = 'outro') {
    super(message)
    this.reason = reason
  }
}

const explain = (message: string): ImageCloudError =>
  /row-level security|violates|Unauthorized|403/i.test(message)
    ? new ImageCloudError('Seu espaço de imagens na conta acabou (100 MB). Em Ajustes → Dados, limpe as imagens sem uso.', 'cota')
    : /Bucket not found|not found/i.test(message)
      ? new ImageCloudError('O servidor ainda não tem a pasta de imagens. Rode o script supabase/imagens.sql no SQL Editor do Supabase.', 'sem-servidor')
      : new ImageCloudError(/Failed to fetch|NetworkError|Load failed/i.test(message) ? 'Sem conexão com o servidor.' : message)

/** Envia a imagem. Se ela já está lá (mesmo conteúdo), conta como enviada. */
export async function uploadImage(sb: SupabaseClient, id: string, blob: Blob): Promise<void> {
  const { error } = await sb.storage.from(BUCKET).upload(id, blob, { contentType: blob.type || 'image/webp', cacheControl: '31536000', upsert: false })
  if (error && !/already exists|Duplicate|409/i.test(`${error.message} ${(error as { statusCode?: string }).statusCode ?? ''}`)) throw explain(error.message)
}

/** Quanto a conta usa, em bytes. */
export async function cloudUsage(sb: SupabaseClient): Promise<number> {
  const { data, error } = await sb.rpc('papirus_image_usage')
  if (error) throw explain(error.message)
  return Number(data) || 0
}

/** As imagens que esta conta enviou (só as próprias: a política do servidor filtra). */
export async function listCloudImages(sb: SupabaseClient): Promise<{ id: string; size: number; at: string }[]> {
  const out: { id: string; size: number; at: string }[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await sb.storage.from(BUCKET).list('', { limit: 1000, offset })
    if (error) throw explain(error.message)
    for (const f of data ?? []) if (/^[0-9a-f]{32}$/.test(f.name)) out.push({ id: f.name, size: Number((f.metadata as { size?: number } | null)?.size) || 0, at: f.created_at ?? '' })
    if (!data || data.length < 1000) return out
  }
}

export async function removeCloudImages(sb: SupabaseClient, ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += 100) {
    const { error } = await sb.storage.from(BUCKET).remove(ids.slice(i, i + 100))
    if (error) throw explain(error.message)
  }
}
