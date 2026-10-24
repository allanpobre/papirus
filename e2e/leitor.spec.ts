import { expect, test } from './fixtures.ts'

test('modo leitor: o caderno se preenche conforme a leitura, sem spoiler', async ({ page }) => {
  await page.goto('/app/?exemplo')
  await page.getByRole('button', { name: 'Prévia do leitor' }).click()
  const leitor = page.getByRole('dialog', { name: 'Modo leitor' })

  await expect(leitor.getByRole('heading', { name: 'A chegada' })).toBeVisible()
  const caderno = leitor.getByRole('complementary', { name: 'Caderno do leitor' })
  await expect(caderno.getByRole('button', { name: /^Kael/ })).toBeVisible()
  await expect(caderno.getByRole('button', { name: /^Mira/ })).toBeVisible()
  // Ilsa só aparece na cena 2; Vaelor é secreto.
  await expect(caderno.getByRole('button', { name: /^Ilsa/ })).toHaveCount(0)
  await expect(caderno).not.toContainText('Vaelor')

  // O trecho marcado da Mira ainda não aparece.
  await caderno.getByRole('button', { name: /^Mira/ }).click()
  await expect(caderno).not.toContainText('Foi criada por Ilsa')
  await expect(caderno).not.toContainText('herdeira')

  // Próxima cena: Ilsa entra, e o leitor descobre algo sobre a Mira.
  await leitor.getByRole('button', { name: 'Próxima cena' }).click()
  await expect(leitor.getByRole('heading', { name: 'A Torre fechada' })).toBeVisible()
  const found = leitor.getByRole('region', { name: 'Nesta cena você descobriu' })
  await expect(found).toContainText('Ilsa')
  await expect(found).toContainText('Você descobriu sobre Mira')
  await expect(caderno).toContainText('Foi criada por Ilsa')

  // Clicar num nome no texto abre a ficha no caderno.
  await page.locator('.leitor-text').getByRole('button', { name: 'Ilsa' }).first().click()
  await expect(caderno.getByRole('button', { name: /^Ilsa/ })).toHaveAttribute('aria-expanded', 'true')

  // Ligações e linha do tempo só com o que já se sabe.
  await caderno.getByRole('tab', { name: /^Ligações/ }).click()
  await expect(caderno.getByRole('img', { name: /^Mapa com/ })).toBeVisible()
  await expect(caderno).not.toContainText('Vaelor')
  await caderno.getByRole('tab', { name: /^Linha do tempo/ }).click()
  await expect(caderno).not.toContainText('Retorno do Homem Pálido')

  // O progresso fica guardado.
  await leitor.getByRole('button', { name: 'Voltar ao universo' }).click()
  await expect(leitor).toHaveCount(0)
  await page.getByRole('button', { name: 'Prévia do leitor' }).click()
  await expect(leitor.getByRole('heading', { name: 'A Torre fechada' })).toBeVisible()
})

test('ficha: marcar um trecho para revelar a partir de uma cena', async ({ page }) => {
  await page.goto('/app/?exemplo')
  await page.getByRole('button', { name: 'Fichas' }).first().click()
  await page.getByRole('button', { name: /^Ilsa/ }).first().click()
  const desc = page.getByRole('textbox', { name: 'Descrição' })
  await desc.fill('Guarda a Torre. Está viva.')
  await desc.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(16, 26))
  await page.getByRole('button', { name: 'Revelar a partir de…', exact: true }).click()
  await page.getByRole('combobox', { name: 'Revelar ao leitor a partir de qual cena' }).selectOption({ label: '3. Nas brumas' })
  await expect(desc).toHaveValue(/^Guarda a Torre\. \[a partir de "Nas brumas" #[0-9a-f]{6}\]Está viva\.\[\/a partir\]$/)
  await expect(page.getByText('O leitor vê a partir da cena 3, “Nas brumas”')).toBeVisible()

  // No resumo: sem seleção, marca o campo todo.
  await page.getByRole('button', { name: 'Resumo: revelar a partir de…' }).click()
  await page.getByRole('combobox', { name: 'Resumo: revelar ao leitor a partir de qual cena' }).selectOption({ label: '2. A Torre fechada' })
  await expect(page.getByRole('textbox', { name: 'Resumo' })).toHaveValue(/^\[a partir de "A Torre fechada" #[0-9a-f]{6}\]Guardiã/)
  await page.getByRole('button', { name: /Resumo: só a partir da cena 2/ }).click()
  await expect(page.getByRole('textbox', { name: 'Resumo' })).toHaveValue(/^Guardiã/)
})
