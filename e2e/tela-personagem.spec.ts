import { expect, test } from './fixtures.ts'
import { fichaModo } from './areas.ts'

/*
 * Nova cara: a ficha vira a tela do personagem. Retrato em moldura, atributos em volta, papel, selos do Quem é
 * e abas (Visão, Ligações, Poderes, Diário, Referências). Tocar no retrato edita ali mesmo. No celular.
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

test('tela do personagem: retrato, selos, abas e editar pelo retrato', async ({ page }) => {
  await page.addInitScript(() => {
    const prefs = JSON.parse(localStorage.getItem('papirus:prefs') ?? '{}')
    localStorage.setItem('papirus:prefs', JSON.stringify({ ...prefs, novaCara: true }))
  })
  await page.goto('/app/?exemplo')
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Mundo', exact: true }).click()
  await page.getByRole('region', { name: 'Lista de fichas' }).getByRole('button', { name: /^Dorothy/ }).first().click()
  await fichaModo(page, 'Ler')
  const heroi = page.getByRole('region', { name: 'Retrato de Dorothy' })
  await expect(heroi.getByRole('heading', { name: 'Dorothy' })).toBeVisible()
  await expect(heroi).toContainText('Protagonista')
  await expect(heroi.getByRole('button', { name: /Carne e osso/ })).toBeVisible()

  // As abas: Ligações tem as ligações; Visão não.
  const abas = page.getByRole('navigation', { name: 'Partes da ficha' })
  await abas.getByRole('button', { name: 'Ligações' }).click()
  await expect(page.locator('[data-block="ligacoes"]')).toBeVisible()
  await expect(page.locator('[data-block="texto"]')).toHaveCount(0)
  await abas.getByRole('button', { name: 'Diário' }).click()
  await expect(page.locator('[data-block="aparece"]')).toBeVisible()
  await abas.getByRole('button', { name: 'Visão' }).click()
  await expect(page.locator('[data-block="texto"]')).toBeVisible()

  // Tocar no retrato abre o retrato e os campos para editar.
  await heroi.getByRole('button', { name: 'Trocar o retrato e os campos' }).click()
  await expect(page.getByRole('group', { name: /^Editando: Quadro/ })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
