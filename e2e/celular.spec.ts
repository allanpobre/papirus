import { devices } from '@playwright/test'
import { expect, test } from './fixtures.ts'

const { defaultBrowserType: _ignored, ...pixel } = devices['Pixel 7']
test.use(pixel)

test('escrever no celular: barra acima do teclado, sem menu flutuante por cima do texto', async ({ page }) => {
  await page.goto('/app/?exemplo')
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
