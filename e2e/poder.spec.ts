import { expect, test } from './fixtures.ts'
import { openPart } from './areas.ts'

/* Poder e tensões: quem manda (e se cair?), comércio sugerido, medidor de tensão e a linha no mapa. No celular. */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

test('poder: quem manda, comércio, tensão e o mapa', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await openPart(page, 'Fichas')
  await page.getByRole('button', { name: /^Ostria/ }).first().click()
  const panel = page.locator('details.fold', { has: page.locator('summary', { hasText: 'Poder e tensões' }) })
  // Abre sozinho quando já há quem mande.
  await expect(panel).toHaveAttribute('open', '')
  await expect(panel.locator('.power-ruler')).toContainText('Cassian')
  await panel.getByRole('button', { name: 'E se cair?' }).click()
  await expect(page.getByRole('dialog')).toContainText('Cassian')
  await page.getByRole('dialog').getByRole('button', { name: /Fechar/ }).first().click()
  await panel.getByLabel('Precisa').fill('ferro')
  await panel.getByLabel('Nova tensão com').fill('Vale das')
  await panel.getByRole('option', { name: /^Vale das Brumas/ }).click()
  const meter = panel.getByRole('radiogroup', { name: 'Tensão com Vale das Brumas' })
  await expect(meter.getByRole('radio', { name: 'Tenso' })).toHaveAttribute('aria-checked', 'true')
  await meter.getByRole('radio', { name: 'Em guerra' }).click()
  await expect(meter.getByRole('radio', { name: 'Em guerra' })).toHaveAttribute('aria-checked', 'true')
  await openPart(page, 'Mapas')
  await expect(page.getByRole('img', { name: /Tensões: Ostria e Vale das Brumas/ })).toBeAttached()
})
