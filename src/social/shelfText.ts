import type { SupabaseClient } from '@supabase/supabase-js'
import { bookTitle, storiesOf } from '../export/bookDesign'
import { migrate } from '../model/migrations'
import { CURRENT_SCHEMA_VERSION, type BookRecord, type Universe } from '../model/schema'
import { readerCopy } from '../share/readerCopy'
import { uploadImage } from '../images/cloud'
import { idToRef, isImageRef, refToId } from '../images/ref'
import { imageId, loadImage } from '../images/store'

/** Limite do texto na estante (o servidor recusa acima de ~6 MB). */
const MAX_BYTES = 5_500_000

/**
 * O que vai para a estante quando o livro pode ser lido ali: só as histórias do livro,
 * sem segredos, sem a mesa de RPG, sem caixa de entrada, lixeira ou histórico.
 */
export function shelfTextOf(
  universe: Universe,
  book: BookRecord,
  /** A capa e a contracapa já na pasta de imagens ("img:…"): quem lê baixa na hora de folhear. */
  covers: { cover: string | null; backCover: string | null } = { cover: null, backCover: null },
): { schemaVersion: number; revision: number; universe: Universe } | null {
  const r = readerCopy(universe, false)
  const stories = storiesOf(r, book)
  const keep = new Set(stories.map((s) => s.id))
  const scenes = book.storyIds.length ? r.scenes.filter((s) => s.storyId !== null && keep.has(s.storyId)) : r.scenes
  let copy: Universe = {
    ...r,
    name: bookTitle(universe, book),
    stories,
    scenes,
    groups: [],
    sessions: [],
    revelations: [],
    systems: [],
    sheets: [],
    tables: [],
    continuity: [],
    book: null,
    // A imagem não vai dentro do texto (pesaria): só a referência dela na pasta de imagens.
    books: [{ ...book, cover: isImageRef(covers.cover) ? covers.cover : null, backCover: isImageRef(covers.backCover) ? covers.backCover : null }],
    dailyStart: {},
  }
  if (JSON.stringify(copy).length > MAX_BYTES) copy = { ...copy, maps: [] }
  if (JSON.stringify(copy).length > MAX_BYTES) return null
  return { schemaVersion: CURRENT_SCHEMA_VERSION, revision: 0, universe: copy }
}

/** Livros desta pessoa que dá para ler na estante (servidor sem a tabela: nenhum). */
export async function readableBooks(sb: SupabaseClient, ownerId: string): Promise<Set<string>> {
  const { data, error } = await sb.from('papirus_shelf_text').select('book_id').eq('owner', ownerId)
  return new Set(error ? [] : ((data ?? []) as { book_id: string }[]).map((r) => r.book_id))
}

export async function loadShelfText(sb: SupabaseClient, ownerId: string, bookId: string): Promise<Universe> {
  const { data, error } = await sb.from('papirus_shelf_text').select('data').eq('owner', ownerId).eq('book_id', bookId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Este livro não está mais disponível para ler aqui.')
  return migrate((data as { data: unknown }).data).universe
}

// O que já foi enviado nesta aba (texto grande: só manda de novo quando muda).
const sentText = new Map<string, string>()
// Capas já enviadas para a pasta de imagens (a imagem → a referência dela).
const sentCover = new Map<string, string>()

/**
 * Põe a capa na pasta pública de imagens e devolve a referência ("img:…"). A capa do Diagramar é
 * guardada como imagem embutida; a mesma imagem tem sempre o mesmo id, então só sobe uma vez.
 * Sem a pasta (ou sem espaço), a estante fica sem capa, como antes.
 */
export async function coverRef(sb: SupabaseClient, value: string | null | undefined): Promise<string | null> {
  if (!value) return null
  const known = sentCover.get(value)
  if (known) return known
  try {
    let blob: Blob | undefined
    let id: string
    if (isImageRef(value)) {
      id = refToId(value)
      blob = (await loadImage(id))?.blob
      if (!blob) return null
    } else if (value.startsWith('data:image/')) {
      blob = await (await fetch(value)).blob()
      id = await imageId(blob)
    } else return null
    await uploadImage(sb, id, blob)
    const ref = idToRef(id)
    sentCover.set(value, ref)
    return ref
  } catch {
    return null
  }
}

/** Deixa os textos da estante iguais aos livros legíveis deste universo. Erros de servidor antigo não atrapalham a vitrine. */
export async function syncShelfTexts(sb: SupabaseClient, myId: string, universe: Universe, books: { shelfId: string; book: BookRecord }[]) {
  const wanted = new Map<string, string>()
  for (const { shelfId, book } of books) {
    if (!book.shelfReadable || book.shelfVisibility === 'privado') continue
    const covers = { cover: await coverRef(sb, book.cover), backCover: await coverRef(sb, book.backCover) }
    const t = shelfTextOf(universe, book, covers)
    if (t) wanted.set(shelfId, JSON.stringify(t))
  }
  const prefix = `${universe.id}:`
  const { data, error } = await sb.from('papirus_shelf_text').select('book_id').eq('owner', myId)
  if (error) return
  const there = ((data ?? []) as { book_id: string }[]).map((r) => r.book_id).filter((id) => id.startsWith(prefix))
  for (const [id, json] of wanted) {
    const key = `${myId}|${id}`
    if (sentText.get(key) === json && there.includes(id)) continue
    const { error: e } = await sb
      .from('papirus_shelf_text')
      .upsert({ owner: myId, book_id: id, data: JSON.parse(json), updated_at: new Date().toISOString() }, { onConflict: 'owner,book_id' })
    if (!e) sentText.set(key, json)
  }
  const gone = there.filter((id) => !wanted.has(id))
  if (gone.length) {
    await sb.from('papirus_shelf_text').delete().eq('owner', myId).in('book_id', gone)
    for (const id of gone) sentText.delete(`${myId}|${id}`)
  }
}
