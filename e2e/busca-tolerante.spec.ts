import { expect, test } from './fixtures.ts'

// Busca com erro de digitação ("doroti") achava nada e só oferecia criar uma ficha nova (auditoria 23).
test('a busca sugere o nome certo, e não oferece criar ficha para uma ação nem para um nome que já existe', async ({ page }) => {
  await page.goto('/app/?exemplo')
  await expect(page.getByRole('navigation', { name: 'Áreas' })).toBeVisible()
  await page.getByRole('button', { name: 'Buscar em tudo' }).first().click()
  const busca = page.getByRole('dialog', { name: 'Buscar' })
  const campo = busca.getByRole('combobox').or(busca.getByRole('textbox')).first()

  await campo.fill('doroti')
  const opcoes = busca.getByRole('option')
  await expect(opcoes.first()).toContainText('Você quis dizer Dorothy?')
  await expect(opcoes.last()).toContainText('Criar ficha “doroti”')
  await page.keyboard.press('Enter')
  await expect(busca).toHaveCount(0)
  await expect(page.locator('#entity-name')).toHaveValue('Dorothy')

  await page.keyboard.press('Control+k')
  await campo.fill('nova cena')
  await expect(busca.getByRole('option').first()).toContainText('Nova cena')
  await expect(busca.getByRole('option', { name: /Criar ficha/ })).toHaveCount(0)

  await campo.fill('Dorothy')
  await expect(busca.getByRole('option', { name: /Criar ficha/ })).toHaveCount(0)
})
