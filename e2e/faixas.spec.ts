import { expect, test } from './fixtures.ts'
import { openPart } from './areas.ts'

/* Linha do tempo em faixas: faixas por personagem, causa → consequência e arrastar para mudar o ano. No celular. */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

test('faixas: uma por personagem, causa e consequência, e arrastar muda o ano', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await openPart(page, 'Linha do tempo')
  await page.getByRole('radiogroup', { name: 'Como ver' }).getByRole('radio', { name: 'Faixas' }).click()
  const faixas = page.getByRole('region', { name: 'Linha do tempo em faixas' })
  await expect(faixas.locator('.lane-name', { hasText: 'Ilsa' })).toBeVisible()
  await expect(faixas.locator('.lane-arrows path:not(marker path)')).not.toHaveCount(0)
  // Arrastar "Fechamento da Torre" para antes da Queda: aparece o aviso, e "Desfazer" volta.
  const ev = faixas.getByRole('button', { name: /^Fechamento da Torre/ }).first()
  await ev.scrollIntoViewIfNeeded()
  const box = (await ev.boundingBox())!
  await page.mouse.move(box.x + 6, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x - 40, box.y + box.height / 2, { steps: 5 })
  await page.mouse.move(box.x - 80, box.y + box.height / 2, { steps: 5 })
  await page.mouse.up()
  await expect(faixas.getByRole('list', { name: 'Fora de ordem' })).toContainText('Fechamento da Torre')
  await page.getByRole('button', { name: 'Desfazer' }).click()
  await expect(faixas.getByRole('list', { name: 'Fora de ordem' })).toHaveCount(0)
  // Abrir pelo toque e ver "Causado por".
  await faixas.getByRole('button', { name: /^Fechamento da Torre/ }).first().click()
  await expect(page.getByRole('dialog', { name: 'Evento' }).getByRole('button', { name: 'Tirar A Queda' })).toBeVisible()
})
