import { expect, test } from './fixtures.ts'

// Ler como livro com uma coleção escolhida: o leitor lê só os livros dela (começa no primeiro e não passa para os outros).
test.use({ viewport: { width: 1280, height: 800 } })

test('ler como livro numa coleção lê só os livros dela', async ({ page }) => {
  await page.goto('/app/?exemplo')
  const faixa = page.getByRole('region', { name: 'Livro atual' })
  await faixa.getByRole('button', { name: 'Trocar livro' }).click()
  const troca = page.getByRole('dialog', { name: 'Trocar de livro' })
  await troca.getByRole('button', { name: 'Agrupar em coleções' }).click()
  const ed = page.getByRole('dialog', { name: 'Coleções de livros' })
  await ed.getByRole('textbox', { name: 'Nome da nova coleção' }).fill('Os dois últimos')
  await ed.getByRole('button', { name: 'Criar' }).click()
  const livros = ed.getByRole('combobox', { name: /^Coleção de / })
  const total = await livros.count()
  await livros.nth(total - 2).selectOption({ label: 'Os dois últimos' })
  await livros.nth(total - 1).selectOption({ label: 'Os dois últimos' })
  await page.keyboard.press('Escape')
  await troca.getByRole('radio', { name: 'Todos de Os dois últimos' }).click()

  await page.getByRole('button', { name: 'Ler como livro' }).first().click()
  const leitor = page.getByRole('dialog', { name: 'Modo leitor' })
  await expect(leitor.locator('.leitor-title')).toBeVisible()
  // A coleção é o fim e o começo da leitura: no primeiro capítulo dela não há "Anterior" (os livros de fora não entram).
  await expect(leitor.locator('.leitor-title')).toHaveText('A menina no galinheiro')
  const nav = leitor.getByRole('navigation', { name: 'Cenas' })
  await expect(nav.getByRole('button', { name: /Anterior/ })).toBeDisabled()
})
