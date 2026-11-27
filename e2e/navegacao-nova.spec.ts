import { expect, test } from './fixtures.ts'

/*
 * Nova cara: a barra de baixo tem os lugares grandes fixos (Escrever, Mundo, História, Mesa ou Publicar) e o
 * "Menu" com o resto. A História junta pistas, quem sabe o quê e a linha do tempo. No celular.
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

test('lugares grandes na barra, História com a linha do tempo e o resto no Menu', async ({ page }) => {
  await page.addInitScript(() => {
    const prefs = JSON.parse(localStorage.getItem('papirus:prefs') ?? '{}')
    localStorage.setItem('papirus:prefs', JSON.stringify({ ...prefs, novaCara: true }))
  })
  await page.goto('/app/?exemplo')
  const barra = page.getByRole('navigation', { name: 'Áreas' })
  await expect(barra.getByRole('button')).toHaveText(['Escrever', 'Mundo', 'História', 'Mesa', 'Menu'])

  // A História tem as pistas, quem sabe o quê e a linha do tempo; o Mundo não tem mais a linha do tempo.
  await barra.getByRole('button', { name: 'História' }).click()
  const partes = page.locator('[data-tour="partes"]')
  await expect(partes.getByRole('button', { name: /Tempo|Linha do tempo/ })).toBeVisible()
  await partes.getByRole('button', { name: /Tempo|Linha do tempo/ }).click()
  await expect(barra.getByRole('button', { name: 'História' })).toHaveAttribute('aria-current', 'page')
  await barra.getByRole('button', { name: 'Mundo' }).click()
  await expect(partes.getByRole('button', { name: /Tempo|Linha do tempo/ })).toHaveCount(0)

  // O Menu tem o resto (Início, Publicar, Ajustes…), sem "Escolher atalhos".
  await barra.getByRole('button', { name: 'Menu' }).click()
  const menu = page.getByRole('group', { name: 'Todas as áreas' })
  await expect(menu.getByRole('button', { name: /^Início/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Escolher atalhos' })).toHaveCount(0)
  await menu.getByRole('button', { name: /^Início/ }).click()
  // No celular, o Início abre com o Continuar; o livro se troca pela faixa do alto.
  await expect(page.getByRole('region', { name: 'Livro atual' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continuar escrevendo' })).toBeInViewport()
})

test('passeio, Guia e Menu falam com os nomes da Nova cara', async ({ page }) => {
  await page.addInitScript(() => {
    const prefs = JSON.parse(localStorage.getItem('papirus:prefs') ?? '{}')
    localStorage.setItem('papirus:prefs', JSON.stringify({ ...prefs, novaCara: true }))
  })
  await page.goto('/app/?exemplo=ostria')
  const barra = page.getByRole('navigation', { name: 'Áreas' })

  // O Menu agrupa “Mundo e História”.
  await barra.getByRole('button', { name: 'Menu' }).click()
  await expect(page.getByRole('group', { name: 'Mundo e História' })).toBeVisible()
  await page.getByRole('group', { name: 'Ferramentas' }).getByRole('button', { name: 'Guia' }).click()

  // No Guia, a área é “História” e a Linha do tempo mora nela, não no Mundo.
  await expect(page.getByRole('heading', { name: 'História', level: 2 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Trama', level: 2 })).toHaveCount(0)
  const historia = page.locator('section', { has: page.getByRole('heading', { name: 'História', level: 2 }) })
  await expect(historia.getByRole('button', { name: /^Linha do tempo/ })).toBeVisible()
  const mundo = page.locator('section', { has: page.getByRole('heading', { name: 'Mundo', level: 2 }) })
  await expect(mundo.getByRole('button', { name: /^Linha do tempo/ })).toHaveCount(0)

  // O passeio do Mundo diz três partes.
  await barra.getByRole('button', { name: 'Mundo' }).click()
  await page.getByRole('button', { name: /^Como usar:/ }).first().click()
  const passeio = page.getByRole('dialog').filter({ hasText: 'O mundo em três partes' })
  await expect(passeio).toContainText('Fichas, Ligações e Mapas')
})
