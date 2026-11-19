import { expect, test } from './fixtures.ts'

/*
 * Nova cara: as Ligações abrem no mural em foco (uma ficha no centro e só as ligações dela). Tocar em outra
 * ficha a traz para o centro; o grafo completo continua a um toque. No celular.
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

test('mural em foco: a protagonista no centro, trocar o centro e ir ao grafo completo', async ({ page }) => {
  await page.addInitScript(() => {
    const prefs = JSON.parse(localStorage.getItem('papirus:prefs') ?? '{}')
    localStorage.setItem('papirus:prefs', JSON.stringify({ ...prefs, novaCara: true }))
  })
  await page.goto('/app/?exemplo')
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Mundo', exact: true }).click()
  await page.locator('[data-tour="partes"]').getByRole('button', { name: /Ligações/ }).click()
  // Sem escolher, a protagonista fica no centro.
  const mural = page.getByRole('group', { name: 'Mural de Dorothy' })
  await expect(mural).toBeVisible()
  await expect(mural.getByRole('button', { name: /^Espantalho:/ })).toBeVisible()
  // A régua: no começo da história, o Espantalho ainda não está ligado à Dorothy.
  const regua = page.getByRole('combobox', { name: 'Até onde na história' })
  await regua.selectOption({ index: 1 })
  await expect(mural.getByRole('button', { name: /^Espantalho:/ })).toHaveCount(0)
  await regua.selectOption({ index: 0 })
  // Tocar no Espantalho o traz para o centro.
  await mural.getByRole('button', { name: /^Espantalho:/ }).click()
  await expect(page.getByRole('group', { name: 'Mural do Espantalho' }).or(page.getByRole('group', { name: 'Mural de Espantalho' }))).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Ficha no centro do mural' }).locator('option:checked')).toHaveText('Espantalho')
  // O grafo completo continua a um toque, e volta ao mural.
  await page.getByRole('button', { name: 'Grafo completo' }).click()
  await page.getByRole('button', { name: 'Voltar ao mural' }).click()
  await expect(page.getByRole('combobox', { name: 'Ficha no centro do mural' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
