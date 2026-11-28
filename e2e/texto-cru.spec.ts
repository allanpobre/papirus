import { expect, test } from './fixtures.ts'

test('a Mesa mostra a iniciativa em palavras, sem as chaves da fórmula', async ({ page }) => {
  await page.goto('/app/?exemplo')
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Mesa/ }).first().click()
  const sistema = page.getByText(/6 atributos, 2 recursos/)
  await expect(sistema).toContainText('Iniciativa: 1d20 + modificador de Destreza.')
  await expect(sistema).not.toContainText('{')
})
