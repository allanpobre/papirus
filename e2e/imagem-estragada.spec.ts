import { expect, test } from './fixtures.ts'
import { openPart } from './areas.ts'

// Um arquivo de imagem estragado falhava calado (a janela de recorte abria e fechava). Agora avisa.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

const ESTRAGADA = { name: 'retrato.png', mimeType: 'image/png', buffer: Buffer.from('isto não é uma imagem de verdade'.repeat(50)) }

test('retrato com arquivo estragado: aviso claro, e a ficha continua sem retrato', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await openPart(page, 'Fichas')
  await page.getByRole('region', { name: 'Lista de fichas' }).getByRole('button', { name: /^Rhea/ }).first().click()
  await page.locator('.portrait-edit input[type=file]').setInputFiles(ESTRAGADA)
  await expect(page.getByText('Não consegui abrir esta imagem. Tente outro arquivo (JPG, PNG ou WebP).')).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Enquadrar o retrato' })).toHaveCount(0)
})
