import { expect, test } from './fixtures.ts'

/*
 * O que mudou: depois de uma atualização (há novidade que esta pessoa ainda não viu), um aviso leva às
 * novidades; elas também ficam no Menu e no Guia. Na primeira vez no app, não incomoda. No celular.
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

test('depois de atualizar, o aviso leva ao "O que mudou"; e as novidades ficam no Menu', async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('ja')) localStorage.setItem('papirus:novidades-vistas', '2000-01-01')
    sessionStorage.setItem('ja', '1')
  })
  await page.goto('/app/?exemplo')
  await expect(page.locator('.toast', { hasText: 'O Papirus mudou' })).toHaveCount(1)
  await page.locator('.toast', { hasText: 'O Papirus mudou' }).getByRole('button', { name: 'Ver' }).click()
  const janela = page.getByRole('dialog', { name: 'O que mudou' })
  await expect(janela.getByRole('region').first()).toBeVisible()
  await janela.getByRole('button', { name: 'Fechar' }).click()
  // Visto: ao recarregar, o aviso não volta.
  await page.reload()
  await expect(page.getByText('O Papirus mudou. Veja o que há de novo.')).toHaveCount(0)
  // No Menu ("Mais"), as novidades continuam à mão.
  await page.getByRole('button', { name: 'Mais', exact: true }).click()
  await page.getByRole('button', { name: /^Novidades/ }).click()
  await expect(page.getByRole('dialog', { name: 'O que mudou' })).toBeVisible()
})
