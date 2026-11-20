import { expect, test } from './fixtures.ts'
import { openPart } from './areas.ts'

/* Rolar no mundo: a tabela sorteia do mundo e o resultado vira pista. No celular. */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

test('rolar no mundo: sorteia com nomes do mundo e vira pista', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await openPart(page, 'Fichas')
  await page.getByRole('button', { name: 'Rolar no mundo' }).click()
  const dialog = page.getByRole('dialog', { name: 'Rolar no mundo' })
  await dialog.getByRole('radio', { name: /Boato/ }).click()
  await dialog.getByRole('button', { name: /^Rolar:/ }).click()
  const result = dialog.getByRole('region', { name: 'Resultado' })
  await expect(result).toBeVisible()
  const text = (await result.locator('p').textContent()) ?? ''
  expect(text).not.toMatch(/[{}]/)
  await result.getByRole('button', { name: 'Rolar de novo' }).click()
  await expect(dialog.getByRole('list', { name: 'Rolagens de antes' })).toContainText(text.slice(0, 20))
  await result.getByRole('button', { name: 'Virar pista' }).click()
  await expect(page.getByText('Virou pista')).toBeVisible()
  await expect(result).toHaveCount(0)
})
