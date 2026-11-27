import { expect, test } from './fixtures.ts'

// Coleções de livros: "Tales of Papilio" com "Tales of Malkai" dentro, cada livro numa casa só.
test.use({ viewport: { width: 1280, height: 800 } })

// (Enquanto os testes antigos não migram: roda na Nova cara.)
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem('papirus:cara-antiga', '0'))
})

test('agrupar livros em coleções, uma dentro da outra, e escolher a coleção no alto', async ({ page }) => {
  await page.goto('/app/?exemplo')
  const faixa = page.getByRole('region', { name: 'Livro atual' })
  await faixa.getByRole('button', { name: 'Trocar livro' }).click()
  const troca = page.getByRole('dialog', { name: 'Trocar de livro' })
  await troca.getByRole('button', { name: 'Agrupar em coleções' }).click()
  const ed = page.getByRole('dialog', { name: 'Coleções de livros' })

  await ed.getByRole('textbox', { name: 'Nome da nova coleção' }).fill('Tales of Papilio')
  await ed.getByRole('button', { name: 'Criar' }).click()
  await ed.getByRole('textbox', { name: 'Nome da nova coleção' }).fill('Tales of Malkai')
  await ed.getByRole('button', { name: 'Criar' }).click()
  // O Malkai fica dentro do Papilio.
  await ed.getByRole('combobox', { name: 'Dentro de (Tales of Malkai)' }).selectOption({ label: 'Dentro de Tales of Papilio' })
  // O primeiro livro no Papilio, o segundo no Malkai (uma casa só: o select tem um valor).
  const livros = ed.getByRole('combobox', { name: /^Coleção de / })
  await livros.nth(0).selectOption({ label: 'Tales of Papilio' })
  await livros.nth(1).selectOption({ label: 'Tales of Malkai' })
  await livros.nth(2).selectOption({ label: 'Tales of Malkai' })
  await expect(livros.nth(1)).toHaveValue(/.+/)
  await page.keyboard.press('Escape')

  // Escolher o Papilio traz os dois livros (o do Malkai está dentro); o nome da coleção aparece na faixa.
  await troca.getByRole('radio', { name: 'Todos de Tales of Papilio' }).click()
  await expect(faixa).toContainText('Tales of Papilio')
  // A escolha segue por outra área.
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Escrever/ }).first().click()
  await expect(page.getByRole('region', { name: 'Livro atual' })).toContainText('Tales of Papilio')

  // Escolher só o Malkai.
  await page.getByRole('region', { name: 'Livro atual' }).getByRole('button', { name: 'Trocar livro' }).click()
  await page.getByRole('dialog', { name: 'Trocar de livro' }).getByRole('radio', { name: 'Todos de Tales of Malkai' }).click()
  await expect(page.getByRole('region', { name: 'Livro atual' })).toContainText('Tales of Malkai')
})
