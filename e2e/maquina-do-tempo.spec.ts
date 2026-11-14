import { openPart } from './areas.ts'
import { expect, test } from './fixtures.ts'

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

/** Troca de parte do Mundo pela faixa do alto (o "Mais" do menu também existe dentro dos Mapas). */
const parte = (page: import('@playwright/test').Page, nome: string) => page.locator('[data-tour="partes"]').getByRole('button', { name: nome }).click()

test('Máquina do tempo no celular: régua grande para o dedo, botões − e +, e o ano vale nas Fichas e nos Mapas com saída à vista', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await openPart(page, 'Linha do tempo')
  const regua = page.getByRole('slider', { name: 'Ano' })
  await expect(regua).toBeVisible()
  // A régua é grande: dá para acertar com o dedo (faixa de 44 px de altura, com a largura que sobra).
  const rb = (await regua.boundingBox())!
  expect(rb.height).toBeGreaterThanOrEqual(40)
  expect(rb.width).toBeGreaterThan(200)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)

  // Arrasta a bolinha com o dedo (toque pelo CDP) do começo até mais ou menos o meio.
  const cdp = await page.context().newCDPSession(page)
  const toque = (type: 'touchStart' | 'touchMove' | 'touchEnd', pts: [number, number][]) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) })
  const y = rb.y + rb.height / 2
  await toque('touchStart', [[rb.x + 20, y]])
  for (let i = 1; i <= 6; i++) await toque('touchMove', [[rb.x + 20 + ((rb.width / 2) * i) / 6, y]])
  await toque('touchEnd', [])
  const ano = page.getByRole('spinbutton', { name: 'Ir para o ano' })
  const depoisDoArrasto = Number(await ano.inputValue())
  const min = Number(await regua.getAttribute('min'))
  const max = Number(await regua.getAttribute('max'))
  expect(depoisDoArrasto).toBeGreaterThan(min + (max - min) * 0.25)
  expect(depoisDoArrasto).toBeLessThan(max - (max - min) * 0.25)
  await expect(page.locator('.time-machine-out')).toBeVisible()

  // − e +: um ano de cada vez (botões do tamanho de um toque).
  const mais = page.getByRole('button', { name: 'Um ano depois' })
  expect((await mais.boundingBox())!.width).toBeGreaterThanOrEqual(40)
  await mais.click()
  await expect(ano).toHaveValue(String(depoisDoArrasto + 1))
  await page.getByRole('button', { name: 'Um ano antes' }).click()
  await expect(ano).toHaveValue(String(depoisDoArrasto))

  // Um ano em que Kael (318) ainda não tinha nascido, mas o Reino (12–341) existia.
  await ano.fill('300')
  await expect(page.locator('.time-machine-year-label')).toContainText('300')

  // Fichas: só o que existia, com o aviso e a saída.
  await parte(page, 'Fichas')
  const aviso = page.getByRole('status').filter({ hasText: 'No ano' })
  await expect(aviso).toBeVisible()
  await expect(aviso).toContainText('escondidas')
  const lista = page.locator('.entity-list')
  await expect(lista.getByText('Kael', { exact: true })).toHaveCount(0)
  await expect(lista.getByText('Reino de Ostria').first()).toBeVisible()
  // Dá para ver todas sem sair do ano.
  await aviso.getByRole('button', { name: /^Mostrar as/ }).click()
  await expect(lista.getByText('Kael', { exact: true }).first()).toBeVisible()
  await aviso.getByRole('button', { name: 'Esconder as que não existiam' }).click()
  await expect(lista.getByText('Kael', { exact: true })).toHaveCount(0)

  // Mapas: o mesmo ano, e a saída.
  await parte(page, 'Mapas')
  await expect(page.getByRole('status').filter({ hasText: 'No ano' })).toBeVisible()

  // Sair do ano (no aviso das Fichas) vale em todas as telas.
  await parte(page, 'Fichas')
  await page.getByRole('status').filter({ hasText: 'No ano' }).getByRole('button', { name: 'Sair do ano' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'No ano' })).toHaveCount(0)
  await expect(page.locator('.entity-list').getByText('Kael', { exact: true }).first()).toBeVisible()
  await parte(page, 'Mapas')
  await expect(page.getByRole('status').filter({ hasText: 'No ano' })).toHaveCount(0)
  await parte(page, 'Linha do tempo')
  await expect(page.getByRole('button', { name: 'Sair do ano' })).toHaveCount(0)
})

test('na Máquina do tempo, "Sair do ano" é um botão de verdade e leva ao mundo todo', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await openPart(page, 'Linha do tempo')
  await page.getByRole('spinbutton', { name: 'Ir para o ano' }).fill('330')
  const sair = page.getByRole('button', { name: 'Sair do ano' })
  await expect(sair).toBeVisible()
  expect((await sair.boundingBox())!.height).toBeGreaterThanOrEqual(36)
  await sair.click()
  await expect(page.getByRole('spinbutton', { name: 'Ir para o ano' })).toHaveValue('')
  await expect(page.locator('.time-machine-out')).toHaveCount(0)
})
