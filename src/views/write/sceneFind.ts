/*
 * Abrir uma cena já procurando um texto (o nome de quem está na ficha, por exemplo): quem pede guarda o
 * pedido aqui e vai para Escrever; ao abrir aquela cena, a barra de procurar aparece com o texto e o
 * primeiro achado já na tela.
 */
let pending: { sceneId: string; query: string } | null = null

export function askSceneFind(sceneId: string, query: string) {
  pending = query.trim() ? { sceneId, query: query.trim() } : null
}

/** O texto pedido para esta cena (e o pedido acaba aqui: só vale uma vez). */
export function takeSceneFind(sceneId: string): string | null {
  if (!pending || pending.sceneId !== sceneId) return null
  const { query } = pending
  pending = null
  return query
}
