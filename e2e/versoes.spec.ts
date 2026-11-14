import { expect, test, type Page } from './fixtures.ts'

/*
 * Comparar versões da cena: uma versão com o texto atual (padrão) ou com outra versão; juntos ou lado a lado.
 * No celular, o "antes" e o "depois" ficam um embaixo do outro.
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

async function abrirVersoes(page: Page) {
  await page.getByRole('button', { name: 'Mais ações da cena' }).click()
  await page.getByRole('button', { name: 'Versões da cena' }).click()
  await expect(page.getByRole('dialog', { name: /^Versões de/ })).toBeVisible()
}

async function guardar(page: Page, nome: string) {
  await abrirVersoes(page)
  const janela = page.getByRole('dialog', { name: /^Versões de/ })
  await janela.getByRole('textbox', { name: 'Nome da versão' }).fill(nome)
  await janela.getByRole('button', { name: 'Guardar texto atual' }).click()
  await janela.getByRole('button', { name: 'Fechar' }).click()
}

test('comparar duas versões da cena, juntas ou lado a lado (um embaixo do outro no celular)', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Escrever/ }).click()
  await page.evaluate(() => localStorage.setItem('papirus:escrita-modo', 'pagina'))
  await page.getByRole('navigation', { name: 'Momento da escrita' }).getByRole('button', { name: 'Página' }).click()
  const editor = page.getByRole('textbox', { name: 'Texto da cena' })
  await editor.click()
  await page.keyboard.press('Control+End')
  await page.keyboard.type(' Primeira frase nova.')
  await page.waitForTimeout(1500)
  await guardar(page, 'v1')
  await editor.click()
  await page.keyboard.press('Control+End')
  await page.keyboard.type(' Segunda frase nova.')
  await page.waitForTimeout(1500)
  await guardar(page, 'v2')

  await abrirVersoes(page)
  const janela = page.getByRole('dialog', { name: /^Versões de/ })
  // A versão mais velha, comparada com o texto atual (o padrão) e depois com a v2.
  await janela.getByRole('button', { name: /^v1/ }).click()
  await expect(janela.getByText(/De “v1” para o texto atual/)).toBeVisible()
  const comparar = janela.getByRole('combobox', { name: 'Comparar com' })
  await comparar.selectOption((await comparar.locator('option', { hasText: /^v2/ }).getAttribute('value'))!)
  await expect(janela.getByText(/De “v1” para “v2”/)).toBeVisible()
  // v2 tem a "Segunda frase nova." a mais que v1.
  await expect(janela.locator('.diff ins')).toContainText('Segunda')
  await expect(janela.locator('.diff del')).toHaveCount(0)

  // Lado a lado: "Antes" e "Depois", um embaixo do outro no celular.
  await janela.getByRole('radio', { name: 'Lado a lado' }).click()
  const antes = janela.getByRole('region', { name: 'Antes: v1' })
  const depois = janela.getByRole('region', { name: 'Depois: v2' })
  await expect(antes).toBeVisible()
  await expect(depois).toBeVisible()
  await expect(depois.locator('ins')).toContainText('Segunda')
  await expect(antes.locator('ins')).toHaveCount(0)
  const a = (await antes.boundingBox())!
  const d = (await depois.boundingBox())!
  expect(Math.abs(a.x - d.x), 'um embaixo do outro: mesma coluna').toBeLessThan(2)
  expect(d.y, 'o "depois" vem embaixo do "antes"').toBeGreaterThan(a.y + a.height - 2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
})
