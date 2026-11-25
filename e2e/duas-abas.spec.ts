import { expect, test, type Page } from './fixtures.ts'

// O mesmo universo em duas abas: a mais nova fica com ele, a outra salva o que tinha e para (só ler) até
// "Continuar aqui", quando relê o que a outra salvou. Antes, as duas diziam "Salvo" e uma apagava a outra.
const texto = (p: Page) => p.getByRole('textbox', { name: 'Texto da cena' })

async function abrirEscrever(p: Page) {
  await p.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Escrever/ }).first().click()
  await expect(texto(p)).toBeVisible()
}

test('duas abas com o mesmo universo: nenhuma apaga o texto da outra', async ({ page, context }) => {
  await context.addInitScript(() => localStorage.setItem('papirus:escrita-modo', 'pagina'))
  await page.goto('/app/')
  await page.getByRole('textbox', { name: 'Nome do novo universo' }).fill('Duas abas')
  await page.getByRole('button', { name: 'Criar universo' }).click()
  await page.getByRole('button', { name: 'Começar a escrever' }).first().click()
  await texto(page).click()
  await page.keyboard.type('Da aba A.')
  await expect(page.getByRole('status').filter({ hasText: 'Salvo' }).first()).toBeAttached()
  await page.waitForTimeout(900)

  // A aba B abre o mesmo universo: vê o texto da A, e a A para.
  const b = await context.newPage()
  await b.goto('/app/')
  await b.getByRole('button', { name: /Duas abas/ }).first().click()
  await abrirEscrever(b)
  await expect(texto(b)).toContainText('Da aba A.')
  const aviso = page.getByRole('alert').filter({ hasText: 'aberto em outra aba' })
  await expect(aviso).toBeVisible()

  // B escreve; A não consegue escrever por cima.
  await texto(b).click()
  await b.keyboard.press('End')
  await b.keyboard.type(' Da aba B.')
  await b.waitForTimeout(1200)
  await page.bringToFront()
  await texto(page).click()
  await page.keyboard.press('End')
  await page.keyboard.type(' Tentativa na A parada.')
  await page.waitForTimeout(900)

  // "Continuar aqui": a A relê o que a B salvou, e agora é a B que para.
  await aviso.getByRole('button', { name: 'Continuar aqui' }).click()
  await expect(aviso).toHaveCount(0)
  await expect(texto(page)).toContainText('Da aba B.')
  await expect(b.getByRole('alert').filter({ hasText: 'aberto em outra aba' })).toBeVisible()
  await texto(page).click()
  await page.keyboard.press('End')
  await page.keyboard.type(' De novo na A.')
  await page.waitForTimeout(1200)

  // Uma terceira aba vê tudo junto: nada se perdeu.
  const c = await context.newPage()
  await c.goto('/app/')
  await c.getByRole('button', { name: /Duas abas/ }).first().click()
  await abrirEscrever(c)
  await expect(texto(c)).toContainText('Da aba A. Da aba B. De novo na A.')
  await expect(texto(c)).not.toContainText('Tentativa na A parada')
})
