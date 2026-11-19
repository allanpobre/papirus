import { expect, test } from './fixtures.ts'

/*
 * Nova cara: um personagem novo abre no criador (papel, Quem é e retrato em cartas), não no formulário.
 * "Pronto" abre a tela do personagem. No celular.
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

test('criador de personagem: papel e Quem é em cartas, e "Pronto" abre a tela dele', async ({ page }) => {
  await page.addInitScript(() => {
    const prefs = JSON.parse(localStorage.getItem('papirus:prefs') ?? '{}')
    localStorage.setItem('papirus:prefs', JSON.stringify({ ...prefs, novaCara: true }))
  })
  await page.goto('/app/?exemplo')
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Mundo', exact: true }).click()
  await page.locator('[data-tour="partes"]').getByRole('button', { name: 'Fichas' }).click()
  await page.getByRole('button', { name: 'Nova ficha' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nova ficha' })
  await dialog.getByRole('textbox', { name: 'Nome' }).fill('Ojo')
  await dialog.getByRole('button', { name: 'Criar e abrir' }).click()

  const criador = page.getByRole('article', { name: 'Criar Ojo' })
  await criador.getByRole('radiogroup', { name: 'Papel na história' }).getByRole('radio', { name: /Secundário/ }).click()
  // O exemplo de Oz tem "Povo" e "Feito de" no Quem é: escolhe-se numa carta.
  const feito = criador.getByRole('radiogroup', { name: 'Feito de' })
  await feito.getByRole('radio').first().click()
  await expect(feito.getByRole('radio').first()).toHaveAttribute('aria-checked', 'true')
  await criador.getByRole('button', { name: 'Pronto' }).click()

  const heroi = page.getByRole('region', { name: 'Retrato de Ojo' })
  await expect(heroi).toContainText('Secundário')
  await expect(heroi.locator('.hero-seal')).toHaveCount(1)
})
