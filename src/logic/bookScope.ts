import type { Universe } from '../model/schema'
import { bookOnly } from '../model/universe'
import { sceneCounts } from './appearances'

/**
 * Quem "vale" para o livro escolhido no alto: as fichas que aparecem nele e as que ainda não aparecem
 * em livro nenhum (fichas novas, que não podem sumir só porque ainda não entraram numa cena).
 * Só ficam de fora as que aparecem apenas em outros livros. Fichas, Ligações, Linha do tempo e Mapas
 * usam esta mesma regra.
 */
export interface BookScope {
  /** Aparece em alguma cena do livro escolhido. */
  inBook: (id: string) => boolean
  /** Não aparece em livro nenhum (ficha nova). */
  inNoBook: (id: string) => boolean
  /** Vale para o livro: aparece nele ou ainda não aparece em nenhum. */
  belongs: (id: string) => boolean
}

/** A regra do livro escolhido, ou `null` sem livro (nada é filtrado). */
export function bookScope(universe: Universe, bookId: string | null): BookScope | null {
  if (!bookId) return null
  const inBook = new Set(sceneCounts(bookOnly(universe, bookId)).keys())
  const anywhere = new Set(sceneCounts(universe).keys())
  return {
    inBook: (id) => inBook.has(id),
    inNoBook: (id) => !anywhere.has(id),
    belongs: (id) => inBook.has(id) || !anywhere.has(id),
  }
}

/**
 * Um evento da Linha do tempo vale para o livro quando não tem ninguém ligado (pano de fundo do mundo)
 * ou quando alguém ligado (ou o lugar) vale para o livro.
 */
export function eventBelongs(event: { entityIds: string[]; placeId: string | null }, scope: BookScope | null): boolean {
  if (!scope) return true
  if (!event.entityIds.length && !event.placeId) return true
  return event.entityIds.some((id) => scope.belongs(id)) || (event.placeId !== null && scope.belongs(event.placeId))
}
