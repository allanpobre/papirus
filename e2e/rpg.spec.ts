import { expect, test, type Page } from './fixtures.ts'

const nav = (page: Page, name: string | RegExp) => page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name })
const tray = (page: Page) => page.getByRole('complementary', { name: 'Últimas rolagens' })

async function newUniverseWithTable(page: Page) {
  await page.goto('/app/')
  await page.getByRole('textbox', { name: 'Nome do novo universo' }).fill('Campanha')
  await page.getByRole('button', { name: 'Criar universo' }).click()
  await nav(page, 'RPG').click()
  await page.getByRole('textbox', { name: 'Nome da mesa' }).fill('Mesa de domingo')
  await page.getByRole('button', { name: 'Criar mesa' }).click()
}

test('mesa com sistema pronto: ficha, rolagem de perícia e registro na sessão', async ({ page }) => {
  await newUniverseWithTable(page)
  await page.getByRole('combobox', { name: 'Sistema da mesa' }).selectOption({ label: '+ Novo: estilo Ordem Paranormal' })
  await expect(page.getByText(/5 atributos, 4 recursos, 28 perícias/)).toBeVisible()

  // Sessão em andamento: as rolagens vão para o registro.
  await page.getByRole('button', { name: /Planejar sessão 1/ }).click()
  await page.getByRole('button', { name: 'Começar' }).click()

  await page.getByRole('tab', { name: 'Personagens' }).click()
  await page.getByRole('textbox', { name: 'Nome do personagem' }).fill('Dante')
  await page.getByRole('button', { name: 'Criar personagem' }).click()
  await page.getByRole('textbox', { name: 'Agilidade' }).fill('3')
  await page.getByRole('textbox', { name: 'Valor de Furtividade' }).fill('5')
  await page.getByRole('button', { name: /^Furtividade/ }).click()

  await expect(tray(page)).toContainText('Dante · Furtividade')
  await expect(tray(page)).toContainText('3d20kh1+5')
  await expect(tray(page)).toContainText('no registro')

  await page.getByRole('tab', { name: 'Sessões' }).click()
  await expect(page.locator('.log-roll')).toContainText('Dante — Furtividade')
})

test('recursos: dano e cura respeitam o máximo', async ({ page }) => {
  await newUniverseWithTable(page)
  await page.getByRole('combobox', { name: 'Sistema da mesa' }).selectOption({ label: '+ Novo: estilo D&D 5e' })
  await page.getByRole('tab', { name: 'Personagens' }).click()
  await page.getByRole('textbox', { name: 'Nome do personagem' }).fill('Taren')
  await page.getByRole('button', { name: 'Criar personagem' }).click()

  const pvAtual = page.getByRole('textbox', { name: 'Pontos de vida atual' })
  await expect(pvAtual).toHaveValue('10')
  await page.getByRole('textbox', { name: 'Quantidade de PV' }).fill('4')
  await page.getByRole('button', { name: 'Dano' }).first().click()
  await expect(pvAtual).toHaveValue('6')
  await page.getByRole('textbox', { name: 'Quantidade de PV' }).fill('20')
  await page.getByRole('button', { name: 'Cura' }).first().click()
  await expect(pvAtual).toHaveValue('10')
})

test('iniciativa: grupo entra pela ficha, e vez e rodada continuam após recarregar', async ({ page }) => {
  await page.goto('/app/')
  await page.getByRole('button', { name: 'Abrir um universo de exemplo' }).click()
  await nav(page, 'RPG').click()
  await page.getByRole('tab', { name: 'Sessões' }).click()
  await page.getByRole('button', { name: 'Começar' }).click()
  await page.getByRole('button', { name: 'Adicionar os jogadores da mesa' }).click()
  const rows = page.locator('.init-row')
  await expect(rows).toHaveCount(3)

  // Uma volta completa: três vezes e a rodada 2 começa.
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Próxima vez' }).click()
  await expect(page.locator('.round-pill')).toHaveText('Rodada 2')
  const current = await page.locator('.init-row.current .init-name').textContent()

  await page.reload()
  await nav(page, 'RPG').click()
  await page.getByRole('tab', { name: 'Sessões' }).click()
  await expect(page.locator('.round-pill')).toHaveText('Rodada 2')
  await expect(page.locator('.init-row.current .init-name')).toHaveText(current!)
  await expect(page.locator('.log')).toContainText('Rodada 2')
})

test('sistema próprio: criar do zero, adicionar atributo e testar a fórmula', async ({ page }) => {
  await newUniverseWithTable(page)
  await page.getByRole('tab', { name: 'Sistemas' }).click()
  await page.getByRole('button', { name: /Sem sistema \(narrativo\)/ }).click()
  await page.getByRole('textbox', { name: 'Nome do sistema' }).fill('Meu sistema')
  await page.getByRole('button', { name: 'Atributo', exact: true }).click()
  await page.getByRole('textbox', { name: 'Sigla', exact: true }).last().fill('ESP')
  await page.getByRole('textbox', { name: 'Nome do atributo' }).last().fill('Espírito')
  await page.getByRole('textbox', { name: 'Atributo', exact: true }).fill('2d6+{ESP}')
  await page.getByRole('button', { name: 'Testar' }).nth(1).click()
  await expect(page.locator('.formula-test')).toContainText(/Atributo: \d+ · 2d6\+0/)

  await page.getByRole('textbox', { name: 'Atributo', exact: true }).fill('2d6+{')
  await page.getByRole('button', { name: 'Testar' }).nth(1).click()
  await expect(page.locator('.formula-test')).toHaveClass(/notice-error/)

  // A mesa passa a usar o sistema.
  await page.getByRole('tab', { name: 'Painel do mestre' }).click()
  await page.getByRole('combobox', { name: 'Sistema da mesa' }).selectOption({ label: 'Meu sistema' })
  await expect(page.locator('.rpg-view .view-head')).toContainText('Meu sistema')
})

test('tabela aleatória sorteia uma das opções', async ({ page }) => {
  await page.goto('/app/')
  await page.getByRole('button', { name: 'Abrir um universo de exemplo' }).click()
  await nav(page, 'RPG').click()
  await page.getByRole('tab', { name: 'Dados e tabelas' }).click()
  const card = page.locator('.table-card').filter({ has: page.getByRole('textbox', { name: 'Nome da tabela' }) }).first()
  await card.getByRole('button', { name: 'Rolar' }).click()
  await expect(card.locator('.table-result')).toHaveText(/navio|Torre|Maré|vidro|guarda|anel/)
})
