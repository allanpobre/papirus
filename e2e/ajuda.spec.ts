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
    ['Na mesa', 'Na mesa'],
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
  await page.getByRole('tab', { name: 'Na mesa' }).click()
  await page.getByRole('button', { name: /^Começar/ }).click()
  await page.getByRole('button', { name: 'Adicionar os jogadores da mesa' }).click()
  const combate = await runPageTour(page, 'Na mesa')
  expect(combate.filter((s) => s.spot).map((s) => s.title)).toEqual(expect.arrayContaining(['Iniciativa', 'A vez', 'Grupo', 'Dados e tabelas', 'Registro']))
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
