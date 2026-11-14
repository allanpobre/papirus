import { openPart } from './areas.ts'
import { expect, test } from './fixtures.ts'

/** Abre a Linha do tempo de Ostria com os filtros à vista (no celular ficam atrás do botão). */
async function abrir(page: import('@playwright/test').Page) {
  await page.goto('/app/?exemplo=ostria')
  await openPart(page, 'Linha do tempo')
  await page.locator('ol.timeline').waitFor()
  const filtros = page.getByRole('button', { name: /^Filtros/ })
  if (await filtros.isVisible()) await filtros.click()
}

const linha = (page: import('@playwright/test').Page) => page.locator('ol.timeline')

test('filtrar por lugar mostra o que aconteceu ali e nos lugares dentro dele', async ({ page }) => {
  await abrir(page)
  const tl = linha(page)
  await expect(tl.getByText('Fundação de Ostria')).toBeVisible()
  await expect(tl.getByText('Nascimento de Vaelor')).toBeVisible()
  await expect(tl.getByText('Cassian assume a regência')).toBeVisible()

  // O Paço do Regente: só o que aconteceu nele.
  const onde = page.getByRole('combobox', { name: 'Onde aconteceu' })
  await onde.fill('Paço')
  await page.getByRole('option', { name: /^Paço do Regente/ }).click()
  await expect(tl.getByText('Cassian assume a regência')).toBeVisible()
  await expect(tl.getByText('Fundação de Ostria')).toHaveCount(0)
  await expect(tl.getByText('Nascimento de Vaelor')).toHaveCount(0)

  // Ostria: o que aconteceu nela e nos lugares dentro dela (o Paço, a Torre, a Taverna), e nada do que não tem lugar.
  await page.getByRole('button', { name: 'Limpar Onde aconteceu' }).click()
  await page.getByRole('combobox', { name: 'Onde aconteceu' }).fill('Ostria')
  await page.getByRole('option', { name: /^Ostria/ }).first().click()
  await expect(tl.getByText('Fundação de Ostria')).toBeVisible()
  await expect(tl.getByText('A Queda')).toBeVisible()
  await expect(tl.getByText('Cassian assume a regência')).toBeVisible()
  await expect(tl.getByText('Nascimento de Vaelor')).toHaveCount(0)
  // O botão de filtros diz que há um ligado.
  await expect(page.locator('.timeline-filters')).toBeVisible()

  // Limpando, volta tudo.
  await page.getByRole('button', { name: 'Limpar Onde aconteceu' }).click()
  await expect(tl.getByText('Nascimento de Vaelor')).toBeVisible()
})

test('filtrar por uma região do mapa: o dono e os lugares marcados dentro dela, e o que fica dentro deles', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  // Sem região pintada, não há o que escolher.
  await openPart(page, 'Linha do tempo')
  await expect(page.getByRole('combobox', { name: 'Região do mapa' })).toHaveCount(0)

  // Pinta uma região da Casa de Vaelor em volta de Ostria e do Paço (a Torre, a Taverna e o Vale das Brumas ficam fora do desenho).
  await openPart(page, 'Mapas')
  await page.getByRole('button', { name: 'Pintar região' }).click()
  const paint = page.getByRole('group', { name: 'Pintar região' })
  await paint.getByRole('combobox', { name: 'De quem é esta região?' }).fill('Casa de V')
  await page.getByRole('option', { name: /Casa de Vaelor/ }).first().click()
  const map = page.locator('.atlas-image')
  const box = (await map.boundingBox())!
  for (const [x, y] of [
    [0.47, 0.35],
    [0.7, 0.35],
    [0.7, 0.75],
    [0.47, 0.75],
  ])
    await map.click({ position: { x: box.width * x, y: box.height * y } })
  await paint.getByRole('button', { name: 'Concluir' }).click()
  await expect(page.locator('.atlas-region-label', { hasText: 'Casa de Vaelor' })).toBeVisible()

  await openPart(page, 'Linha do tempo')
  await page.locator('ol.timeline').waitFor()
  const filtros = page.getByRole('button', { name: /^Filtros/ })
  if (await filtros.isVisible()) await filtros.click()
  await page.getByLabel('Região do mapa').selectOption({ label: 'Casa de Vaelor' })
  const tl = linha(page)
  // Ostria e o Paço estão dentro do desenho: o que aconteceu neles aparece.
  await expect(tl.getByText('A Queda')).toBeVisible()
  await expect(tl.getByText('Cassian assume a regência')).toBeVisible()
  // O que não tem lugar fica de fora.
  await expect(tl.getByText('Nascimento de Vaelor')).toHaveCount(0)
  await page.getByLabel('Região do mapa').selectOption({ label: 'Qualquer lugar' })
  await expect(tl.getByText('Nascimento de Vaelor')).toBeVisible()
})

test.describe('no celular', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('o filtro de lugar está nos Filtros e o botão conta um filtro ligado', async ({ page }) => {
    await abrir(page)
    await page.getByRole('combobox', { name: 'Onde aconteceu' }).fill('Paço')
    await page.getByRole('option', { name: /^Paço do Regente/ }).click()
    await expect(page.getByRole('button', { name: /^Filtros 1/ })).toBeVisible()
    await expect(linha(page).getByText('Cassian assume a regência')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
})
