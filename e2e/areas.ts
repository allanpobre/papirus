import { expect, type Page } from '@playwright/test'

export type Part = 'Fichas' | 'Ligações' | 'Linha do tempo' | 'Mapas' | 'Pistas e mistérios' | 'Quem sabe o quê'

/**
 * Abre uma parte do Mundo ou da Trama: a entrada do menu (no celular, pelo "Mais") e depois a
 * parte no alto da tela.
 */
export async function openPart(page: Page, part: Part) {
  const area = part === 'Pistas e mistérios' || part === 'Quem sabe o quê' ? 'Trama' : 'Mundo'
  const more = page.getByRole('button', { name: 'Mais', exact: true })
  if (await more.isVisible()) {
    await more.click()
    await page.getByRole('group', { name: 'Todas as áreas' }).getByRole('button', { name: area, exact: true }).click()
  } else await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: new RegExp(`^${area}`) }).first().click()
  if (part !== 'Fichas' && part !== 'Pistas e mistérios') await page.locator('[data-tour="partes"]').getByRole('button', { name: part }).click()
}

/**
 * A ficha não tem mais Ler/Editar: é uma página só. "Editar" abre o formulário inteiro pelo menu "⋯"
 * ("Editar tudo de uma vez"); "Ler" volta para a página ("Ver a página"). Os dois não fazem nada se já estão lá.
 */
export async function fichaModo(page: Page, nome: 'Ler' | 'Editar' | 'Jogo') {
  await expect(page.locator('article.entity, article.entity-game').first()).toBeVisible()
  const voltar = page.getByRole('button', { name: 'Ver a página' })
  const naPagina = (await page.getByRole('article', { name: /^Ler a ficha/ }).count()) > 0
  if (nome === 'Ler') {
    if (!naPagina && (await voltar.count())) await voltar.click()
    return
  }
  if (!naPagina) {
    if (nome === 'Editar' && (await page.locator('.entity-head').count())) return
    await voltar.click()
  }
  await page.getByRole('button', { name: 'Mais da ficha' }).click()
  await page.getByRole('button', { name: nome === 'Editar' ? 'Editar tudo de uma vez' : 'Ficha de jogo' }).click()
}
