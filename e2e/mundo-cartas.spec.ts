import { expect, test } from './fixtures.ts'
import { fichaModo } from './areas.ts'

/*
 * Nova cara: o Mundo abre no mapa (quando há um), as fichas viram cartas com rosto e os filtros ficam num
 * botão. No celular.
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

test('Mundo pelo mapa e fichas como cartas, com os filtros num botão', async ({ page }) => {
  await page.addInitScript(() => {
    const prefs = JSON.parse(localStorage.getItem('papirus:prefs') ?? '{}')
    localStorage.setItem('papirus:prefs', JSON.stringify({ ...prefs, novaCara: true }))
  })
  await page.goto('/app/?exemplo')
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Mundo', exact: true }).click()
  // O exemplo tem mapa: o Mundo abre nele.
  const partes = page.locator('[data-tour="partes"]')
  await expect(partes.getByRole('button', { name: 'Mapas' })).toHaveAttribute('aria-current', /true|page/)
  await partes.getByRole('button', { name: 'Fichas' }).click()

  const lista = page.getByRole('region', { name: 'Lista de fichas' })
  await expect(lista.locator('.entity-list.is-cards')).toBeVisible()
  await expect(lista.locator('.entity-card-face').first()).toBeVisible()
  // Menos controles: o filtro de tipo só aparece ao abrir "Filtros".
  await expect(lista.getByRole('combobox', { name: 'Filtrar por tipo' })).toHaveCount(0)
  await lista.getByRole('button', { name: /^Filtros/ }).click()
  await lista.getByRole('combobox', { name: 'Filtrar por tipo' }).selectOption('personagem')
  await expect(lista.getByRole('button', { name: /^Filtros •/ })).toBeVisible()
  // A carta da protagonista tem o selo do papel e abre a ficha.
  await lista.getByRole('button', { name: /^Dorothy/ }).first().click()
  await fichaModo(page, 'Ler')
  await expect(page.getByRole('region', { name: 'Retrato de Dorothy' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
