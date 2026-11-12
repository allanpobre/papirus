import { expect, test } from './fixtures.ts'

test('Guia: todas as ferramentas, cada parte a fundo, e Abrir leva até ela', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Guia' }).click()
  await expect(page.getByRole('heading', { name: 'Mundo', level: 2 })).toBeVisible()

  // Uma parte abre com o que o passeio da tela explica.
  await page.getByRole('button', { name: /^Linha do tempo/ }).click()
  await expect(page.getByText('Novo evento', { exact: true })).toBeVisible()

  // Procurar acha a parte pelo que ela faz.
  await page.getByRole('searchbox', { name: 'Procurar no guia' }).fill('árvore da família')
  await expect(page.getByRole('button', { name: 'Abrir Ligações' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Abrir Publicar' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Abrir Ligações' }).click()
  await expect(page.locator('[data-tour="partes"]').getByRole('button', { name: 'Ligações' })).toHaveAttribute('aria-current', /page|true/)
})

test.describe('no celular', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('o Mais em grupos, com o Guia em Ferramentas', async ({ page }) => {
    await page.goto('/app/?exemplo=ostria')
    await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Mais' }).click()
    for (const g of ['Escrita', 'Mundo', 'Mesa', 'Ferramentas']) await expect(page.getByRole('group', { name: g })).toBeVisible()
    await page.getByRole('group', { name: 'Ferramentas' }).getByRole('button', { name: 'Guia' }).click()
    await expect(page.getByRole('searchbox', { name: 'Procurar no guia' })).toBeVisible()
  })
})
