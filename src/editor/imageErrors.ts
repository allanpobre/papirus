/** Erros ao colar ou arrastar uma imagem na cena (mostrados pelo app). Fica à parte para o app não carregar o editor só por isso. */
let reportError: (message: string) => void = () => undefined
export function onSceneImageError(fn: (message: string) => void) {
  reportError = fn
}
export const sceneImageError = (message: string) => reportError(message)
