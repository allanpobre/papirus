import AxeBuilder from '@axe-core/playwright'
import { runPageTour } from './pageTour.ts'
import { expect, test, type Page } from './fixtures.ts'

const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: new RegExp(`^${name}`) }).first()
const spotted = (steps: { spot: boolean }[]) => steps.filter((s) => s.spot).length

test('cada área do universo tem o seu (?), que destaca as partes da tela', async ({ page }) => {
  test.setTimeout(180_000)
  await page.goto('/app/?exemplo=ostria')
  await expect(page.getByRole('button', { name: 'Continuar escrevendo' })).toBeVisible()

  // O balão é acessível, o Esc fecha e o foco volta para o (?).
  await page.getByRole('button', { name: 'Como usar: Início' }).click()
  const card = page.locator('.page-tour .tour-card')
  await expect(card).toContainText('Início · 1 de')
  const { violations } = await new AxeBuilder({ page }).include('.page-tour .tour-card').analyze()
  expect(violations.map((v) => v.id)).toEqual([])
  await page.keyboard.press('ArrowRight')
  await expect(card).toContainText('Início · 2 de')
  await page.keyboard.press('Escape')
  await expect(page.locator('.page-tour')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Como usar: Início' })).toBeFocused()

  const areas: [string, string][] = [
    ['Início', 'Início'],
    ['Escrever', 'Escrever'],
    ['Estrutura', 'Estrutura'],
    ['Livro', 'Livro'],
    ['Fichas', 'Fichas'],
    ['Relações', 'Relações'],
    ['Linha do tempo', 'Linha do tempo'],
    ['Atlas', 'Atlas'],
    ['Pistas e mistérios', 'Pistas e mistérios'],
    ['Quem sabe o quê', 'Quem sabe o quê'],
    ['Ideias', 'Ideias'],
    ['Perguntar ao mundo', 'Perguntar ao mundo'],
    ['Ajustes e dados', 'Ajustes'],
  ]
  for (const [area, title] of areas) {
    await nav(page, area).click()
    expect(spotted(await runPageTour(page, title)), title).toBeGreaterThan(0)
  }

  // O tour do Escrever explica onde ficam os nomes novos.
  await nav(page, 'Escrever').click()
  await page.getByRole('button', { name: 'Como usar: Escrever' }).click()
  for (let i = 0; i < 6 && !(await card.getByRole('heading', { name: 'Nomes novos' }).count()); i++) await card.getByRole('button', { name: 'Próximo' }).click()
  await expect(card).toContainText('o botão Revisar mostra “1 nome novo”')
  await expect(page.locator('.page-tour .tour-spot')).toBeVisible()
  await page.keyboard.press('Escape')

  // Na mesa, cada aba tem o seu tour.
  await nav(page, 'RPG').click()
  for (const [tab, title] of [
    ['Painel do mestre', 'Painel do mestre'],
    ['Sessões', 'Sessões'],
    ['Personagens', 'Personagens'],
    ['Revelações e Codex', 'Revelações e Codex'],
    ['Dados e tabelas', 'Dados e tabelas'],
    ['Sistemas', 'Sistemas'],
  ]) {
    await page.getByRole('tab', { name: tab }).click()
    expect(spotted(await runPageTour(page, title)), title).toBeGreaterThan(0)
  }
  // Em combate, o tour da mesa mostra a iniciativa e a vez.
  await page.getByRole('tab', { name: 'Painel do mestre' }).click()
  await page.getByRole('button', { name: 'Começar agora' }).click()
  await page.getByRole('button', { name: 'Começar a jogar' }).click()
  await page.getByRole('button', { name: 'Combate!' }).click()
  // Com a sessão começada, o app vira o modo sessão, e o (?) explica a mesa inteira.
  const sessao = await runPageTour(page, 'Modo sessão')
  expect(sessao.filter((s) => s.spot).map((s) => s.title)).toEqual(
    expect.arrayContaining(['A sessão ao vivo', 'Tempo de jogo', 'Pedir teste', 'Anunciar', 'Combate', 'Grupo', 'Segredos', 'Dados e tabelas', 'Registro e preparação', 'Mais']),
  )
})

test('fora do universo: setores, Oficina, treino, leitor e diagramação têm o seu (?)', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/app/')
  const setores = page.getByRole('navigation', { name: 'Setores' })
  await runPageTour(page, 'Escrita')
  await setores.getByRole('button', { name: 'RPG' }).click()
  await runPageTour(page, 'RPG')
  await setores.getByRole('button', { name: 'Oficina' }).click()
  await runPageTour(page, 'Oficina')

  // Um guia da Oficina tem o tour dele.
  await page.locator('.oficina-genres button').first().click()
  await expect(page.getByRole('dialog', { name: 'Oficina' })).toBeVisible()
  await runPageTour(page, 'Guia')
  await page.getByRole('button', { name: 'Fechar a Oficina' }).click()

  // O treino explica a preparação.
  await setores.getByRole('button', { name: 'Escrita' }).click()
  await page.getByRole('button', { name: 'Começar o treino' }).click()
  await runPageTour(page, 'Treino')
  // Depois do treino, o resultado também explica.
  await page.locator('.treino-go').click()
  await page.getByRole('textbox', { name: 'Texto do treino' }).fill('Era uma vez um farol que não acendia.')
  await page.getByRole('button', { name: 'Terminar' }).click()
  await runPageTour(page, 'Resultado do treino')
  await page.getByRole('button', { name: 'Fechar o treino' }).click()

  // O modo leitor e a diagramação do livro.
  await page.goto('/app/?exemplo=ostria')
  await page.getByRole('button', { name: 'Ler como leitor' }).click()
  await runPageTour(page, 'Modo leitor')
  await page.keyboard.press('Escape')
  await nav(page, 'Livro').click()
  await page.getByRole('button', { name: /^(Diagramar e gerar PDF|Criar o livro)$/ }).click()
  await runPageTour(page, 'Diagramar')
})

