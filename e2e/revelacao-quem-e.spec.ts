import { expect, test } from './fixtures.ts'

/*
 * A espécie verdadeira revelada mais tarde (o caso do Malkai), no celular: o autor marca em que cena o leitor
 * descobre e o que ele vê até lá. O autor sempre vê a verdade; "como o leitor", a máscara até a cena.
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

test('Quem é revelado numa cena, com máscara até lá', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await page.getByRole('button', { name: 'Mundo', exact: true }).first().click()
  await page.getByRole('region', { name: 'Lista de fichas' }).getByRole('button', { name: /^Kael/ }).first().click()
  const modo = (nome: 'Ler' | 'Editar') => page.getByRole('group', { name: 'Modo da ficha' }).getByRole('button', { name: nome })
  await modo('Editar').click()

  // A espécie, com duas opções: a que parece (Humano) e a verdadeira (Vanderyu).
  const quem = page.getByRole('region', { name: 'Quem é' })
  await quem.getByRole('button', { name: 'O que define' }).click()
  await quem.getByRole('textbox', { name: 'O que define' }).fill('Espécie')
  await quem.getByRole('button', { name: 'Criar' }).click()
  for (const nome of ['Humano', 'Vanderyu']) {
    await quem.getByRole('combobox', { name: 'Espécie' }).selectOption('__nova')
    await quem.getByRole('textbox', { name: 'Nova opção de Espécie' }).fill(nome)
    await quem.getByRole('button', { name: 'Criar' }).click()
  }
  await expect(quem.getByRole('combobox', { name: 'Espécie' }).locator('option:checked')).toHaveText('Vanderyu')

  // O leitor só descobre em "O retrato"; até lá, vê "Humano".
  await quem.getByRole('button', { name: 'O leitor descobre depois…' }).click()
  const painel = quem.getByRole('group', { name: 'Quando o leitor descobre espécie de Kael' })
  const cena = painel.getByRole('combobox', { name: 'O leitor descobre em' })
  await cena.selectOption((await cena.locator('option', { hasText: 'O retrato' }).getAttribute('value'))!)
  await painel.getByRole('combobox', { name: 'Até lá, o leitor vê' }).selectOption({ label: 'Humano' })
  await expect(quem.getByRole('button', { name: /O leitor descobre em “O retrato”; até lá, parece Humano/ })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  // O autor, lendo: a verdade, com a cena e a máscara ao lado.
  await modo('Ler').click()
  const lendo = page.getByRole('region', { name: 'Quem é' })
  await expect(lendo).toContainText('Espécie: Vanderyu')
  await expect(lendo).toContainText('o leitor descobre em “O retrato” · até lá, parece Humano')

  // Como o leitor, antes de "O retrato": Humano. Na cena: Vanderyu.
  const regua = page.getByRole('group', { name: 'Ponto da história' })
  const ate = regua.getByRole('combobox', { name: 'Até onde na história' })
  await ate.selectOption((await ate.locator('option', { hasText: 'A chegada' }).getAttribute('value'))!)
  await regua.getByText('Ver como o leitor').click()
  await expect(lendo).toContainText('Espécie: Humano')
  await expect(lendo).not.toContainText('Vanderyu')
  await expect(page.getByRole('article')).not.toContainText('Vanderyu')
  await ate.selectOption((await ate.locator('option', { hasText: 'O retrato' }).getAttribute('value'))!)
  await expect(lendo).toContainText('Espécie: Vanderyu')
  await expect(lendo).not.toContainText('o leitor descobre')

  // Sem máscara, antes da cena a linha some para o leitor.
  await regua.getByText('Ver como o leitor').click()
  await modo('Editar').click()
  await quem.getByRole('button', { name: /O leitor descobre em “O retrato”/ }).click()
  await painel.getByRole('combobox', { name: 'Até lá, o leitor vê' }).selectOption({ label: 'Nada (fica escondido)' })
  await modo('Ler').click()
  await ate.selectOption((await ate.locator('option', { hasText: 'A chegada' }).getAttribute('value'))!)
  await regua.getByText('Ver como o leitor').click()
  await expect(page.getByRole('region', { name: 'Quem é' })).toHaveCount(0)
})
