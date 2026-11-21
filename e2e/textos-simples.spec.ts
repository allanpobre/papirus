import { expect, test } from './fixtures.ts'

// Auditoria 21: textos sem jargão ("sem cartão") e sem "clique" no celular.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

test('a Estrutura diz "sem planejar" e o mapa pede "Toque no mapa"', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Escrever' }).click()
  await page.getByRole('button', { name: 'Estrutura', exact: true }).click()
  await expect(page.getByText(/sem planejar/).first()).toBeVisible()
  await expect(page.getByText(/sem cartão/)).toHaveCount(0)
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Mundo/ }).click()
  await page.locator('[data-tour="partes"]').getByRole('button', { name: 'Mapas' }).click()
  await page.getByRole('button', { name: 'Marcar lugar' }).click()
  await expect(page.getByRole('button', { name: 'Toque no mapa…' })).toBeVisible()
})
