import { devices } from '@playwright/test'
import { expect, test } from './fixtures.ts'

const { defaultBrowserType: _ignored, ...pixel } = devices['Pixel 7']
test.use(pixel)

test('escrever no celular: barra acima do teclado, sem menu flutuante por cima do texto', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Escrever' }).tap()
  const text = page.getByRole('textbox', { name: 'Texto da cena' })
  await text.tap()

  const dock = page.getByRole('toolbar', { name: 'Formatação' })
  await expect(dock).toBeVisible()
  // O menu de baixo sai enquanto escreve.
  await expect(page.getByRole('navigation', { name: 'Áreas' })).toBeHidden()
  await expect(page.getByText('Mundo de exemplo', { exact: true })).toBeHidden()
  const viewport = page.viewportSize()!
  // Depois da animação de entrada, encostada embaixo da tela.
  await expect.poll(async () => Math.round(((await dock.boundingBox())?.y ?? 0) + ((await dock.boundingBox())?.height ?? 0))).toBe(viewport.height)

  // Travessão para falas.
  await page.keyboard.press('Control+End')
  await page.keyboard.press('Enter')
  await dock.getByRole('button', { name: 'Travessão (fala)' }).tap()
  await page.keyboard.type('Quem vem lá?')
  await expect(text).toContainText('— Quem vem lá?')

  // Com seleção: as ações da seleção ficam na barra de baixo, não flutuando sobre o texto.
  await page.keyboard.press('Shift+Home')
  const actions = page.getByRole('toolbar', { name: 'Ações da seleção' })
  await expect(actions.getByRole('button', { name: 'Fato' })).toBeVisible()
  await expect(page.locator('.bubble')).toHaveCount(0)
  const sel = await actions.boundingBox()
  expect(sel!.y).toBeGreaterThan(viewport.height / 2)

  // Fechar o teclado: a barra sai e o menu volta.
  await page.keyboard.press('End')
  await page.getByRole('button', { name: 'Fechar o teclado' }).tap()
  await expect(dock).toBeHidden()
  await expect(page.getByRole('navigation', { name: 'Áreas' })).toBeVisible()
  await expect(page.getByText('Mundo de exemplo', { exact: true })).toBeVisible()
})

test('Revisão no celular: a margem numa gaveta, sem cobrir o texto nem as abas', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Escrever' }).tap()
  const modes = page.getByRole('navigation', { name: 'Momento da escrita' })
  await modes.getByRole('button', { name: 'Revisão' }).tap()
  const handle = page.getByRole('button', { name: /^Margem/ })
  await expect(handle).toContainText('1 pergunta')
  await expect(handle).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('complementary', { name: 'Margem viva' })).toBeVisible()
  // O texto continua à vista em cima da gaveta.
  const text = await page.getByRole('textbox', { name: 'Texto da cena' }).boundingBox()
  const sheet = await page.locator('.margin-sheet').boundingBox()
  expect(text!.y).toBeLessThan(sheet!.y)
  // Fecha pela alça e abre de novo.
  await handle.tap()
  await expect(page.getByRole('complementary', { name: 'Margem viva' })).toHaveCount(0)
  await handle.tap()
  // As abas de cima continuam funcionando com a gaveta aberta.
  await modes.getByRole('button', { name: 'Mapa' }).tap()
  await expect(page.getByRole('heading', { name: 'Mapa da história' })).toBeAttached()
})
