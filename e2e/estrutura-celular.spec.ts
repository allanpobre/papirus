import { expect, test, type Page } from './fixtures.ts'

/*
 * A Estrutura no celular (390 px): arrastar um cartão pela alça com o dedo (a tela rola sozinha perto da borda),
 * a tabela de Presença (larga, com a coluna das cenas presa à esquerda) e o Ritmo (sem rolagem de lado).
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

async function abrirEstrutura(page: Page) {
  await page.goto('/app/?exemplo')
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Escrever/ }).click()
  await page.getByRole('navigation', { name: 'Momento da escrita' }).getByRole('button', { name: 'Estrutura' }).click()
  await expect(page.locator('.cork-card').first()).toBeVisible()
}

const semRolagemDeLado = async (page: Page, onde: string) => expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), onde).toBeLessThanOrEqual(1)

test('arrastar um cartão pela alça com o dedo: a tela rola sozinha perto da borda e a cena muda de lugar', async ({ page }) => {
  await abrirEstrutura(page)
  const primeiro = page.locator('.cork-card').first()
  // Os cartões ficam abaixo do mapa da história: rola até o primeiro (como a pessoa faria).
  await primeiro.scrollIntoViewIfNeeded()
  const titulo = (await primeiro.locator('.cork-title').innerText()).trim()
  const alça = (await primeiro.locator('.cork-handle').boundingBox())!
  // A alça tem área de toque de verdade.
  expect(alça.width).toBeGreaterThanOrEqual(36)
  const barra = (await page.locator('.rail-phone').boundingBox())!

  const cdp = await page.context().newCDPSession(page)
  const toque = (type: 'touchStart' | 'touchMove' | 'touchEnd', pts: [number, number][]) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) })
  const x = alça.x + alça.width / 2
  const y0 = alça.y + alça.height / 2
  await toque('touchStart', [[x, y0]])
  // Desce o dedo até o pé da tela (acima da barra de baixo) e fica lá: a tela rola sozinha.
  const y1 = barra.y - 25
  for (let i = 1; i <= 8; i++) await toque('touchMove', [[x, y0 + ((y1 - y0) * i) / 8]])
  await page.waitForTimeout(1800)
  const rolou = await page.evaluate(() => {
    const el = document.querySelector('.corkboard')!
    for (let p: HTMLElement | null = el.parentElement; p; p = p.parentElement) if (p.scrollTop > 0) return p.scrollTop
    return document.scrollingElement!.scrollTop
  })
  expect(rolou, 'a tela rolou sozinha enquanto o dedo segurava o cartão').toBeGreaterThan(150)
  // Solta o dedo no meio de uma cena lá embaixo: o cartão muda de lugar.
  await toque('touchMove', [[x + 2, y1 - 40]])
  await toque('touchEnd', [])
  await page.waitForTimeout(500)
  const cartao = page.locator('.cork-card', { has: page.locator('.cork-title', { hasText: new RegExp(`^${titulo}$`) }) }).first()
  const numero = Number((await cartao.locator('.cork-num').innerText()).trim())
  expect(numero, `“${titulo}” deixou de ser a primeira cena`).toBeGreaterThan(1)
  await expect(page.locator('.cork-card').first().locator('.cork-title')).not.toHaveText(titulo)
  // E o desfazer (do app) está à mão? O aviso de trocar não existe aqui: a ordem se desfaz arrastando de volta.
  await semRolagemDeLado(page, 'Estrutura, depois de arrastar')
})

test('Presença: a tabela larga rola de lado e a coluna das cenas fica presa à esquerda', async ({ page }) => {
  await abrirEstrutura(page)
  await page.getByRole('tab', { name: 'Presença' }).click()
  const envolta = page.locator('.table-wrap').first()
  await expect(envolta).toBeVisible()
  const medidas = await envolta.evaluate((el) => ({ larga: el.scrollWidth, janela: el.clientWidth }))
  expect(medidas.larga, 'a tabela é mais larga que a tela').toBeGreaterThan(medidas.janela)
  const cabecalho = page.locator('.matrix thead th').first()
  const antes = (await cabecalho.boundingBox())!.x
  await envolta.evaluate((el) => (el.scrollLeft = 400))
  await page.waitForTimeout(200)
  const depois = (await cabecalho.boundingBox())!.x
  expect(Math.abs(depois - antes), 'a coluna das cenas não anda com a rolagem').toBeLessThan(2)
  // E as outras colunas andaram: o primeiro personagem saiu do lugar.
  const primeiroPersonagem = page.locator('.matrix thead th').nth(1)
  expect((await primeiroPersonagem.boundingBox())!.x).toBeLessThan(0 + 200)
  await semRolagemDeLado(page, 'Presença')
})

test('Ritmo: as cenas com o tamanho de cada uma cabem na tela', async ({ page }) => {
  await abrirEstrutura(page)
  await page.getByRole('tab', { name: 'Ritmo' }).click()
  await expect(page.getByRole('heading', { name: 'Tamanho das cenas' })).toBeVisible()
  await semRolagemDeLado(page, 'Ritmo')
})
