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
  // Com a Nova cara, o Mundo abre no mapa (quando há um): as fichas ficam em "Fichas".
  await page.locator('[data-tour="partes"]').getByRole('button', { name: 'Fichas' }).click()
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

test('topo da ficha: "Editar" escrito e o "⋯" com itens explicados', async ({ page }) => {
  await page.addInitScript(() => {
    const prefs = JSON.parse(localStorage.getItem('papirus:prefs') ?? '{}')
    localStorage.setItem('papirus:prefs', JSON.stringify({ ...prefs, novaCara: true }))
  })
  await page.goto('/app/?exemplo')
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Mundo', exact: true }).click()
  await page.locator('[data-tour="partes"]').getByRole('button', { name: 'Fichas' }).click()
  await page.getByRole('region', { name: 'Lista de fichas' }).getByRole('button', { name: /^Dorothy/ }).first().click()
  await fichaModo(page, 'Ler')
  // "Editar" abre o básico.
  await page.getByRole('button', { name: 'Editar', exact: true }).click()
  await expect(page.getByRole('group', { name: 'Editando: o básico' })).toBeVisible()
  await page.getByRole('button', { name: 'Editar', exact: true }).click()
  // O "⋯": arrumar a página, e se sumir, editar tudo, apagar, cada um com a sua frase.
  await page.getByRole('button', { name: 'Mais da ficha' }).click()
  const menu = page.getByRole('group', { name: 'Mais da ficha' })
  await expect(menu.getByRole('button', { name: /^Arrumar a página/ })).toContainText('Subir, descer e tirar blocos')
  await expect(menu.getByRole('button', { name: /^E se sumir\?/ })).toBeVisible()
  await expect(menu.getByRole('button', { name: /^Apagar ficha/ })).toBeVisible()
  await menu.getByRole('button', { name: /^Arrumar a página/ }).click()
  await expect(page.getByRole('button', { name: /^Subir:/ }).first()).toBeVisible()
})
