import { expect, test } from './fixtures.ts'

test('a apresentação leva ao app e ao exemplo', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Seu mundo, escrito e jogado no mesmo caderno.')
  await expect(page.getByRole('heading', { name: 'O mesmo mundo, agora na mesa.' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Áreas' })).toHaveCount(0)

  await page.getByRole('link', { name: 'Ver um mundo de exemplo' }).click()
  await expect(page).toHaveURL(/\/app\/$/)
  // O exemplo abre direto, no Início do universo.
  await expect(page.getByRole('heading', { name: 'Exemplo — O Alienista' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continuar escrevendo' })).toBeVisible()
  await page.getByRole('button', { name: 'Continuar escrevendo' }).click()
  await expect(page.getByRole('textbox', { name: 'Texto da cena' })).toContainText('Itaguaí')

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

test('a apresentação mostra os três setores, a mesa nova e o gerador da Oficina', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Cada parte com a sua cara. O mesmo caderno por trás.' })).toBeAttached()
  for (const name of ['Escrita', 'Mesa de RPG', 'Oficina']) await expect(page.locator('.lp-sector-name', { hasText: name })).toBeAttached()
  await expect(page.getByRole('list', { name: 'Temas da mesa' }).getByRole('listitem')).toHaveCount(6)

  const ideia = page.getByRole('figure', { name: 'Gerador de ideias da Oficina' })
  await ideia.scrollIntoViewIfNeeded()
  await ideia.getByRole('radio', { name: 'Mesa' }).click()
  await expect(ideia.getByText('Quem pede')).toBeVisible()
  await ideia.getByRole('button', { name: 'Sortear outra' }).click()
  await expect(ideia.getByText('A complicação')).toBeVisible()
  // As barras do celular seguem a cor da página.
  await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute('content', /^#[0-9a-f]{6}$/)
})
