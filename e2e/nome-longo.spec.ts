import { expect, test } from './fixtures.ts'

// Auditoria 05: em "Editar", o nome longo era um campo de uma linha e ficava cortado no meio da palavra.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

test('o nome longo da ficha aparece inteiro na edição, em várias linhas', async ({ page }) => {
  await page.goto('/app/')
  await page.getByRole('textbox', { name: 'Nome do novo universo' }).fill('Nomes')
  await page.getByRole('button', { name: 'Criar universo' }).click()
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Mundo/ }).click()
  await page.getByRole('button', { name: 'Nova ficha' }).click()
  const nova = page.getByRole('dialog', { name: 'Nova ficha' })
  const longo = 'Sua Majestade Imperial Eleonora-Maria Alexandrina de Vaelor-Montferrat, Guardiã dos Sete Portos'
  await nova.getByRole('textbox', { name: 'Nome' }).fill(longo)
  await nova.getByRole('button', { name: 'Criar e abrir' }).click()
  const campo = page.locator('#entity-name')
  await expect(campo).toHaveValue(longo)
  const { altura, rolagem, linha } = await campo.evaluate((el) => ({ altura: el.clientHeight, rolagem: el.scrollHeight, linha: parseFloat(getComputedStyle(el).lineHeight) }))
  expect(rolagem, 'nada fica escondido dentro do campo').toBeLessThanOrEqual(altura + 1)
  expect(altura, 'o nome ocupa mais de uma linha').toBeGreaterThan(linha * 1.5)
  // Enter não quebra a linha do nome.
  await campo.click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await expect(campo).toHaveValue(longo)
})
