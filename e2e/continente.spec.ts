import { expect, test } from './fixtures.ts'
import { openPart } from './areas.ts'

/* Gerar um continente para começar um mapa. No celular. */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

test('gerar continente: vira um mapa novo e "Outro" troca a imagem', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await openPart(page, 'Mapas')
  await page.getByRole('button', { name: 'Gerar', exact: true }).click()
  await expect(page.getByRole('tab', { name: 'Continente' })).toHaveAttribute('aria-selected', 'true')
  const img = page.locator('.atlas-image')
  await expect(img).toHaveAttribute('style', /data:image\/jpeg/)
  const before = await img.getAttribute('style')
  await page.getByRole('button', { name: 'Outro' }).first().click()
  await expect.poll(() => img.getAttribute('style')).not.toBe(before)
  await expect(page.getByRole('tab', { name: 'Continente' })).toHaveCount(1)
})
