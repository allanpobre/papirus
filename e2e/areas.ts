import type { Page } from '@playwright/test'

export type Part = 'Fichas' | 'Ligações' | 'Linha do tempo' | 'Atlas' | 'Pistas e mistérios' | 'Quem sabe o quê'

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
