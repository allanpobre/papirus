import { expect, test, type Page } from './fixtures.ts'
import { openPart } from './areas.ts'

const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: new RegExp(`^${name}`) }).first()
const book = (page: Page) => page.getByLabel('Livro', { exact: true })

test.describe('o livro escolhido no alto', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('Escrever, Fichas e Publicar seguem o livro, e a escolha fica guardada', async ({ page }) => {
    await page.goto('/app/?exemplo')
    await nav(page, 'Escrever').click()
    await expect(book(page)).toHaveValue('')
    await book(page).selectOption({ label: 'Ozma de Oz (trechos)' })

    // Escrever: abre na primeira cena do livro, e o manuscrito só tem ele.
    await expect(page.getByText(/Ozma de Oz \(trechos\) · cena 1 de/).filter({ visible: true }).first()).toBeVisible()
    await page.getByRole('button', { name: 'Mostrar manuscrito' }).click()
    const tree = page.getByRole('complementary', { name: 'Manuscrito' })
    await expect(tree.getByRole('textbox', { name: 'Título da história' })).toHaveCount(1)
    await expect(tree.getByRole('textbox', { name: 'Título da história' })).toHaveValue('Ozma de Oz (trechos)')
    await page.keyboard.press('Escape')

    // Fichas: só quem aparece no livro, com um jeito de ver todas.
    await openPart(page, 'Fichas')
    const list = page.getByRole('region', { name: 'Lista de fichas' }).locator('li')
    await expect(page.getByText('Só quem aparece em “Ozma de Oz (trechos)”.')).toBeVisible()
    const inBook = await list.count()
    await page.getByRole('button', { name: 'Ver todas as fichas' }).click()
    await expect.poll(() => list.count()).toBeGreaterThan(inBook)

    // Guardado: depois de recarregar, o livro continua escolhido.
    await page.reload()
    await expect(book(page)).toHaveValue(/.+/)
    await expect(book(page).locator('option:checked')).toHaveText('Ozma de Oz (trechos)')

    // Todos os livros: o manuscrito volta a ter todas as histórias.
    await nav(page, 'Escrever').click()
    await book(page).selectOption({ label: 'Todos os livros' })
    await page.getByRole('button', { name: 'Mostrar manuscrito' }).click()
    await expect.poll(() => page.getByRole('complementary', { name: 'Manuscrito' }).getByRole('textbox', { name: 'Título da história' }).count()).toBeGreaterThan(2)
  })

  test('Publicar abre o volume do livro escolhido', async ({ page }) => {
    await page.goto('/app/?exemplo')
    await nav(page, 'Escrever').click()
    await book(page).selectOption({ label: 'Ozma de Oz (trechos)' })
    const more = page.getByRole('button', { name: 'Mais', exact: true })
    await more.click()
    await page.getByRole('group', { name: 'Todas as áreas' }).getByRole('button', { name: 'Publicar', exact: true }).click()
    // O volume da estante que tem essa história (o título do volume é o do livro).
    await expect(page.locator('.book-hero-info h2')).toHaveText('Ozma de Oz')
  })

  test('num universo de um livro só, a faixa não aparece', async ({ page }) => {
    await page.goto('/app/?exemplo=alienista')
    await nav(page, 'Escrever').click()
    await expect(page.locator('.write-view, .view').first()).toBeVisible()
    await expect(page.locator('[data-tour="livro-atual"]')).toHaveCount(0)
  })
})
