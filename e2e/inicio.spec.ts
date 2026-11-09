import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from './fixtures.ts'

const next = (page: Page) => page.getByRole('region', { name: 'O próximo passo' })

test('o próximo passo: a última frase, o bilhete para amanhã e 15 minutos', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await expect(next(page).getByRole('heading', { name: 'A chegada' })).toBeVisible()
  await expect(next(page)).toContainText('impossível ver os olhos de alguém naquela neblina')
  const note = next(page).getByRole('note', { name: 'Bilhete para amanhã' })
  await expect(note).toContainText('Seu bilhete: Kael segue o estranho até a taverna')

  // Mudar o bilhete no próprio Início; Enter guarda.
  await note.getByRole('button', { name: 'Mudar o bilhete' }).click()
  await next(page).getByRole('textbox', { name: 'Bilhete para amanhã' }).fill('Kael sobe no navio e acha a bolsa de moedas.')
  await page.keyboard.press('Enter')
  await expect(note).toContainText('Kael sobe no navio e acha a bolsa de moedas.')

  // Na cena, o bilhete fica no fim do texto; apagado, volta o convite.
  await next(page).getByRole('button', { name: 'Continuar escrevendo' }).click()
  const inScene = page.getByRole('note', { name: 'Bilhete para amanhã' })
  await expect(inScene).toContainText('Bilhete para amanhã: Kael sobe no navio')
  await inScene.getByRole('button', { name: 'Apagar o bilhete' }).click()
  await expect(page.getByRole('button', { name: 'Deixar um bilhete para amanhã' })).toBeVisible()

  // 15 minutos: um sprint na cena, com o relógio no rodapé.
  await page
    .getByRole('navigation', { name: 'Áreas' })
    .getByRole('button', { name: /^Início/ })
    .click()
  await expect(next(page).getByRole('note')).toHaveCount(0)
  await next(page).getByRole('button', { name: '15 minutos' }).click()
  await expect(page.getByRole('timer', { name: /^Sprint: faltam 1[45]:/ })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Título da cena' })).toHaveValue('A chegada')
})

test('para quando der: até três coisas, sem cobrar rascunhos nem pistas abertas', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  const later = page.getByRole('region', { name: 'Para quando der' })
  await expect(later.getByRole('listitem')).toHaveCount(3)
  await expect(later).toContainText('5 perguntas da Revisão')
  await expect(later).toContainText('1 ideia esperando')
  await expect(later).toContainText('Sessão 2 — A Torre')
  await expect(page.locator('.home')).not.toContainText('em rascunho')
  await expect(page.locator('.home')).not.toContainText('tramas abertas')
  await expect(page.getByRole('region', { name: 'Mexido por último' })).toHaveCount(0)
  // Um treino só (com a dica numa linha) e o ritmo dobrado.
  await expect(page.getByRole('region', { name: 'Dica do dia' })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Seu progresso' })).toHaveCount(0)
  // A capa do livro abre por cima ao entrar; o contraste se mede depois que ela sai.
  await expect(page.locator('.book-gate')).toHaveCount(0)
  // E depois que as entradas animadas terminam (no meio do fade, a cor ainda não é a final).
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity))
  const { violations } = await new AxeBuilder({ page }).include('.home').analyze()
  expect(violations.map((v) => v.id)).toEqual([])
  // As perguntas abrem a cena na Revisão, com a margem.
  await later.getByRole('button', { name: /5 perguntas da Revisão/ }).click()
  await expect(page.getByRole('complementary', { name: 'Margem viva' })).toBeVisible()
})

test('universo novo: só a primeira cena; depois de escrever, o dia e o bilhete', async ({ page }) => {
  await page.goto('/app/')
  await page.getByRole('textbox', { name: 'Nome do novo universo' }).fill('Maré Baixa')
  await page.getByRole('button', { name: 'Criar universo' }).click()
  await expect(next(page).getByRole('heading', { name: 'Comece por uma cena.' })).toBeVisible()
  // Sem zeros, sem nível, sem calendário vazio.
  await expect(page.getByRole('navigation', { name: 'O seu mundo' })).toHaveCount(0)
  await expect(page.getByText('Seu ritmo', { exact: true })).toHaveCount(0)
  await expect(page.locator('.home-stats')).toHaveText('')

  await next(page).getByRole('button', { name: 'Começar a escrever' }).click()
  await page.getByRole('textbox', { name: 'Texto da cena' }).click()
  await page.keyboard.type('Ela abriu a porta e o mar tinha ido embora.')
  await page.getByRole('button', { name: 'Deixar um bilhete para amanhã' }).click()
  await page.getByRole('textbox', { name: 'Bilhete para amanhã' }).fill('Ela entra no barco e acha a carta do pai.')
  await page.getByRole('button', { name: 'Guardar o bilhete' }).click()
  await expect(page.getByRole('status').first()).toHaveText('Salvo')

  await page.reload()
  await page
    .getByRole('navigation', { name: 'Áreas' })
    .getByRole('button', { name: /^Início/ })
    .click()
  await expect(next(page).getByRole('note', { name: 'Bilhete para amanhã' })).toContainText('Ela entra no barco e acha a carta do pai.')
  await expect(page.locator('.home-stats')).toContainText('10 palavras hoje')
  await expect(page.locator('.home-stats')).toContainText('1 dia seguido')
  await expect(page.getByRole('navigation', { name: 'O seu mundo' })).toContainText('1 cena, 10 palavras')
  await expect(page.getByText('Seu ritmo', { exact: true })).toBeVisible()
})

test.describe('no celular', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('o essencial cabe em duas telas: o próximo passo primeiro, o mundo antes do treino', async ({ page }) => {
    await page.goto('/app/?exemplo=ostria')
    await expect(next(page).getByRole('button', { name: 'Continuar escrevendo' })).toBeInViewport()
    const height = await page.locator('.stage').evaluate((el) => el.scrollHeight)
    expect(height).toBeLessThan(844 * 2)
    const world = await page.getByRole('navigation', { name: 'O seu mundo' }).boundingBox()
    const treino = await page.getByRole('region', { name: 'Treino de hoje' }).boundingBox()
    expect(world!.y).toBeLessThan(treino!.y)
    // Os atalhos têm nome à vista; capa e "Seus universos" ficam no ⋯.
    await expect(page.getByRole('button', { name: 'Anotar uma ideia' })).toContainText('Ideia')
    await page.getByRole('button', { name: 'Mais do universo' }).click()
    await expect(page.getByRole('button', { name: 'Seus universos' })).toBeVisible()
  })
})
