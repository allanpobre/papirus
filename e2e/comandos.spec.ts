import { expect, test } from './fixtures.ts'

test('Ctrl+K: ações além da busca', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await expect(page.getByRole('button', { name: 'Ler como leitor' })).toBeVisible()
  await page.keyboard.press('Control+k')
  const input = page.getByRole('combobox', { name: 'Buscar no universo' })
  await input.fill('nova cena')
  await expect(page.getByRole('option', { name: /Nova cena/ }).first()).toBeVisible()
  await input.press('Enter')
  await expect(page.getByRole('textbox', { name: 'Texto da cena' })).toBeVisible()
  await expect(page.locator('.write-tree')).toContainText('Nova cena')

  // Sem acento e com palavras soltas: "lixeira".
  await page.keyboard.press('Control+k')
  await input.fill('lixeira')
  await input.press('Enter')
  await expect(page.getByRole('region', { name: 'Lixeira' })).toBeVisible()

  // Tema.
  await page.keyboard.press('Control+k')
  await input.fill('tema escuro')
  await input.press('Enter')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})
