import { expect, test, type Page } from './fixtures.ts'

/*
 * Nova cara (teste): cada mundo escolhe o seu clima em Ajustes › Universo; com a chave ligada, o app inteiro
 * muda de cara. Desligada, fica como sempre. No celular.
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

async function ajustesUniverso(page: Page) {
  await page.getByRole('button', { name: 'Mais', exact: true }).click()
  await page.getByRole('group', { name: 'Todas as áreas' }).getByRole('button', { name: /Ajustes/ }).click()
  await page.getByRole('navigation', { name: 'Categorias dos ajustes' }).getByRole('button', { name: 'Universo', exact: true }).click()
}

test('o clima do mundo muda o app inteiro com a Nova cara, e some ao desligar', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await ajustesUniverso(page)
  const climas = page.getByRole('radiogroup', { name: 'O clima deste mundo' })
  await expect(climas.getByRole('radio', { name: /Caderno/ })).toHaveAttribute('aria-checked', 'true')
  await climas.getByRole('radio', { name: /Fantasia/ }).click()
  // Sem a chave, nada muda.
  await expect(page.locator('body')).not.toHaveAttribute('data-clima')
  await page.getByText('Nova cara (teste): usar o clima no app inteiro').click()
  await expect(page.locator('body')).toHaveAttribute('data-clima', 'fantasia')
  const fundo = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  await expect.poll(fundo).toBe('rgb(23, 17, 11)')
  // Outro clima, na hora.
  await climas.getByRole('radio', { name: /Terror/ }).click()
  await expect(page.locator('body')).toHaveAttribute('data-clima', 'terror')
  // Desligando, volta ao de sempre.
  await page.getByText('Nova cara (teste): usar o clima no app inteiro').click()
  await expect(page.locator('body')).not.toHaveAttribute('data-clima')
})
