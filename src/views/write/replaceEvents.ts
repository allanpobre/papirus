import type { FindOptions } from '../../editor/find'

export interface ReplaceRequest {
  find?: string
  replace?: string
  opts?: Partial<FindOptions>
}

const EVENT = 'papirus:trocar-no-livro'

/** Abre "Procurar e trocar no livro" de qualquer lugar (a barra da cena, o Ctrl+K, a ficha renomeada). */
export function openBookReplace(request: ReplaceRequest = {}) {
  window.dispatchEvent(new CustomEvent<ReplaceRequest>(EVENT, { detail: request }))
}

export function onBookReplace(handler: (request: ReplaceRequest) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<ReplaceRequest>).detail ?? {})
  window.addEventListener(EVENT, listener)
  return () => window.removeEventListener(EVENT, listener)
}