test('no celular, o (?) também cabe e o balão não sai da tela', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/app/?exemplo=ostria')
  await expect(page.getByRole('button', { name: 'Continuar escrevendo' })).toBeVisible()
  await runPageTour(page, 'Início')
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Escrever' }).click()
  const steps = await runPageTour(page, 'Escrever')
  // A margem fica fechada no celular: o passo dos nomes novos aponta o botão que a abre.
  expect(steps.find((s) => s.title === 'Nomes novos')?.spot).toBe(true)
})

test('as janelas que funcionam como tela também têm o (?)', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/app/?exemplo=ostria')
  await expect(page.getByRole('button', { name: 'Continuar escrevendo' })).toBeVisible()

  // Escrever: a Revisão (nomes novos) e as versões da cena.
  await nav(page, 'Escrever').click()
  await page.getByRole('complementary', { name: 'Margem viva' }).getByRole('button', { name: /Revisar/ }).click()
  // As abas da Revisão aparecem inteiras, mesmo com a lista comprida.
  const perguntas = page.getByRole('dialog', { name: 'Revisão' }).getByRole('tab', { name: /^Perguntas/ })
  expect((await perguntas.boundingBox())!.height).toBeGreaterThan(24)
  const revisao = await runPageTour(page, 'Revisão')
  expect(revisao.filter((s) => s.spot).map((s) => s.title)).toEqual(expect.arrayContaining(['Três listas', 'Onde procurar']))
  await page.getByRole('dialog', { name: 'Revisão' }).getByRole('button', { name: 'Fechar' }).click()
  await page.getByRole('button', { name: 'Mais ações da cena' }).click()
  await page.getByRole('group', { name: 'Mais ações da cena' }).getByRole('button', { name: 'Versões da cena' }).click()
  await runPageTour(page, 'Versões')

  // A tecla Esc do tour fecha só o tour, não a janela por baixo.
  await page.getByRole('button', { name: 'Como usar: Versões' }).click()
  await expect(page.locator('.page-tour')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(page.locator('.page-tour')).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: /^Versões/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Como usar: Versões' })).toBeFocused()
  await page.getByRole('dialog', { name: /^Versões/ }).getByRole('button', { name: 'Fechar' }).click()

  // O livro revisado, o placar, os treinos e as medalhas.
  await nav(page, 'Livro').click()
  await page.getByRole('button', { name: 'Criar o livro' }).click()
  await page.getByRole('dialog', { name: 'Diagramar o livro' }).getByRole('button', { name: 'Fechar' }).click()
  await page.getByRole('button', { name: 'Revisar' }).click()
  await runPageTour(page, 'Revisar o livro')
  await page.getByRole('dialog', { name: /^Revisar/ }).getByRole('button', { name: 'Fechar' }).click()

  await nav(page, 'Início').click()
  await page.getByRole('region', { name: 'Treino de hoje' }).getByRole('button', { name: 'Placar' }).click()
  await runPageTour(page, 'Placar')
  await page.getByRole('dialog', { name: 'Placar dos treinos' }).getByRole('button', { name: 'Fechar' }).click()
  await page.getByRole('region', { name: 'Treino de hoje' }).getByRole('button', { name: /Seus treinos/ }).click()
  await runPageTour(page, 'Seus treinos')
  await page.getByRole('dialog', { name: 'Seus treinos' }).getByRole('button', { name: 'Fechar' }).click()
  await page.getByRole('button', { name: /^Medalhas:/ }).click()
  await runPageTour(page, 'Medalhas')
  await page.getByRole('dialog', { name: 'Medalhas' }).getByRole('button', { name: 'Fechar' }).click()

  // Na mesa, a janela do dado de verdade.
  await nav(page, 'RPG').click()
  await page.getByRole('tab', { name: 'Personagens' }).click()
  await page.locator('.entity-row-name', { hasText: /^Brisa$/ }).click()
  await page.getByRole('button', { name: /^Rolar Destreza/ }).click()
  const dado = page.getByRole('dialog', { name: 'Quanto saiu no dado?' })
  const passos = await runPageTour(page, 'Dado de verdade')
  expect(passos.every((p) => p.spot)).toBe(true)
  await dado.getByRole('button', { name: 'Fechar' }).click()

  // Entrar (a conta é opcional).
  await page.goto('/app/')
  await page.getByRole('button', { name: /Entrar/ }).first().click()
  await runPageTour(page, 'Entrar')
})

