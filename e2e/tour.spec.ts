import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('tour na primeira vez: destaca as partes, pode ser pulado e refeito', async ({ page }) => {
  await page.goto('/app/')
  await page.getByRole('button', { name: 'Abrir um universo de exemplo' }).click()

  // Começa sozinho.
  const tour = page.getByRole('dialog', { name: 'Bem-vindo ao Papirus' })
  await expect(tour).toBeVisible()
  await expect(tour).toContainText('1 de 15')
  const { violations } = await new AxeBuilder({ page }).include('.tour-card').analyze()
  expect(violations.map((v) => v.id)).toEqual([])

  await tour.getByRole('button', { name: 'Mostrar' }).click()
  await expect(page.getByRole('dialog', { name: 'O menu' })).toBeVisible()
  await expect(page.locator('.tour-spot')).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('dialog', { name: 'Seus universos' })).toBeVisible()

  // Vai mudando de área quando precisa.
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Próximo' }).click()
  await expect(page.getByRole('dialog', { name: 'Escrever' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Texto da cena' })).toBeVisible()
  await page.getByRole('button', { name: 'Voltar' }).click()
  await expect(page.getByRole('dialog', { name: 'Início' })).toBeVisible()

  // Pular (Esc) fecha e não volta sozinho.
  await page.keyboard.press('Escape')
  await expect(page.locator('.tour')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Exemplo — As Cinzas de Ostria' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Exemplo — As Cinzas de Ostria' })).toBeVisible()
  await page.waitForTimeout(1200)
  await expect(page.locator('.tour')).toHaveCount(0)

  // Refazer pelo Início, até o fim.
  await page.getByRole('button', { name: 'Fazer o tour' }).click()
  await expect(page.getByRole('dialog', { name: 'Bem-vindo ao Papirus' })).toBeVisible()
  for (let i = 0; i < 20 && !(await page.getByRole('button', { name: 'Começar' }).count()); i++) await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('dialog', { name: 'Pronto!' })).toBeVisible()
  await page.getByRole('button', { name: 'Começar' }).click()
  await expect(page.locator('.tour')).toHaveCount(0)
})

test('dá para sair do mundo de exemplo', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('papirus:prefs', JSON.stringify({ tourDone: true })))
  await page.goto('/app/')
  await page.getByRole('button', { name: 'Abrir um universo de exemplo' }).click()
  await expect(page.getByText('Você está no mundo de exemplo.')).toBeVisible()
  await page.getByRole('button', { name: 'Sair do exemplo' }).click()
  await expect(page.getByRole('heading', { name: 'Seus universos' })).toBeVisible()
  await page.getByRole('list', { name: 'Universos' }).getByRole('button', { name: /^Exemplo/ }).click()
  await page.getByRole('button', { name: 'Seus universos' }).click()
  await expect(page.getByRole('heading', { name: 'Seus universos' })).toBeVisible()
})
