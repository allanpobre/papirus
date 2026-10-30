import { openPart } from './areas.ts'
import { expect, test, type Page } from './fixtures.ts'

const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: new RegExp(`^${name}`) }).first()

test('o Mundo: as partes no alto, a ficha abre para ler com o mapa, e a lista mostra o que a história usa', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('papirus:ficha-modo', 'ler'))
  await page.goto('/app/?exemplo=ostria')
  await nav(page, 'Mundo').click()
  const parts = page.getByRole('navigation', { name: 'Partes do mundo' })
  await expect(parts.getByRole('button')).toHaveText(['Fichas', 'Ligações', 'Linha do tempo', 'Atlas'])
  await expect(parts.getByRole('button', { name: 'Fichas' })).toHaveAttribute('aria-current', 'page')

  // Sem ficha aberta: o mundo em resumo, com o que está só nas notas.
  const overview = page.getByRole('region', { name: 'O mundo em resumo' })
  await expect(overview).toContainText('Mais presentes nas cenas')
  await expect(overview.getByRole('button', { name: 'Casa de Vaelor' })).toBeVisible()

  // Na lista, em quantas cenas; e o filtro "só nas notas".
  const kael = page.locator('.entity-row').filter({ has: page.locator('.entity-row-name', { hasText: /^Kael$/ }) })
  await expect(kael).toContainText('5 cenas')
  await page.getByRole('group', { name: 'Onde aparece' }).getByRole('button', { name: /Só nas notas/ }).click()
  await expect(page.locator('.entity-row-name')).toHaveText(['Casa de Vaelor', 'Lâmina de vidro negro', 'Reino de Ostria'])
  await page.getByRole('group', { name: 'Onde aparece' }).getByRole('button', { name: /Só nas notas/ }).click()

  // A ficha abre para ler, com o caminho no mapa; o mapa leva ao Atlas.
  await kael.click()
  const reader = page.getByRole('article', { name: 'Ler a ficha Kael' })
  await expect(reader).toContainText('O caminho de Kael pelas cenas: Ostria, Vale das Brumas, Ostria, Taverna do Anzol, Torre de Marfim')
  await reader.getByRole('button', { name: 'Abrir “Reino de Ostria” no Atlas' }).click()
  await expect(parts.getByRole('button', { name: 'Atlas' })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('button', { name: /^Torre de Marfim/ })).toBeVisible()

  // Na linha do tempo, a idade de cada um no evento.
  await parts.getByRole('button', { name: 'Linha do tempo' }).click()
  await expect(page.locator('.tl-card').filter({ hasText: 'A Queda' })).toContainText('Vaelor (31 anos)')
})

