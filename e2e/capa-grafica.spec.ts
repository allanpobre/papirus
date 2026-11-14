import { expect, test } from './fixtures.ts'

/*
 * Capa para gráfica: a lombada e a capa inteira, e a conta explicada em linguagem simples (de onde vem cada medida).
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

test('a capa para gráfica mostra a lombada e a capa inteira, e explica de onde vem cada medida', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/app/?exemplo')
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Mais/ }).click()
  await page.getByRole('group', { name: 'Todas as áreas' }).getByRole('button', { name: 'Publicar', exact: true }).click()
  await page.getByRole('button', { name: /^Diagramar/ }).first().click()
  const designer = page.getByRole('dialog', { name: 'Diagramar o livro' })
  await expect(designer.getByRole('status').filter({ hasText: /^\d+ páginas$/ })).toBeVisible({ timeout: 90_000 })
  await designer.getByText('Capa para gráfica', { exact: true }).click()

  const medidas = designer.locator('.book-wrap-size')
  await expect(medidas).toContainText('Lombada')
  const lombada = Number((await medidas.locator('div').filter({ hasText: /^Lombada/ }).locator('dd').innerText()).replace(/[^\d,]/g, '').replace(',', '.'))
  expect(lombada).toBeGreaterThan(5)

  // A explicação: as páginas (sempre pares), a espessura do papel e a soma da largura e da altura.
  await designer.getByText('De onde vêm estas medidas?').click()
  const conta = designer.locator('.book-wrap-why')
  await expect(conta).toContainText(/Lombada: o livro tem \d+ páginas/)
  await expect(conta).toContainText(/Largura da capa inteira: sangria 3,18 mm \+ contracapa 140 mm \+ lombada/)
  await expect(conta).toContainText(/Altura: sangria 3,18 mm \+ 210 mm do livro \+ sangria 3,18 mm = 216,4 mm/)
  // O número da lombada na conta é o mesmo da caixa de cima.
  const dita = (await conta.locator('li').first().innerText()).match(/= ([\d,]+) mm\./)![1]
  expect(Number(dita.replace(',', '.'))).toBeCloseTo(lombada, 1)
  // Trocar o papel muda a lombada e a conta junto.
  await designer.getByLabel('Papel').selectOption('branco')
  await expect(conta).toContainText('papel branco')
  const branco = Number((await medidas.locator('div').filter({ hasText: /^Lombada/ }).locator('dd').innerText()).replace(/[^\d,]/g, '').replace(',', '.'))
  expect(branco).toBeLessThan(lombada)
})
