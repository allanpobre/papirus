import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from './fixtures.ts'
import { openPart } from './areas.ts'

// Auditoria 18: as telas das oficinas (Rolar no mundo, Faixas, mapa com rota, ficha de religião) no celular.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

async function limpo(page: Page, onde: string) {
  await page.waitForTimeout(1200) // espera as animações de entrada (no meio delas o contraste mede errado)
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(violations.map((v) => `${onde}: ${v.id} ×${v.nodes.length}`), onde).toEqual([])
}

test('as telas das oficinas, no celular, sem violações e com Esc e foco no lugar', async ({ page }) => {
  test.setTimeout(100_000)
  await page.goto('/app/?exemplo=ostria')
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Mundo/ }).click()
  const abrir = page.getByRole('button', { name: 'Rolar no mundo' })
  await abrir.click()
  await limpo(page, 'Rolar no mundo')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(abrir, 'o foco volta ao botão que abriu a janela').toBeFocused()
  await openPart(page, 'Linha do tempo')
  await page.getByText('Faixas', { exact: true }).first().click()
  await limpo(page, 'Faixas')
  await openPart(page, 'Mapas')
  await page.getByRole('button', { name: 'Rota', exact: true }).click()
  await limpo(page, 'Mapa ligando uma rota')
  await page.getByRole('button', { name: 'Cancelar' }).click()
  await page.locator('[data-tour="partes"]').getByRole('button', { name: 'Fichas' }).click()
  await page.getByText('Fé da Maré', { exact: true }).first().click()
  await limpo(page, 'Ficha de religião')
})
