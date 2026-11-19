import type { Entity, Universe } from '../model/schema'
import { bookIdsOf, bookOnly } from '../model/universe'
import { sceneCounts } from './appearances'

/**
 * Quem "vale" para o livro escolhido no alto: as fichas que aparecem nas cenas dele e as que foram postas nele
 * à mão (o campo "Livros desta ficha", ou um papel naquele livro). Uma ficha sem livro e sem cena ("só nas
 * notas") não aparece em todos os livros: fica em "Todos os livros", até alguém dizer de qual livro ela é.
 * Lugares e eventos sem livro continuam valendo como pano de fundo do mundo (no mapa e na linha do tempo).
 */
export interface BookScope {
  /** Aparece em alguma cena do livro escolhido, ou foi posta nele à mão. */
  inBook: (id: string) => boolean
  /** Não aparece em livro nenhum e não foi posta em nenhum (ainda sem livro). */
  inNoBook: (id: string) => boolean
  /** Vale para o livro (o mesmo que `inBook`). */
  belongs: (id: string) => boolean
}

/** Os livros postos à mão numa ficha (o campo e os papéis por livro). */
export const handBooks = (e: Pick<Entity, 'books' | 'bookRoles'>): string[] => [...new Set([...(e.books ?? []), ...Object.keys(e.bookRoles ?? {})])]

/** A regra do livro escolhido, ou `null` sem livro (nada é filtrado). */
export function bookScope(universe: Universe, bookId: string | null): BookScope | null {
  if (!bookId) return null
  const ids = bookIdsOf(bookId) ?? []
  const inScenes = new Set(sceneCounts(bookOnly(universe, bookId)).keys())
  const anywhere = new Set(sceneCounts(universe).keys())
  const byHand = new Set(universe.entities.filter((e) => handBooks(e).some((b) => ids.includes(b))).map((e) => e.id))
  const withHand = new Set(universe.entities.filter((e) => handBooks(e).length > 0).map((e) => e.id))
  const inBook = (id: string) => inScenes.has(id) || byHand.has(id)
  return {
    inBook,
    inNoBook: (id) => !anywhere.has(id) && !withHand.has(id),
    belongs: inBook,
  }
}

/**
 * Um evento da Linha do tempo vale para o livro quando não tem ninguém ligado (pano de fundo do mundo)
 * ou quando alguém ligado (ou o lugar) vale para o livro.
 */
export function eventBelongs(event: { entityIds: string[]; placeId: string | null }, scope: BookScope | null): boolean {
  if (!scope) return true
  if (!event.entityIds.length && !event.placeId) return true
  const ok = (id: string) => scope.belongs(id) || scope.inNoBook(id)
  return event.entityIds.some(ok) || (event.placeId !== null && ok(event.placeId))
}
