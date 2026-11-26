import { expect, test, type Page } from './fixtures.ts'

/*
 * A Nova cara é a de todos: cada mundo escolhe o seu clima em Ajustes › Universo, e o app inteiro muda de cara na
 * hora (não há mais chave para ligar). No celular.
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

async function ajustesUniverso(page: Page) {
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Menu', exact: true }).click()
  await page.getByRole('group', { name: 'Todas as áreas' }).getByRole('button', { name: /Ajustes/ }).click()
  await page.getByRole('navigation', { name: 'Categorias dos ajustes' }).getByRole('button', { name: /^Universo/ }).click()
}

test('o clima do mundo muda o app inteiro na hora, no escuro e no claro', async ({ page, context }) => {
  await context.addInitScript(() => localStorage.setItem('papirus:cara-antiga', '0'))
  await page.goto('/app/?exemplo=ostria')
  await ajustesUniverso(page)
  const climas = page.getByRole('radiogroup', { name: 'O clima deste mundo' })
  await expect(climas.getByRole('radio', { name: /Caderno/ })).toHaveAttribute('aria-checked', 'true')
  // Caderno é o de sempre: nada de clima no corpo da página.
  await expect(page.locator('body')).not.toHaveAttribute('data-clima')
  await climas.getByRole('radio', { name: /Fantasia/ }).click()
  await expect(page.locator('body')).toHaveAttribute('data-clima', 'fantasia')
  const fundo = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  await expect.poll(fundo).toBe('rgb(31, 29, 26)')
  // Claro: o mesmo clima de dia.
  await page.getByRole('radiogroup', { name: 'Claro ou escuro' }).getByRole('radio', { name: 'Claro' }).click()
  await expect(page.locator('body')).toHaveAttribute('data-clima-modo', 'claro')
  await expect.poll(fundo).toBe('rgb(239, 233, 220)')
  await page.getByRole('radiogroup', { name: 'Claro ou escuro' }).getByRole('radio', { name: 'Escuro' }).click()
  // Outro clima, na hora; e de volta ao Caderno, volta ao de sempre.
  await climas.getByRole('radio', { name: /Terror/ }).click()
  await expect(page.locator('body')).toHaveAttribute('data-clima', 'terror')
  await climas.getByRole('radio', { name: /Caderno/ }).click()
  await expect(page.locator('body')).not.toHaveAttribute('data-clima')
  // E não existe mais a chave “Nova cara (teste)”.
  await expect(page.getByText(/Nova cara \(teste\)/)).toHaveCount(0)
})
