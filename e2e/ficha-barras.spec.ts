import { expect, test } from './fixtures.ts'
import { fichaModo } from './areas.ts'

test('ficha sem versões: só o botão pequeno, sem o parágrafo, e o nome fica mais alto na tela', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/app/?exemplo')
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Mundo/ }).first().click()
  await page.getByText('Totó', { exact: true }).first().click()
  await fichaModo(page, 'Ler')
  const versoes = page.getByRole('region', { name: 'Versões' })
  await expect(versoes.getByRole('button', { name: 'Nova versão' })).toHaveAttribute('title', /Como Totó muda/)
  await expect(versoes).not.toContainText('outro nome, outro posto')
  // A barra de versões é baixa: uma linha só.
  expect((await versoes.boundingBox())!.height).toBeLessThan(40)
})

test('retrato sem imagem: o desenho do tipo (pessoa, lugar…) com a inicial pequena, e não a letra gigante', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/app/?exemplo')
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Mundo/ }).first().click()
  // Na lista, cada cartão sem imagem tem o desenho do tipo dele.
  await expect(page.locator('.kind-portrait').first()).toBeVisible()
  await page.getByText('Dorothy', { exact: true }).first().click()
  await fichaModo(page, 'Ler')
  const retrato = page.locator('.hero .kind-portrait')
  await expect(retrato).toBeVisible()
  // O desenho de pessoa (a cabeça e os ombros) e a inicial num selo pequeno.
  await expect(retrato.locator('path.kp-art')).toHaveCount(1)
  await expect(retrato.locator('.kp-letter')).toHaveText('D')
  const tamanho = await retrato.locator('.kp-letter').evaluate((e) => parseFloat(getComputedStyle(e).fontSize))
  expect(tamanho).toBeLessThanOrEqual(10)
})
