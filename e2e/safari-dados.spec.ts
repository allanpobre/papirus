import { expect, test } from './fixtures.ts'

// O Safari do iPhone apaga o que um site guardou depois de 7 dias sem uso (se não estiver instalado). No iPhone
// sem instalar e sem conta, o app agora avisa uma vez, no Início, com as saídas.
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, userAgent: IPHONE })

test('no iPhone sem instalar: avisa uma vez no Início, só quando já há o que perder', async ({ page, context }) => {
  await context.addInitScript(() => localStorage.setItem('papirus:escrita-modo', 'pagina'))
  await page.goto('/app/')
  await page.getByRole('textbox', { name: 'Nome do novo universo' }).fill('Meu livro')
  await page.getByRole('button', { name: 'Criar universo' }).click()

  // Universo vazio: nada para perder ainda, nada de aviso.
  const aviso = page.getByRole('note').filter({ hasText: 'o Safari pode apagar' })
  await expect(aviso).toHaveCount(0)

  await page.getByRole('button', { name: 'Começar a escrever' }).first().click()
  await page.getByRole('textbox', { name: 'Texto da cena' }).click()
  await page.keyboard.type('A primeira frase do livro.')
  await page.waitForTimeout(800)

  // No Início, o aviso (uma vez).
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Fechar o teclado' }).click().catch(() => {})
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Menu', exact: true }).click()
  await page.getByRole('group', { name: 'Todas as áreas' }).getByRole('button', { name: /^Início/ }).click()
  await expect(aviso).toBeVisible()
  await expect(aviso).toContainText('Adicionar à Tela de Início')
  await aviso.getByRole('button', { name: 'Entendi' }).click()
  await expect(aviso).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Meu livro' })).toBeVisible()
  await expect(aviso).toHaveCount(0)
})

test('no computador (ou instalado) não aparece', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  await ctx.addInitScript(() => localStorage.setItem('papirus:prefs', JSON.stringify({ tourDone: true })))
  const page = await ctx.newPage()
  await page.goto('/app/?exemplo=ostria')
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
  await expect(page.getByRole('note').filter({ hasText: 'o Safari pode apagar' })).toHaveCount(0)
  await ctx.close()
})
