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
  // Dados na mesa (o padrão): rola os dados de verdade e diz o que saiu; o app faz a conta.
  await page.getByRole('button', { name: /^Furtividade/ }).click()
  const quanto = page.getByRole('dialog', { name: 'Quanto saiu no dado?' })
  await expect(quanto).toContainText('3d20kh1+5')
  await quanto.getByRole('spinbutton', { name: 'Resultado do 1º dado (d20)' }).fill('4')
  await quanto.getByRole('spinbutton', { name: 'Resultado do 2º dado (d20)' }).fill('17')
  await quanto.getByRole('spinbutton', { name: 'Resultado do 3º dado (d20)' }).fill('25')
  await expect(quanto.getByRole('status')).toContainText('de 1 a 20')
  await quanto.getByRole('spinbutton', { name: 'Resultado do 3º dado (d20)' }).fill('9')
  await expect(quanto.getByRole('status')).toContainText('Total 22')
  await quanto.getByRole('button', { name: 'Registrar' }).click()

  await expect(tray(page)).toContainText('Dante · Furtividade')
  await expect(tray(page)).toContainText('3d20kh1+5')
  await expect(tray(page)).toContainText('[4, 17, 9]')
  await expect(tray(page)).toContainText('no registro')

  // No app: o app sorteia, sem perguntar.
  await page.getByRole('radiogroup', { name: 'Dados' }).getByRole('radio', { name: 'No app' }).click()
  await page.getByRole('button', { name: /^Furtividade/ }).click()
  await expect(quanto).toHaveCount(0)
  await page.getByRole('radiogroup', { name: 'Dados' }).getByRole('radio', { name: 'Na mesa' }).click()

  await page.getByRole('tab', { name: 'Sessões' }).click()
  await expect(page.locator('.log-roll')).toHaveCount(2)
  await expect(page.locator('.log-roll').first()).toContainText('Dante — Furtividade: 22')
  await expect(page.locator('.log-roll').first()).toContainText('dado físico')
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
  await expect(page.locator('.rpg-view .mesa-hero')).toContainText('Meu sistema')
})

test('tabela aleatória sorteia uma das opções', async ({ page }) => {
  await page.goto('/app/')
  await page.getByRole('button', { name: 'Abrir um universo de exemplo' }).click()
  await nav(page, 'RPG').click()
  await page.getByRole('tab', { name: 'Dados e tabelas' }).click()
  const card = page.locator('.table-card').filter({ has: page.getByRole('textbox', { name: 'Nome da tabela' }) }).first()
  await card.getByRole('button', { name: 'Rolar' }).click()
  await expect(card.locator('.table-result')).toHaveText(/cubículos|matraca|boticário|albardeiro|barbeiro|Rio de Janeiro/)
})

test('Codex: revelar uma ligação coloca no mapa dos jogadores, marcada como nova', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await nav(page, 'RPG').click()
  await page.getByRole('tab', { name: 'Revelações e Codex' }).click()
  const codex = page.locator('.codex-doc').first()
  await expect(codex.getByRole('img', { name: /^Mapa com 5 fichas e 3 ligações/ })).toBeVisible()
  await page.getByRole('combobox', { name: 'O que revelar' }).selectOption({ label: 'Ligação' })
  await page.getByRole('combobox', { name: 'Escolher ligação' }).selectOption({ label: 'Kael protege Homem Pálido' })
  await page.getByRole('button', { name: 'Revelar', exact: true }).click()
  await expect(codex.getByRole('img', { name: /^Mapa com 5 fichas e 4 ligações/ })).toBeVisible()
  await expect(codex.getByText('Kael protege Homem Pálido')).toBeVisible()
})

test('a mesa é outro setor: o app muda de clima ao entrar e volta ao sair', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await expect(page.getByRole('button', { name: 'Continuar escrevendo' })).toBeVisible()
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  const before = await bg()
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^RPG/ }).click()
  await expect(page.getByRole('heading', { name: 'Mesa de RPG', level: 1 })).toBeVisible()
  await expect(page.locator('body')).toHaveAttribute('data-sector', 'mesa')
  expect(await bg()).not.toBe(before)
  await expect(page.getByRole('tablist', { name: 'Mesa de RPG' }).getByRole('tab')).toHaveCount(7)
  await page.getByRole('button', { name: 'Voltar à escrita' }).click()
  await expect(page.getByRole('button', { name: 'Continuar escrevendo' })).toBeVisible()
  await expect(page.locator('body')).not.toHaveAttribute('data-sector', 'mesa')
  expect(await bg()).toBe(before)
})

test('o mestre escolhe o tema da mesa pelo gênero; claro ou escuro segue cada pessoa', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await expect(page.getByRole('button', { name: 'Continuar escrevendo' })).toBeVisible()
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^RPG/ }).click()
  // Sem escolha, vale o sugerido pelo sistema (D&D → Pergaminho).
  await expect(page.locator('body')).toHaveAttribute('data-mesa-tema', 'pergaminho')
  await page.getByRole('button', { name: 'Tema', exact: true }).click()
  const temas = page.getByRole('dialog', { name: 'Tema da mesa' })
  await expect(temas.getByRole('radio', { name: /Pergaminho.*sugerido/ })).toHaveAttribute('aria-checked', 'true')
  await temas.getByRole('radio', { name: /^Abismo/ }).click()
  await expect(page.locator('body')).toHaveAttribute('data-mesa-tema', 'abismo')
  await temas.getByRole('button', { name: 'Fechar' }).click()
  // "Sem tema": as cores de sempre.
  await page.getByRole('button', { name: 'Tema', exact: true }).click()
  await temas.getByRole('radio', { name: /^Sem tema/ }).click()
  await expect(page.locator('body')).not.toHaveAttribute('data-mesa-tema', /.+/)
})
