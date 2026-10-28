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
  // A ficha abre para jogar; montar a ficha é no modo Editar.
  await page.getByRole('group', { name: 'Modo da ficha de jogo' }).getByRole('button', { name: 'Editar' }).click()
  await page.getByRole('textbox', { name: 'Agilidade' }).fill('3')
  await page.getByRole('textbox', { name: 'Valor de Furtividade' }).fill('5')
  await page.getByRole('group', { name: 'Modo da ficha de jogo' }).getByRole('button', { name: 'Jogar' }).click()
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

  // Na ficha de jogo: toca no PV, diz quanto e escolhe perde ou recupera.
  const pv = page.getByRole('button', { name: /^Pontos de vida: / })
  await expect(pv).toHaveAccessibleName(/10 de 10/)
  await pv.click()
  await page.getByRole('textbox', { name: 'Quanto de PV' }).fill('4')
  await page.getByRole('button', { name: 'Perde' }).click()
  await expect(pv).toHaveAccessibleName(/6 de 10/)
  await page.getByRole('button', { name: 'Menos 1 PV' }).click()
  await expect(pv).toHaveAccessibleName(/5 de 10/)
  await pv.click()
  await page.getByRole('textbox', { name: 'Quanto de PV' }).fill('20')
  await page.getByRole('button', { name: 'Recupera' }).click()
  await expect(pv).toHaveAccessibleName(/10 de 10/)
  // CA é um valor da ficha, não uma barra de vida.
  await expect(page.getByRole('button', { name: /^Classe de armadura: / })).toHaveCount(0)
  await expect(page.locator('.sp-value')).toContainText('CA')
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
  await page.getByRole('button', { name: 'Tema da mesa' }).click()
  const temas = page.getByRole('dialog', { name: 'Tema da mesa' })
  await expect(temas.getByRole('radio', { name: /Pergaminho.*sugerido/ })).toHaveAttribute('aria-checked', 'true')
  await temas.getByRole('radio', { name: /^Abismo/ }).click()
  await expect(page.locator('body')).toHaveAttribute('data-mesa-tema', 'abismo')
  await temas.getByRole('button', { name: 'Fechar' }).click()
  // "Sem tema": as cores de sempre.
  await page.getByRole('button', { name: 'Tema da mesa' }).click()
  await temas.getByRole('radio', { name: /^Sem tema/ }).click()
  await expect(page.locator('body')).not.toHaveAttribute('data-mesa-tema', /.+/)
})

test('campanha de Tormenta: criar, montar a ficha e jogar com dado físico', async ({ page }) => {
  await page.goto('/app/')
  await page.getByRole('textbox', { name: 'Nome do novo universo' }).fill('Arton')
  await page.getByRole('radiogroup', { name: 'Começar como' }).getByRole('radio', { name: 'Campanha de RPG' }).click()
  await page.getByRole('radio', { name: 'Tormenta 20' }).click()
  await page.getByRole('button', { name: 'Criar universo' }).click()
  // O Início de uma campanha mostra a mesa primeiro.
  await page.getByRole('button', { name: 'Abrir a mesa' }).click()
  await expect(page.locator('.mesa-hero')).toContainText('Estilo Tormenta 20')
  await expect(page.locator('body')).toHaveAttribute('data-mesa-tema', 'tempestade')

  await page.getByRole('tab', { name: 'Personagens' }).click()
  await page.getByRole('textbox', { name: 'Nome do personagem' }).fill('Kaya')
  await page.getByRole('button', { name: 'Criar personagem' }).click()
  const modo = page.getByRole('group', { name: 'Modo da ficha de jogo' })
  await modo.getByRole('button', { name: 'Editar' }).click()
  await page.getByRole('textbox', { name: 'Raça' }).fill('Humana')
  await page.getByRole('textbox', { name: 'Classe e nível' }).fill('Guerreira 3')
  await page.getByRole('textbox', { name: 'Força', exact: true }).fill('3')
  await page.getByRole('textbox', { name: 'Valor de Luta' }).fill('4')
  await modo.getByRole('button', { name: 'Jogar' }).click()

  // Quem é, à vista; Defesa é um valor, não uma barra.
  await expect(page.locator('.sp-identity')).toHaveText('Humana · Guerreira 3')
  await expect(page.locator('.sp-value')).toContainText('DEF10')
  // Perícias treinadas com o total a somar no d20.
  await expect(page.getByRole('button', { name: /^Luta/ })).toContainText('+7')

  // Ataque com margem 19: no dado físico, 19 é crítico.
  await page.getByRole('button', { name: 'Ataque', exact: true }).click()
  const novo = page.getByRole('dialog', { name: 'Novo ataque' })
  await novo.getByRole('textbox', { name: 'Nome' }).fill('Espada longa')
  await novo.getByRole('textbox', { name: 'Bônus do teste' }).fill('7')
  await novo.getByRole('textbox', { name: 'Dano' }).fill('1d8+{FOR}')
  await novo.getByRole('textbox', { name: 'Crítico' }).fill('19/x2')
  await novo.getByRole('button', { name: 'Guardar ataque' }).click()
  await expect(page.getByRole('button', { name: /^Dano de Espada longa/ })).toContainText('1d8+3')
  await page.getByRole('button', { name: /^Teste de Espada longa/ }).click()
  const quanto = page.getByRole('dialog', { name: 'Quanto saiu no dado?' })
  await quanto.getByRole('spinbutton').fill('19')
  await expect(quanto.getByRole('status')).toContainText('Total 26')
  await expect(quanto.getByRole('status')).toContainText('Crítico')
  await quanto.getByRole('button', { name: 'Registrar' }).click()

  // Poder com custo: "Usar" desconta o PM.
  await page.getByRole('button', { name: 'Poder', exact: true }).click()
  const poder = page.getByRole('dialog', { name: 'Novo poder ou magia' })
  await poder.getByRole('textbox', { name: 'Nome' }).fill('Ataque Especial')
  await poder.getByRole('textbox', { name: /Custo/ }).fill('1')
  await poder.getByRole('button', { name: 'Guardar poder' }).click()
  await page.getByRole('button', { name: 'Usar Ataque Especial (1 PM)' }).click()
  await expect(page.getByRole('button', { name: /^Pontos de mana: / })).toHaveAccessibleName(/3 de 4/)

  // Inventário entende "3 tochas"; condições: só as ativas aparecem.
  await page.getByRole('textbox', { name: 'Novo item' }).fill('3 tochas')
  await page.keyboard.press('Enter')
  await expect(page.locator('.sp-item')).toContainText('tochas3')
  await page.getByRole('button', { name: 'Condição', exact: true }).click()
  await page.getByRole('dialog', { name: 'Condições' }).getByRole('button', { name: 'Abalado' }).click()
  await page.getByRole('dialog', { name: 'Condições' }).getByRole('button', { name: 'Fechar' }).click()
  await expect(page.getByRole('button', { name: 'Tirar a condição Abalado' })).toBeVisible()
})

