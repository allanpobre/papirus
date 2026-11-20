import { expect, test } from './fixtures.ts'

// Auditoria 03: a janela "Revisão" ficava mais larga que o celular (o X de fechar saía da tela).
test.use({ viewport: { width: 390, height: 844 } })

test('a Revisão de nomes cabe na largura do celular', async ({ page }) => {
  await page.goto('/app/')
  await page.getByRole('textbox', { name: 'Nome do novo universo' }).fill('Janela')
  await page.getByRole('button', { name: 'Criar universo' }).click()
  await page.getByRole('button', { name: 'Começar a escrever' }).first().click()
  await page.getByRole('textbox', { name: 'Texto da cena' }).fill('Kael chegou a Ostria ao amanhecer. Mira esperava na torre.')
  await page.getByRole('button', { name: /nomes? novos?/ }).first().click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  const box = await dialog.boundingBox()
  expect(box!.x + box!.width).toBeLessThanOrEqual(390)
  const close = dialog.getByRole('button', { name: /Fechar/ }).first()
  const cb = await close.boundingBox()
  expect(cb!.x + cb!.width).toBeLessThanOrEqual(390)
})
