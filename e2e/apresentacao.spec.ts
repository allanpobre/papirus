import { expect, test } from './fixtures.ts'

test('a apresentação leva ao app e ao exemplo', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Seu mundo, escrito e jogado no mesmo caderno.')
  await expect(page.getByRole('heading', { name: 'O mesmo mundo, agora na mesa.' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Áreas' })).toHaveCount(0)

  await page.getByRole('link', { name: 'Ver um mundo de exemplo' }).click()
  await expect(page).toHaveURL(/\/app\/$/)
  // O exemplo abre direto, no Início do universo.
  await expect(page.getByRole('heading', { name: 'Exemplo — As Cinzas de Ostria' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continuar escrevendo' })).toBeVisible()
  await expect(page.getByText(/perguntas? de continuidade/)).toBeVisible()
  await page.getByRole('button', { name: 'Continuar escrevendo' }).click()
  await expect(page.getByRole('textbox', { name: 'Texto da cena' })).toContainText('Ostria')

  // Voltando à apresentação, quem já usa vê "Continuar".
  await page.goto('/')
  await expect(page.getByRole('link', { name: /Continuar no Papirus/ }).first()).toBeVisible()
})

test('links antigos de jogadores e retornos de login vão para o app', async ({ page }) => {
  await page.goto('/?mesa=6f1c2d3e-4b5a-4c6d-8e9f-0a1b2c3d4e5f')
  await expect(page).toHaveURL(/\/app\/\?mesa=6f1c2d3e/)
  await page.goto('/#error_description=teste&error=x')
  await expect(page).toHaveURL(/\/app\/#error_description=teste/)
})
