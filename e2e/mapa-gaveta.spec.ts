import { expect, test } from './fixtures.ts'

/*
 * Nova cara: tocar num país do mapa abre a gaveta com quem vive lá (cartas). Editar continua num botão.
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

test('mapa: o país abre a gaveta com quem vive lá', async ({ page }) => {
  await page.addInitScript(() => {
    const prefs = JSON.parse(localStorage.getItem('papirus:prefs') ?? '{}')
    localStorage.setItem('papirus:prefs', JSON.stringify({ ...prefs, novaCara: true }))
  })
  await page.goto('/app/?exemplo')
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Mundo', exact: true }).click()
  await page.getByRole('button', { name: 'Terra dos Munchkins' }).dispatchEvent('click')
  const gaveta = page.getByRole('complementary', { name: /^Lugar: .*Munchkins/ })
  await expect(gaveta).toBeVisible()
  await expect(gaveta.locator('.place-card').first()).toBeVisible()
  // Editar no mapa mostra as ferramentas de antes (anos da região).
  await gaveta.getByRole('button', { name: 'Editar no mapa' }).click()
  await expect(page.getByRole('group', { name: /^Região de/ })).toBeVisible()
  // Abrir uma carta leva à ficha.
  await page.getByRole('button', { name: 'Terra dos Winkies' }).dispatchEvent('click')
  const outra = page.getByRole('complementary', { name: /^Lugar: .*Winkies/ })
  await outra.getByRole('button', { name: 'Abrir ficha' }).click()
  await expect(page.locator('article.entity').first()).toBeVisible()
})
