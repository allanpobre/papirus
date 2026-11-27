import { expect, test } from './fixtures.ts'

// Wiki por coleção: Personalizar › "Só os livros de uma coleção" muda o recorte e o título da wiki.
test.use({ viewport: { width: 1280, height: 800 } })

test('a wiki pode ser só dos livros de uma coleção', async ({ page }) => {
  await page.goto('/app/?exemplo')
  await page.getByRole('region', { name: 'Livro atual' }).getByRole('button', { name: 'Trocar livro' }).click()
  await page.getByRole('dialog', { name: 'Trocar de livro' }).getByRole('button', { name: 'Agrupar em coleções' }).click()
  const ed = page.getByRole('dialog', { name: 'Coleções de livros' })
  await ed.getByRole('textbox', { name: 'Nome da nova coleção' }).fill('Contos de Ix')
  await ed.getByRole('button', { name: 'Criar' }).click()
  await ed.getByRole('combobox', { name: /^Coleção de / }).nth(3).selectOption({ label: 'Contos de Ix' })
  await page.keyboard.press('Escape')
  await page.getByRole('dialog', { name: 'Trocar de livro' }).getByRole('button', { name: 'Fechar' }).click()

  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Mundo/ }).first().click()
  await page.getByRole('button', { name: 'Wiki' }).click()
  const personalizar = page.getByRole('group', { name: 'Personalizar' })
  await personalizar.getByRole('combobox', { name: 'Só os livros de uma coleção' }).selectOption({ label: 'Contos de Ix' })
  await expect(personalizar.getByText('do seu jeito')).toBeVisible()
  // A prévia da wiki (iframe) já traz o nome da coleção no título.
  await expect(page.frameLocator('iframe').first().locator('h1').first()).toContainText('Contos de Ix')
})
