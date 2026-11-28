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
