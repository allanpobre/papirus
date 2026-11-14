import { expect, test, type Page } from './fixtures.ts'

/*
 * A tabela de fichas no celular (390 px): rola de lado com o nome preso à esquerda, edita a célula com um toque,
 * renomeia pelo lápis (não há duplo clique no dedo) e abre com o exemplo de Oz (74 fichas) sem pesar.
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

async function abrirTabela(page: Page) {
  await page.goto('/app/?exemplo')
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Mundo/ }).first().click()
  await page.getByRole('radiogroup', { name: 'Vista do Mundo' }).getByRole('radio', { name: 'Tabela' }).click()
  await expect(page.locator('.entity-table')).toBeVisible()
}

test('a tabela rola de lado e o nome fica preso à esquerda; nada passa da borda da tela', async ({ page }) => {
  await abrirTabela(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  const envolta = page.locator('.entity-table-wrap .table-wrap')
  const medidas = await envolta.evaluate((el) => ({ larga: el.scrollWidth, janela: el.clientWidth }))
  expect(medidas.larga, 'a tabela é mais larga que a tela').toBeGreaterThan(medidas.janela)
  const nome = page.locator('.entity-table tbody th[scope="row"]').first()
  const antes = (await nome.boundingBox())!.x
  await envolta.evaluate((el) => (el.scrollLeft = 300))
  await page.waitForTimeout(200)
  expect(Math.abs((await nome.boundingBox())!.x - antes), 'o nome não anda com a rolagem').toBeLessThan(2)
  // E uma coluna de dados andou para a esquerda.
  expect((await page.locator('.entity-table thead th').nth(2).boundingBox())!.x).toBeLessThan(120)
})

test('um toque na célula edita ali mesmo, e o lápis renomeia a ficha', async ({ page }) => {
  await abrirTabela(page)
  // A célula de uma coluna de campo (o 4º cabeçalho em diante é campo, quando há): edita com um toque.
  const celula = page.locator('.table-cell').first()
  await celula.scrollIntoViewIfNeeded()
  const rotulo = (await celula.getAttribute('aria-label'))!
  await celula.click()
  const campo = page.getByRole('textbox', { name: new RegExp(`^${rotulo.split(':')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) })
  await expect(campo).toBeVisible()
  await campo.fill('Valor de teste')
  await campo.press('Enter')
  await expect(page.locator('.table-cell', { hasText: 'Valor de teste' }).first()).toBeVisible()

  // O lápis ao lado do nome renomeia.
  const linha = page.locator('.entity-table tbody tr').filter({ has: page.getByRole('button', { name: /^Renomear A moça Munchkin/ }) })
  await linha.getByRole('button', { name: /^Renomear/ }).click()
  const nome = page.getByRole('textbox', { name: /^Nome de A moça Munchkin/ })
  await nome.fill('A moça Munchkin renomeada')
  await nome.press('Enter')
  await expect(page.locator('.table-name', { hasText: 'A moça Munchkin renomeada' })).toBeVisible()
  // O nome em si abre a ficha, numa janela por cima da tabela (toque simples).
  await page.locator('.table-name', { hasText: 'A moça Munchkin renomeada' }).click()
  await expect(page.locator('.peek')).toBeVisible()
  await expect(page.getByRole('dialog').filter({ hasText: 'A moça Munchkin renomeada' })).toBeVisible()
})

test('com o exemplo de Oz (74 fichas) a tabela abre e ordena depressa, mesmo com a CPU 4x mais lenta', async ({ page }) => {
  await page.goto('/app/?exemplo')
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Mundo/ }).first().click()
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  const t0 = Date.now()
  await page.getByRole('radiogroup', { name: 'Vista do Mundo' }).getByRole('radio', { name: 'Tabela' }).click()
  await expect(page.locator('.entity-table tbody tr')).toHaveCount(74)
  const abrir = Date.now() - t0
  const t1 = Date.now()
  await page.locator('.table-sort', { hasText: 'Tipo' }).click()
  await expect(page.locator('.entity-table thead th[aria-sort="ascending"]')).toContainText('Tipo')
  const ordenar = Date.now() - t1
  console.log(`tabela de 74 fichas, CPU 4x: abrir ${abrir} ms, ordenar ${ordenar} ms`)
  expect(abrir, 'abrir a tabela').toBeLessThan(3000)
  expect(ordenar, 'ordenar por uma coluna').toBeLessThan(2000)
})