test('ficha nova abre em Editar com perguntas do tipo dela, em palavras simples', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('papirus:ficha-modo', 'ler'))
  await page.goto('/app/?exemplo=ostria')
  await nav(page, 'Mundo').click()
  await page.getByRole('textbox', { name: 'Nome da nova ficha' }).fill('Sal Negro')
  await page.getByRole('combobox', { name: 'Tipo da nova ficha' }).selectOption('magia')
  await page.getByRole('button', { name: 'Criar ficha' }).click()

  // Recém-criada: Editar, com o tipo pelo nome e "é verdade?" em vez de canon.
  await expect(page.getByRole('textbox', { name: 'Nome', exact: true })).toHaveValue('Sal Negro')
  await expect(page.getByRole('combobox', { name: 'Tipo', exact: true })).toHaveValue('magia')
  await expect(page.getByRole('combobox', { name: 'Tipo', exact: true }).locator('option:checked')).toHaveText('Sistema de magia')
  await expect(page.getByRole('combobox', { name: 'É verdade no mundo?' }).locator('option:checked')).toHaveText('Verdade')
  await expect(page.getByRole('combobox', { name: 'Quão pronta' }).locator('option:checked')).toHaveText('Rascunho')

  // As perguntas começam pelo custo; a resposta vira campo.
  const questions = page.getByRole('region', { name: 'Para começar' })
  await expect(questions.locator('.kind-question-ask').first()).toHaveText('Quanto custa usar? O que se perde?')
  await questions.getByRole('textbox', { name: 'Quanto custa usar? O que se perde?' }).fill('Um dia de memória')

  // Em Ler, o campo aparece no quadro.
  await page.getByRole('group', { name: 'Modo da ficha' }).getByRole('button', { name: 'Ler' }).click()
  await expect(page.getByRole('complementary', { name: 'Em resumo' })).toContainText('Um dia de memória')

  // Um tipo próprio pelo "Outro…".
  await page.getByRole('group', { name: 'Modo da ficha' }).getByRole('button', { name: 'Editar' }).click()
  await page.getByRole('combobox', { name: 'Tipo', exact: true }).selectOption('__outro')
  await page.getByRole('textbox', { name: 'Tipo', exact: true }).fill('Maldição')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('combobox', { name: 'Tipo', exact: true })).toHaveValue('Maldição')

  // Ficha vazia vinda de outro lugar abre em Ler e convida a responder.
  await page.getByRole('textbox', { name: 'Nome da nova ficha' }).fill('Porto Velho')
  await page.getByRole('combobox', { name: 'Tipo da nova ficha' }).selectOption('lugar')
  await page.getByRole('button', { name: 'Criar ficha' }).click()
  await page.getByRole('region', { name: 'Para começar' }).getByRole('button', { name: 'Pular' }).click()
  await expect(page.getByRole('region', { name: 'Para começar' })).toHaveCount(0)
  await page.getByRole('group', { name: 'Modo da ficha' }).getByRole('button', { name: 'Ler' }).click()
  await expect(page.getByText('Ficha em branco. 4 perguntas sobre lugar ajudam a começar.')).toBeVisible()
})

test('Quem sabe o quê em frases: verdade, segredo, quem sabe e o que o leitor viu', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await openPart(page, 'Quem sabe o quê')
  const secret = page.locator('.fact-card').filter({ hasText: 'Vaelor sobreviveu à Queda.' })
  await expect(secret).toContainText('É verdade, mas é segredo.')
  await expect(secret.locator('.fact-who')).toContainText('Ilsa sabe')
  await expect(secret.locator('.fact-who')).toContainText('o leitor ainda não')
  const eyes = page.locator('.fact-card').filter({ hasText: 'Vaelor tem olhos cinzentos.' })
  await expect(eyes).toContainText('Mira disse em A chegada.')
  await expect(eyes.locator('.fact-who')).toContainText('o leitor viu')
  // "É verdade?" filtra pelas palavras simples.
  await page.getByRole('combobox', { name: 'É verdade?' }).selectOption({ label: 'Segredo' })
  await expect(page.locator('.fact-card').filter({ hasText: 'Vaelor tem olhos cinzentos.' })).toHaveCount(0)
})

test.describe('no celular', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('Ligações: o grafo vem primeiro e os filtros ficam no botão; a ficha aberta mostra o nome inteiro', async ({ page }) => {
    await page.goto('/app/?exemplo=ostria')
    await openPart(page, 'Ligações')
    await expect(page.locator('.graph-wrap')).toBeVisible()
    await expect(page.getByRole('checkbox', { name: 'Incluir “fica em”' })).toBeHidden()
    await page.getByRole('button', { name: 'Filtros' }).click()
    await expect(page.getByRole('checkbox', { name: 'Incluir “fica em”' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)

    // A ficha em Editar: o nome inteiro, com os botões numa linha só em cima.
    await page.locator('[data-tour="partes"]').getByRole('button', { name: 'Fichas' }).click()
    await page.locator('.entity-row-name', { hasText: /^Homem Pálido$/ }).click()
    const name = page.getByRole('textbox', { name: 'Nome', exact: true })
    await expect(name).toHaveValue('Homem Pálido')
    expect((await name.boundingBox())!.width).toBeGreaterThan(200)
    // A ficha aberta ocupa a tela: as partes saem até voltar para a lista.
    await expect(page.locator('[data-tour="partes"]')).toBeHidden()
    await page.getByRole('button', { name: 'Voltar para a lista' }).click()
    await expect(page.locator('[data-tour="partes"]')).toBeVisible()
  })
})
