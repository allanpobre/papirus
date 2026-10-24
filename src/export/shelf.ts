import type { BookDesign, BookRecord, Universe } from '../model/schema'
import { insert, patch, remove } from '../model/universe'
import { defaultDesign } from './bookDesign'

/**
 * A estante: os livros de um universo (série, volumes, contos). Cada um com capa,
 * histórias e diagramação próprias. Universos do formato antigo (um livro só)
 * aparecem com esse livro na estante, e ele vira um livro de verdade na primeira mudança.
 */
const LEGACY_ID = 'livro-1'

export function shelf(u: Universe): BookRecord[] {
  if (u.books.length) return u.books
  if (u.book) return [{ ...u.book, id: LEGACY_ID, createdAt: u.createdAt, updatedAt: u.updatedAt }]
  return []
}

/** Passa o livro do formato antigo para a estante (uma vez). */
function materialize(u: Universe): Universe {
  if (u.books.length || !u.book) return u
  return { ...u, books: shelf(u), book: null }
}

/** O que é estilo (vai junto ao copiar o estilo de outro livro da série). O resto é conteúdo de cada livro. */
const CONTENT_KEYS = ['storyIds', 'title', 'subtitle', 'cover', 'backCover', 'dedication', 'epigraph', 'epigraphSource', 'acknowledgments', 'blurb', 'shelfVisibility'] as const

export function styleOf(b: BookDesign): Partial<BookDesign> {
  const out: Partial<BookDesign> = { ...b }
  for (const k of CONTENT_KEYS) delete out[k]
  delete (out as Partial<BookRecord>).id
  delete (out as Partial<BookRecord>).createdAt
  delete (out as Partial<BookRecord>).updatedAt
  return out
}

/** Histórias que ainda não estão em nenhum livro (para sugerir no próximo). */
export function storiesOutsideBooks(u: Universe): string[] {
  const used = new Set(shelf(u).flatMap((b) => (b.storyIds.length ? b.storyIds : u.stories.map((s) => s.id))))
  return u.stories.filter((s) => !used.has(s.id)).map((s) => s.id)
}

export function addBook(u: Universe, opts: { title?: string; styleFrom?: string | null; storyIds?: string[] } = {}): [Universe, BookRecord] {
  const base = materialize(u)
  const from = opts.styleFrom ? shelf(base).find((b) => b.id === opts.styleFrom) : undefined
  const free = storiesOutsideBooks(base)
  const storyIds = opts.storyIds ?? (shelf(base).length === 0 ? [] : free.length ? free : [])
  const design: BookDesign = { ...defaultDesign(), ...(from ? styleOf(from) : {}), title: opts.title?.trim() ?? '', storyIds }
  return insert(base, 'books', design)
}

export function updateBook(u: Universe, id: string, changes: Partial<BookDesign>): Universe {
  return patch(materialize(u), 'books', id, changes)
}

export function removeBook(u: Universe, id: string): Universe {
  return remove(materialize(u), 'books', id)
}

/** Copia o estilo de um livro para outro (fontes, capítulos, margens…), mantendo título, capa e histórias. */
export function copyStyle(u: Universe, fromId: string, toId: string): Universe {
  const from = shelf(u).find((b) => b.id === fromId)
  return from ? updateBook(u, toId, styleOf(from)) : u
}
