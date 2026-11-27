import { expect, test, type Page } from './fixtures.ts'
import { fichaModo, openPart, escolherLivro } from './areas.ts'

/*
 * Cada ficha é dos seus livros: a criada com um livro escolhido nasce dele e não aparece nos outros; a ficha
 * sem livro só aparece em "Todos os livros"; dá para pôr num livro na própria ficha. No celular.
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

const lista = (page: Page) => page.getByRole('region', { name: 'Lista de fichas' })

test('ficha criada num livro não aparece no outro; e se põe num livro pela ficha', async ({ page }) => {
  await page.goto('/app/?exemplo')
  await escolherLivro(page, /^Ozma de Oz/)
  await openPart(page, 'Fichas')
  await page.getByRole('button', { name: 'Nova ficha' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nova ficha' })
  await dialog.getByRole('textbox', { name: 'Nome' }).fill('Pipt')
  await dialog.getByRole('button', { name: 'Criar e fazer outra' }).click()
  await dialog.getByRole('button', { name: 'Fechar' }).click()
  await expect(lista(page).getByRole('button', { name: /^Pipt/ })).toBeVisible()

  // No outro livro, não aparece.
  await escolherLivro(page, /^O Mágico de Oz/)
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Mundo', exact: true }).click()
  await expect(lista(page).getByRole('button', { name: /^Pipt/ })).toHaveCount(0)

  // Em "Todos os livros", aparece; pela ficha, passa a ser também do Mágico.
  await escolherLivro(page, /^Todos os livros/)
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Mundo', exact: true }).click()
  await lista(page).getByRole('button', { name: /^Pipt/ }).click()
  await fichaModo(page, 'Editar')
  const livros = page.getByRole('group', { name: 'Livros desta ficha' })
  await expect(livros.getByRole('button', { name: /^Ozma de Oz/ })).toHaveAttribute('aria-pressed', 'true')
  await livros.getByRole('button', { name: /^O Mágico de Oz/ }).click()
  await page.getByRole('button', { name: 'Voltar para a lista' }).click()
  await escolherLivro(page, /^O Mágico de Oz/)
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Mundo', exact: true }).click()
  await expect(lista(page).getByRole('button', { name: /^Pipt/ })).toBeVisible()
})
