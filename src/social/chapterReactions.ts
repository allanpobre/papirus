import type { SupabaseClient } from '@supabase/supabase-js'

/** Reações no fim de cada capítulo (uma por pessoa e capítulo; dá para trocar ou tirar). */
export const CHAPTER_EMOJIS = ['❤️', '😮', '😂', '😢', '🔥'] as const
export type ChapterEmoji = (typeof CHAPTER_EMOJIS)[number]
export const EMOJI_NAME: Record<ChapterEmoji, string> = { '❤️': 'Amei', '😮': 'Surpresa', '😂': 'Ri', '😢': 'Triste', '🔥': 'Demais' }

export interface ChapterReaction {
  owner: string
  book_id: string
  scene_id: string
  user_id: string
  emoji: ChapterEmoji
  created_at: string
}

export async function chapterReactions(sb: SupabaseClient, ownerId: string, bookId: string): Promise<ChapterReaction[]> {
  const { data, error } = await sb.from('papirus_chapter_reactions').select('owner,book_id,scene_id,user_id,emoji,created_at').eq('owner', ownerId).eq('book_id', bookId)
  // Servidor sem a parte nova do script: sem reações.
  return error ? [] : ((data ?? []) as ChapterReaction[])
}

export async function reactToChapter(sb: SupabaseClient, myId: string, ownerId: string, bookId: string, sceneId: string, emoji: ChapterEmoji | null) {
  const { error } =
    emoji === null
      ? await sb.from('papirus_chapter_reactions').delete().eq('owner', ownerId).eq('book_id', bookId).eq('scene_id', sceneId).eq('user_id', myId)
      : await sb
          .from('papirus_chapter_reactions')
          .upsert({ owner: ownerId, book_id: bookId, scene_id: sceneId, user_id: myId, emoji, created_at: new Date().toISOString() }, { onConflict: 'owner,book_id,scene_id,user_id' })
  if (error) throw new Error(/does not exist|schema cache/i.test(error.message) ? 'O servidor ainda não aceita reações. Rode de novo o script supabase/social.sql.' : error.message)
}

/** Contagem por capítulo e emoji. */
export function tally(list: ChapterReaction[]): Map<string, Partial<Record<ChapterEmoji, number>>> {
  const out = new Map<string, Partial<Record<ChapterEmoji, number>>>()
  for (const r of list) {
    const m = out.get(r.scene_id) ?? {}
    m[r.emoji] = (m[r.emoji] ?? 0) + 1
    out.set(r.scene_id, m)
  }
  return out
}
