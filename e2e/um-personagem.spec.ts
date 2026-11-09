import { expect, test, type Page } from './fixtures.ts'
import { openPart } from './areas.ts'

const nav = (page: Page, name: RegExp) => page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name }).first()

async function newCampaign(page: Page, name = 'Sombras de Ostria') {
  await page.goto('/app/')
  await page.getByRole('navigation', { name: 'Setores' }).getByRole('button', { name: 'Mesa' }).click()
  await page.getByRole('textbox', { name: 'Nome da campanha' }).fill(name)
  await page.getByRole('button', { name: 'Criar campanha' }).click()
  await expect(page.getByRole('tablist', { name: 'Partes da Mesa' })).toBeVisible()
}

test('um personagem só: a Kaya criada na Mesa está no Mundo, com a aba Jogo', async ({ page }) => {
  await newCampaign(page)
  await page.getByRole('tab', { name: 'Grupo', exact: true }).click()
  await page.getByRole('textbox', { name: 'Nome do personagem' }).fill('Kaya')
  await page.getByRole('textbox', { name: 'Quem joga' }).fill('Ana')
  await page.getByRole('button', { name: 'Criar personagem' }).click()

  // No Mundo, a Kaya já existe, com a ficha de jogo na aba Jogo.
  await nav(page, /^Mundo/).click()
  await page.locator('.entity-row-name', { hasText: /^Kaya$/ }).click()
  await page.getByRole('group', { name: 'Modo da ficha' }).getByRole('button', { name: 'Jogo' }).click()
  const jogo = page.getByRole('region', { name: 'Ficha de jogo de Kaya' })
  await expect(jogo).toContainText('Personagem de jogador · joga Ana')
  await expect(jogo.getByRole('list', { name: 'Recursos' })).toBeVisible()

  // "Abrir na Mesa" leva para o Grupo, com a ficha dela aberta.
  await jogo.getByRole('button', { name: 'Abrir na Mesa' }).click()
  await expect(page.getByRole('tab', { name: 'Grupo', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('region', { name: 'Personagens da mesa' }).locator('[aria-current="true"]')).toContainText('Kaya')
})

test('fim da sessão: "O que aconteceu?" vai para a Linha do tempo e para o "Aparece em" da ficha', async ({ page }) => {
  await newCampaign(page)
  await page.getByRole('tab', { name: 'Grupo', exact: true }).click()
  await page.getByRole('textbox', { name: 'Nome do personagem' }).fill('Kaya')
  await page.getByRole('textbox', { name: 'Quem joga' }).fill('Ana')
  await page.getByRole('button', { name: 'Criar personagem' }).click()
  await nav(page, /^Mundo/).click()
  await page.getByRole('textbox', { name: 'Nome da nova ficha' }).fill('Brenn')
  await page.keyboard.press('Enter')

  // Joga e encerra a sessão 1.
  await nav(page, /^Mesa/).click()
  await page.getByRole('tab', { name: 'Preparar' }).click()
  await page.getByRole('tab', { name: 'Painel', exact: true }).click()
  await page.getByRole('button', { name: 'Começar agora' }).click()
  await page.getByRole('button', { name: 'Começar a jogar' }).click()
  await page.getByRole('button', { name: 'Encerrar sessão', exact: true }).click()
  await page.getByRole('group', { name: 'Encerrar a sessão?' }).getByRole('button', { name: 'Encerrar' }).click()
  const fim = page.getByRole('dialog', { name: 'Fim da sessão' })
  await expect(fim.getByRole('heading', { name: 'O que aconteceu?' })).toBeVisible()
  await fim.getByRole('textbox', { name: 'Resumo da sessão' }).fill('Kaya enfrentou Brenn no cais.')
  await fim.getByRole('textbox', { name: 'Ano no mundo' }).fill('1342')
  await fim.getByRole('button', { name: 'Fechar' }).click()

  // Na Linha do tempo, a sessão entra no ano do mundo, com o resumo.
  await openPart(page, 'Linha do tempo')
  const sessao = page.locator('.tl-session')
  await expect(sessao).toContainText('Sessão 1')
  await expect(sessao).toContainText('Kaya enfrentou Brenn no cais.')

  // Nas fichas, "Aparece em" mostra a sessão: a Kaya jogou; o Brenn está no resumo.
  await openPart(page, 'Fichas')
  await page.locator('.entity-row-name', { hasText: /^Brenn$/ }).click()
  await page.getByRole('group', { name: 'Modo da ficha' }).getByRole('button', { name: 'Ler' }).click()
  await expect(page.getByRole('list', { name: 'Sessões' })).toContainText('Sessão 1 no resumo')
  await page.locator('.entity-row-name', { hasText: /^Kaya$/ }).click()
  await expect(page.getByRole('list', { name: 'Sessões' })).toContainText('Sessão 1 jogou · no resumo')
})

test('jogar neste mundo: um livro sem Mesa ganha um caminho até ela, também em Seus universos', async ({ page }) => {
  await page.goto('/app/')
  await page.getByRole('textbox', { name: 'Nome do novo universo' }).fill('Maré Baixa')
  await page.getByRole('button', { name: 'Criar universo' }).click()
  const areas = page.getByRole('navigation', { name: 'Áreas' })
  await expect(areas.getByRole('button', { name: /^Mesa/ })).toHaveCount(0)

  // Em Seus universos, na aba Mesa, o livro aparece para jogar.
  await page.getByRole('button', { name: /trocar de universo/ }).click()
  await page.getByRole('navigation', { name: 'Setores' }).getByRole('button', { name: 'Mesa' }).click()
  await expect(page.getByRole('list', { name: 'Livros para jogar' })).toContainText('Maré Baixa')
  await page.getByRole('list', { name: 'Livros para jogar' }).getByRole('button', { name: /Maré Baixa/ }).click()
  await expect(page.locator('main .empty-title')).toHaveText('Jogar neste mundo')
  await nav(page, /^Início/).click()

  // No menu do livro, "Jogar neste mundo" abre a Mesa vazia; criado o grupo, a Mesa entra no menu.
  await areas.getByRole('button', { name: 'Jogar neste mundo' }).click()
  await page.getByRole('textbox', { name: 'Nome do grupo' }).fill('Grupo de sexta')
  await page.getByRole('button', { name: 'Criar grupo' }).click()
  await expect(page.getByRole('tablist', { name: 'Partes da Mesa' })).toBeVisible()
  await expect(areas.getByRole('button', { name: /^Mesa/ })).toBeVisible()
  await nav(page, /^Início/).click()
  await expect(areas.getByRole('button', { name: 'Jogar neste mundo' })).toHaveCount(0)
})

test('as espécies do Mundo viram inimigos prontos com um toque', async ({ page }) => {
  await newCampaign(page)
  await nav(page, /^Mundo/).click()
  await page.getByLabel('Tipo da nova ficha').selectOption({ label: 'Espécie' })
  await page.getByRole('textbox', { name: 'Nome da nova ficha' }).fill('Lobo cinzento')
  await page.keyboard.press('Enter')
  await nav(page, /^Mesa/).click()
  await page.getByRole('tab', { name: 'Regras' }).click()
  await page.getByRole('tab', { name: 'Dados e tabelas', exact: true }).click()
  const bestiario = page.getByRole('region', { name: 'Inimigos prontos' })
  await bestiario.getByRole('button', { name: 'Lobo cinzento' }).click()
  await expect(bestiario.locator('.bestiary-row', { hasText: 'Lobo cinzento' })).toBeVisible()
  // Já no bestiário: sai da lista "Do Mundo".
  await expect(bestiario.locator('.bestiary-world')).toHaveCount(0)
})
