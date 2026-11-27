import { expect, test } from './fixtures.ts'

// Coleções em Publicar: um volume novo nasce com os livros de uma coleção (as de dentro também).
test.use({ viewport: { width: 1280, height: 800 } })

test('Publicar: o volume novo pode nascer com os livros de uma coleção', async ({ page }) => {
  await page.goto('/app/?exemplo')
  await page.getByRole('region', { name: 'Livro atual' }).getByRole('button', { name: 'Trocar livro' }).click()
  await page.getByRole('dialog', { name: 'Trocar de livro' }).getByRole('button', { name: 'Agrupar em coleções' }).click()
  const ed = page.getByRole('dialog', { name: 'Coleções de livros' })
  await ed.getByRole('textbox', { name: 'Nome da nova coleção' }).fill('Contos de Ix')
  await ed.getByRole('button', { name: 'Criar' }).click()
  const livros = ed.getByRole('combobox', { name: /^Coleção de / })
  await livros.nth(2).selectOption({ label: 'Contos de Ix' })
  await livros.nth(3).selectOption({ label: 'Contos de Ix' })
  await page.keyboard.press('Escape')
  await expect(ed).toBeHidden()
  await page.getByRole('dialog', { name: 'Trocar de livro' }).getByRole('button', { name: 'Fechar' }).click()

  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Publicar/ }).click()
  await page.getByRole('button', { name: 'Novo livro' }).click()
  await page.getByLabel('Com os livros de uma coleção').selectOption({ label: 'Contos de Ix (2)' })
  await page.getByRole('button', { name: 'Criar livro' }).click()
  // O título vem da coleção, e o volume já tem as duas histórias.
  await expect(page.getByRole('option', { name: /Contos de Ix/ })).toBeVisible()
  await expect(page.locator('.book-hero-info h2')).toHaveText('Contos de Ix')

  // Escolhendo a coleção no alto, Publicar abre esse volume.
  await page.getByRole('region', { name: 'Livro atual' }).getByRole('button', { name: 'Trocar livro' }).click()
  await page.getByRole('dialog', { name: 'Trocar de livro' }).getByRole('radio', { name: 'Todos de Contos de Ix' }).click()
  await expect(page.locator('.book-hero-info h2')).toHaveText('Contos de Ix')
})
