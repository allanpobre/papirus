import { expect, test } from './fixtures.ts'

/*
 * Revisão › Nomes novos: o tipo da ficha vem sugerido pelo texto em volta ("chegou à cidade de X" é lugar; "X disse" é
 * personagem). É só uma sugestão: o tipo dá para trocar antes de criar.
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

test('um nome que parece lugar já vem como lugar; o que parece gente, como personagem; e dá para trocar', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Começar a escrever' }).first().click()
  await page.getByRole('textbox', { name: 'Nome do novo universo' }).fill('Maré Baixa')
  await page.getByRole('button', { name: 'Criar universo' }).click()
  await page.waitForTimeout(1000)
  await page.getByRole('region', { name: 'Primeiros passos' }).getByRole('button', { name: 'Escreva a primeira cena' }).click()
  const editor = page.getByRole('textbox', { name: 'Texto da cena' })
  await editor.click()
  await page.keyboard.type('Ontem Kaya chegou à cidade de Vaelor ao anoitecer. Depois Kaya disse que Vaelor era linda, e Brenn sorriu.')
  await page.getByRole('toolbar', { name: 'Formatação' }).getByRole('button', { name: /nomes novos/ }).click()
  const revisao = page.getByRole('dialog', { name: 'Revisão' })
  const linha = (nome: string) => revisao.locator('.candidate').filter({ has: page.locator('.candidate-name', { hasText: new RegExp(`^${nome}$`) }) })

  // O lugar vem como lugar, com a dica na tela; as pessoas, como personagem.
  await expect(linha('Vaelor').getByLabel('Tipo de Vaelor')).toHaveValue('lugar')
  await expect(linha('Vaelor')).toContainText('pelo texto: lugar')
  await expect(linha('Kaya').getByLabel('Tipo de Kaya')).toHaveValue('personagem')
  await expect(linha('Brenn').getByLabel('Tipo de Brenn')).toHaveValue('personagem')
  await expect(linha('Kaya')).toContainText('pelo texto: personagem')

  // A sugestão não prende: dá para trocar o tipo antes de criar.
  await linha('Brenn').getByLabel('Tipo de Brenn').selectOption('artefato')
  await linha('Brenn').getByRole('button', { name: 'Criar ficha' }).click()
  await linha('Vaelor').getByRole('button', { name: 'Criar ficha' }).click()
  await expect(page.getByText('Ficha “Vaelor” criada')).toBeVisible()
  await page.keyboard.press('Escape')

  // No Mundo: Vaelor é lugar e Brenn é artefato, como escolhido.
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Mais/ }).click()
  await page.getByRole('group', { name: 'Todas as áreas' }).getByRole('button', { name: 'Mundo', exact: true }).click()
  await expect(page.locator('.entity-row', { hasText: 'Vaelor' })).toContainText('Lugar')
  await expect(page.locator('.entity-row', { hasText: 'Brenn' })).toContainText('Artefato')
})

test('"Criar fichas" para vários nomes usa o tipo sugerido para cada um', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Começar a escrever' }).first().click()
  await page.getByRole('textbox', { name: 'Nome do novo universo' }).fill('Maré Baixa')
  await page.getByRole('button', { name: 'Criar universo' }).click()
  await page.waitForTimeout(1000)
  await page.getByRole('region', { name: 'Primeiros passos' }).getByRole('button', { name: 'Escreva a primeira cena' }).click()
  await page.getByRole('textbox', { name: 'Texto da cena' }).click()
  await page.keyboard.type('Ontem Kaya chegou à cidade de Vaelor ao anoitecer. Depois Kaya disse que Vaelor era linda.')
  await page.getByRole('toolbar', { name: 'Formatação' }).getByRole('button', { name: /nomes novos/ }).click()
  const revisao = page.getByRole('dialog', { name: 'Revisão' })
  for (const nome of ['Kaya', 'Vaelor'])
    await revisao.locator('.candidate').filter({ has: page.locator('.candidate-name', { hasText: new RegExp(`^${nome}$`) }) }).getByRole('checkbox').check()
  const lote = revisao.getByLabel('Tipo para as novas fichas')
  await expect(lote).toHaveValue('auto')
  await revisao.getByRole('button', { name: 'Criar fichas' }).click()
  await expect(page.getByText('2 fichas criadas')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Mais/ }).click()
  await page.getByRole('group', { name: 'Todas as áreas' }).getByRole('button', { name: 'Mundo', exact: true }).click()
  await expect(page.locator('.entity-row', { hasText: 'Vaelor' })).toContainText('Lugar')
  await expect(page.locator('.entity-row', { hasText: 'Kaya' })).toContainText('Personagem')
})
