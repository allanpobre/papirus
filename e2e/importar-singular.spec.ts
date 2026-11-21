import { expect, test } from './fixtures.ts'

// Auditoria 13: "Achei 1 ficha: 1 conceitos" (plural errado quando só há uma).
test('importar uma nota só: o resumo fala no singular', async ({ page }) => {
  await page.goto('/app/')
  await page.getByRole('textbox', { name: 'Nome do novo universo' }).fill('Importar')
  await page.getByRole('button', { name: 'Criar universo' }).click()
  await page.getByRole('button', { name: /Trazer de outro app/ }).first().click()
  await page.locator('input[type=file][accept*=".md"]').first().setInputFiles({ name: 'nota.md', mimeType: 'text/markdown', buffer: Buffer.from('# Mira\nIrmã de [[Kael]].\n') })
  const found = page.getByRole('status').filter({ hasText: 'Achei' })
  await expect(found).toContainText('1 conceito.')
  await expect(found).not.toContainText('conceitos')
})