test('o jogador vê a ficha completa no Codex, só para consultar', async ({ page, context, baseURL }) => {
  const SERVER = 'https://papirus-teste.supabase.co'
  const store = new Map<string, { data: unknown; updated_at: string }>()
  await context.route(`${SERVER}/rest/v1/rpc/*`, async (route) => {
    const fn = route.request().url().split('/rpc/')[1].split('?')[0]
    const body = route.request().postDataJSON() as Record<string, string>
    const json = (data: unknown) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(data), headers: { 'access-control-allow-origin': '*' } })
    if (fn === 'codex_put') {
      const updated_at = new Date().toISOString()
      store.set(body.codex_id, { data: body.codex_data, updated_at })
      return json(updated_at)
    }
    const row = store.get(body.codex_id)
    return json(fn === 'codex_get' && row ? [row] : [])
  })
  await context.route(`${SERVER}/realtime/**`, (route) => route.abort())

  await page.goto('/app/?exemplo=ostria')
  await expect(page.getByRole('button', { name: 'Continuar escrevendo' })).toBeVisible()
  await nav(page, 'Ajustes e dados').click()
  await page.getByRole('navigation', { name: 'Categorias dos ajustes' }).getByRole('button', { name: /Conta/ }).click()
  await page.getByRole('textbox', { name: 'Endereço do projeto' }).fill(SERVER)
  await page.getByRole('textbox', { name: 'Chave pública (anon key)' }).fill('eyJ.chave-de-teste')
  await page.getByRole('textbox', { name: 'Endereço público do Papirus' }).fill(baseURL + '/')
  await nav(page, 'RPG').click()
  // A Brisa leva dano e ganha um item antes de o mestre compartilhar.
  await page.getByRole('tab', { name: 'Personagens' }).click()
  await page.locator('.entity-row-name', { hasText: /^Brisa$/ }).click()
  await page.getByRole('button', { name: 'Menos 1 PV' }).click()
  await page.getByRole('textbox', { name: 'Novo item' }).fill('2 poções')
  await page.keyboard.press('Enter')
  await page.getByRole('tab', { name: 'Revelações e Codex' }).click()
  await page.getByRole('button', { name: 'Compartilhar ao vivo' }).click()
  const link = await page.getByRole('textbox', { name: 'Link para os jogadores' }).inputValue()

  const player = await context.newPage()
  await player.goto(link)
  const brisa = player.locator('.codex-pc', { hasText: 'Brisa' })
  await expect(brisa).toContainText('PV 21/22')
  await brisa.getByText('Ficha completa').click()
  await expect(brisa).toContainText('2 × poções')
  // Só consulta: nada de botões de mudar a ficha.
  await expect(brisa.getByRole('button')).toHaveCount(0)
})
