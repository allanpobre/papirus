import { openPart } from './areas.ts'
import { expect, test } from './fixtures.ts'

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

test('Pistas e mistérios no celular: colunas que rolam de lado, botões para ir a cada uma e "Mover para…" com Desfazer', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await openPart(page, 'Pistas e mistérios')
  const quadro = page.locator('.board')
  await expect(page.locator('.seed-card').first()).toBeVisible()
  // As quatro colunas rolam de lado (não ficam empilhadas) e a próxima aparece um pedaço.
  const medidas = await quadro.evaluate((el) => ({ largura: el.clientWidth, total: el.scrollWidth, primeira: el.querySelector('.board-col')!.getBoundingClientRect().width }))
  expect(medidas.total).toBeGreaterThan(medidas.largura * 2.5)
  expect(medidas.primeira).toBeLessThan(medidas.largura)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)

  // Os botões do alto levam a cada coluna e dizem qual está à vista.
  const salto = page.getByRole('group', { name: 'Ir para a coluna' })
  await expect(salto.getByRole('button', { name: /^Aberta/ })).toHaveAttribute('aria-pressed', 'true')
  await salto.getByRole('button', { name: /^Resolvida/ }).click()
  await expect(salto.getByRole('button', { name: /^Resolvida/ })).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => quadro.evaluate((el) => el.scrollLeft)).toBeGreaterThan(300)
  // A coluna Resolvida ficou à vista (cabe na tela).
  const col = (await page.locator('.seed-col-resolvida').boundingBox())!
  expect(col.x).toBeGreaterThanOrEqual(0)
  expect(col.x + col.width).toBeLessThanOrEqual(390)

  // Deslizar com o dedo também troca de coluna: o botão acompanha.
  const cdp = await page.context().newCDPSession(page)
  const toque = (type: 'touchStart' | 'touchMove' | 'touchEnd', pts: [number, number][]) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) })
  const q = (await quadro.boundingBox())!
  const y = q.y + 40
  await toque('touchStart', [[340, y]])
  for (let i = 1; i <= 8; i++) await toque('touchMove', [[340 - i * 38, y]])
  await toque('touchEnd', [])
  await expect(salto.getByRole('button', { name: /^Abandonada/ })).toHaveAttribute('aria-pressed', 'true', { timeout: 5000 })
  await salto.getByRole('button', { name: /^Aberta/ }).click()
  await expect(salto.getByRole('button', { name: /^Aberta/ })).toHaveAttribute('aria-pressed', 'true')

  // "Mover para…": a trama aberta vai para Resolvida, com um toque, e dá para desfazer.
  const cartao = page.locator('.seed-col-aberta .seed-card', { hasText: 'Os trezentos e doze degraus' })
  const mover = cartao.getByRole('button', { name: /^Mover .* para…$/ })
  expect((await mover.boundingBox())!.height).toBeGreaterThanOrEqual(38)
  await mover.click()
  const opcoes = cartao.getByRole('group', { name: /^Mover .* para$/ })
  await expect(opcoes.getByRole('button')).toHaveText(['Parcial', 'Resolvida', 'Abandonada'])
  expect((await opcoes.getByRole('button', { name: 'Resolvida' }).boundingBox())!.height).toBeGreaterThanOrEqual(38)
  await opcoes.getByRole('button', { name: 'Resolvida' }).click()
  await expect(page.locator('.seed-col-resolvida .seed-card', { hasText: 'Os trezentos e doze degraus' })).toBeVisible()
  await expect(page.locator('.seed-col-aberta .seed-card', { hasText: 'Os trezentos e doze degraus' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Desfazer' }).click()
  await expect(page.locator('.seed-col-aberta .seed-card', { hasText: 'Os trezentos e doze degraus' })).toBeVisible()
})

test('a janela da trama no celular: tipo e estado lado a lado, nada passa da largura e as pistas se alcançam', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await openPart(page, 'Pistas e mistérios')
  await page.getByRole('group', { name: 'Ir para a coluna' }).getByRole('button', { name: /^Parcial/ }).click()
  await page.locator('.seed-card-open', { hasText: 'Quem é o Homem Pálido' }).click()
  const janela = page.getByRole('dialog', { name: 'Mistério' })
  await expect(janela).toBeVisible()
  const caixa = async (nome: string) => (await janela.getByLabel(nome, { exact: true }).boundingBox())!
  const tipo = await caixa('Tipo')
  const estado = await caixa('Estado')
  // Lado a lado: mesma altura, um depois do outro.
  expect(Math.abs(tipo.y - estado.y)).toBeLessThan(4)
  expect(estado.x).toBeGreaterThan(tipo.x + tipo.width - 4)
  const prep = await caixa('Preparada em')
  const paga = await caixa('Paga em')
  expect(Math.abs(prep.y - paga.y)).toBeLessThan(4)
  // Nada passa da largura da janela.
  const sobra = await janela.evaluate((d) => [...d.querySelectorAll('*')].filter((e) => e.getBoundingClientRect().right > d.getBoundingClientRect().right + 1).length)
  expect(sobra).toBe(0)
  // As pistas estão na janela e dá para chegar nelas rolando.
  const pistas = janela.getByRole('textbox', { name: 'Pista', exact: true })
  await expect(pistas).toHaveCount(5)
  await pistas.last().scrollIntoViewIfNeeded()
  const pb = (await pistas.last().boundingBox())!
  expect(pb.width).toBeGreaterThan(150)
  expect(pb.y + pb.height).toBeLessThanOrEqual(844)
  // Adicionar uma pista com o dedo.
  await janela.getByRole('textbox', { name: 'Nova pista' }).fill('A sombra na janela da torre')
  await janela.getByRole('button', { name: 'Pista', exact: true }).click()
  await expect(pistas).toHaveCount(6)
})
