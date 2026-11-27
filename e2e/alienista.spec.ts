import { expect, test, type Page } from './fixtures.ts'
import { openPart } from './areas.ts'

/*
 * O segundo exemplo (O Alienista) no celular: os papéis na lista de fichas e as telas que ele precisa mostrar
 * bem (Ligações, Linha do tempo, Trama e Publicar), sem a página passar da largura.
 */
test.use({ viewport: { width: 360, height: 780 }, hasTouch: true, isMobile: true })

const cabe = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)

async function area(page: Page, nome: string) {
  const more = page.getByRole('button', { name: 'Menu', exact: true })
  const direto = page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: nome, exact: true })
  if (await direto.isVisible()) return direto.click()
  await more.click()
  await page.getByRole('group', { name: 'Todas as áreas' }).getByRole('button', { name: nome, exact: true }).click()
}

test('O Alienista no celular: papéis, Ligações, Linha do tempo, Trama e Publicar', async ({ page }) => {
  await page.goto('/app/?exemplo=alienista')
  await expect(page.getByRole('navigation', { name: 'Áreas' })).toBeVisible()

  await openPart(page, 'Fichas')
  await expect(page.locator('.entity-row').filter({ has: page.locator('.entity-row-name', { hasText: /^Simão Bacamarte/ }) }).first()).toContainText('Protagonista')
  expect(await cabe(page)).toBe(true)

  await openPart(page, 'Ligações')
  await expect(page.locator('svg').first()).toBeVisible()
  expect(await cabe(page)).toBe(true)

  await openPart(page, 'Linha do tempo')
  await expect(page.getByText(/Casa Verde/).first()).toBeVisible()
  expect(await cabe(page)).toBe(true)

  await area(page, 'Trama')
  await expect(page.locator('main')).not.toBeEmpty()
  expect(await cabe(page)).toBe(true)

  await area(page, 'Publicar')
  await expect(page.locator('main')).toContainText(/O Alienista/)
  expect(await cabe(page)).toBe(true)
})