test('a página em branco do Escrever também explica', async ({ page }) => {
  await page.goto('/app/')
  await page.getByRole('textbox', { name: 'Nome do novo universo' }).fill('Novo')
  await page.getByRole('button', { name: 'Criar universo' }).click()
  await nav(page, 'Escrever').click()
  await expect(page.getByRole('heading', { name: 'Uma página em branco.' })).toBeVisible()
  const steps = await runPageTour(page, 'Escrever')
  expect(steps[0]).toEqual({ title: 'A primeira cena', spot: true })
})

test('Atlas com mapa e Estrutura em cada aba: o (?) explica o que está na tela', async ({ page }) => {
  await page.goto('/app/')
  await page.getByRole('button', { name: 'Abrir um universo de exemplo' }).click()
  await expect(page.getByRole('navigation', { name: 'Áreas' })).toBeVisible()

  await nav(page, 'Atlas').click()
  await expect(page.locator('.atlas-scroll')).toBeVisible()
  const atlas = await runPageTour(page, 'Atlas')
  expect(atlas.filter((s) => s.spot).map((s) => s.title)).toEqual(['Mapas', 'Marcar lugares', 'Caminho de', 'O mapa'])

  await nav(page, 'Estrutura').click()
  const abas: [string, string][] = [
    ['Quadro de cenas', 'Quadro de cenas'],
    ['Presença', 'Presença'],
    ['Ritmo', 'Ritmo'],
  ]
  for (const [aba, passo] of abas) {
    await page.getByRole('tab', { name: aba }).click()
    const steps = await runPageTour(page, 'Estrutura')
    expect(steps.filter((s) => s.spot).map((s) => s.title), aba).toEqual(['Três jeitos de ver', passo])
  }
})
