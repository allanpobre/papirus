/*
 * A Nova cara muda alguns nomes e lugares: a Trama vira “História”, a Linha do tempo sai do Mundo e vai
 * para a História, e o “Mais” do celular vira “Menu”. Os passeios, o Guia e o “O que mudou” foram escritos
 * com os nomes de sempre; com a Nova cara ligada, este texto passa por aqui para dizer o mesmo que a tela.
 */

const SWAPS: [RegExp, string][] = [
  [/O mundo em quatro partes/g, 'O mundo em três partes'],
  [/Fichas, Ligações, Linha do tempo e Mapas/g, 'Fichas, Ligações e Mapas'],
  [/com as ligações, a linha do tempo e os mapas/g, 'com as ligações e os mapas (a linha do tempo fica na História)'],
  [/Mundo › Linha do tempo/g, 'História › Linha do tempo'],
  [/menu “Mais”/g, '“Menu”'],
  [/o “Mais” do celular/g, 'o “Menu” do celular'],
  [/A Trama\b/g, 'A História'],
  [/\bTrama\b/g, 'História'],
]

/** O texto com os nomes da Nova cara (sem ela, igual). */
export function novaWords(text: string, nova: boolean): string {
  if (!nova) return text
  return SWAPS.reduce((t, [re, to]) => t.replace(re, to), text)
}

/** A Nova cara está ligada agora (o shell marca o body com data-nova). */
export const novaOn = () => typeof document !== 'undefined' && document.body.dataset.nova !== undefined

/** Um passo de passeio com os nomes da Nova cara. */
export function novaStep<T extends { title: string; body: string }>(step: T, nova: boolean): T {
  return nova
    ? {
        ...step,
        title: novaWords(step.title, true),
        body: novaWords(step.body, true),
      }
    : step
}
