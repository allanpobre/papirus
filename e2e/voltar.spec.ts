import { expect, test, type Page } from './fixtures.ts'

/** Celular: o "voltar" do Android é o voltar do navegador. */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

const h1 = (page: Page) => page.locator('main h1').first()
const fichas = (page: Page) => page.getByRole('navigation', { name: 'O seu mundo' }).getByRole('button', { name: /^Fichas/ })

test('voltar do aparelho: telas, ficha aberta e lista, sem sair do app', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await expect(page.getByRole('button', { name: 'Continuar escrevendo' })).toBeVisible()

  await fichas(page).click()
  await expect(h1(page)).toHaveText('Fichas')
  await page.locator('.entity-row-name', { hasText: /^Kael$/ }).click()
  await expect(page.getByRole('textbox', { name: 'Nome', exact: true })).toHaveValue('Kael')

  // Voltar: da ficha para a lista; da lista para o Início. O app continua aberto.
  await page.goBack()
  await expect(page.getByRole('textbox', { name: 'Nome', exact: true })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Lista de fichas' })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('button', { name: 'Continuar escrevendo' })).toBeVisible()

  // Avançar também funciona (navegador).
  await page.goForward()
  await expect(h1(page)).toHaveText('Fichas')

  // A seta do próprio app volta de verdade: depois dela, "voltar" vai para o Início, e não de novo para a ficha.
  await page.locator('.entity-row-name', { hasText: /^Mira$/ }).click()
  await page.getByRole('button', { name: 'Voltar para a lista' }).click()
  await expect(page.getByRole('region', { name: 'Lista de fichas' })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('button', { name: 'Continuar escrevendo' })).toBeVisible()
})

test('voltar do aparelho fecha a janela de cima antes de sair da tela', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await expect(page.getByRole('button', { name: 'Continuar escrevendo' })).toBeVisible()
  await fichas(page).click()
  await expect(h1(page)).toHaveText('Fichas')

  // A folha "Mais" do celular.
  await page.getByRole('button', { name: 'Mais', exact: true }).click()
  await expect(page.getByRole('group', { name: 'Todas as áreas' })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('group', { name: 'Todas as áreas' })).toHaveCount(0)
  await expect(h1(page)).toHaveText('Fichas')

  // Busca: voltar fecha a busca e fica nas Fichas.
  await page.getByRole('button', { name: 'Buscar' }).first().click()
  await expect(page.getByRole('dialog', { name: 'Buscar' })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('dialog', { name: 'Buscar' })).toHaveCount(0)
  await expect(h1(page)).toHaveText('Fichas')

  // Fechar pelo X não deixa passo sobrando: o próximo "voltar" já vai para o Início.
  await page.getByRole('button', { name: 'Buscar' }).first().click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Buscar' })).toHaveCount(0)
  await page.goBack()
  await expect(page.getByRole('button', { name: 'Continuar escrevendo' })).toBeVisible()

  // Escolher um resultado da busca leva à ficha; "voltar" volta para onde estava.
  await page.getByRole('button', { name: 'Buscar' }).first().click()
  await page.getByRole('combobox', { name: 'Buscar no universo' }).fill('Mira')
  await page.getByRole('option', { name: /Mira/ }).first().click()
  await expect(page.getByRole('textbox', { name: 'Nome', exact: true })).toHaveValue('Mira')
  await page.goBack()
  await expect(page.getByRole('button', { name: 'Continuar escrevendo' })).toBeVisible()
})

test('voltar entre a lista de universos e o universo, e reabrir no mesmo lugar', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await expect(page.getByRole('button', { name: 'Continuar escrevendo' })).toBeVisible()
  await page.getByRole('button', { name: 'Seus universos' }).click()
  await expect(page.getByRole('heading', { name: 'Seus universos' })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('button', { name: 'Continuar escrevendo' })).toBeVisible()

  // O Android fecha o app em segundo plano: ao reabrir, a mesma ficha está aberta.
  await fichas(page).click()
  await page.locator('.entity-row-name', { hasText: /^Ilsa$/ }).click()
  await expect(page.getByRole('textbox', { name: 'Nome', exact: true })).toHaveValue('Ilsa')
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Nome', exact: true })).toHaveValue('Ilsa')
  // E o "voltar" continua sabendo o caminho.
  await page.goBack()
  await expect(page.getByRole('region', { name: 'Lista de fichas' })).toBeVisible()
})

test('uma sequência longa de "voltar" refaz o caminho, e a cena aberta volta depois de recarregar', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await expect(page.getByRole('button', { name: 'Continuar escrevendo' })).toBeVisible()
  await fichas(page).click()
  await page.locator('.entity-row-name', { hasText: /^Kael$/ }).click()
  await page.getByRole('button', { name: 'Mais', exact: true }).click()
  await page.getByRole('group', { name: 'Todas as áreas' }).getByRole('button', { name: /^Linha do tempo/ }).click()
  await expect(h1(page)).toHaveText('Linha do tempo')
  await page.goBack()
  await expect(page.getByRole('textbox', { name: 'Nome', exact: true })).toHaveValue('Kael')
  await page.goBack()
  await expect(page.getByRole('region', { name: 'Lista de fichas' })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('button', { name: 'Continuar escrevendo' })).toBeVisible()

  // Escrevendo numa cena: recarregar (como quando o Android fecha o app) abre a mesma cena.
  await page.getByRole('button', { name: 'Continuar escrevendo' }).click()
  const title = await page.getByRole('textbox', { name: 'Título da cena' }).inputValue()
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Título da cena' })).toHaveValue(title)
  await page.goBack()
  await expect(page.getByRole('button', { name: 'Continuar escrevendo' })).toBeVisible()
})
