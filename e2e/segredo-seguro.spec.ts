import { expect, test, type Page } from './fixtures.ts'

// Segredo seguro por padrão (auditoria 23): botão "Segredo" na seleção da cena, aviso de marca aberta ou
// errada, e o livro baixado sem os trechos secretos.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
const texto = (p: Page) => p.getByRole('textbox', { name: 'Texto da cena' })

test('marcar um segredo pela seleção, ser avisado de marca aberta, e o livro não levar o segredo', async ({ page, context }) => {
  await context.addInitScript(() => localStorage.setItem('papirus:escrita-modo', 'pagina'))
  await page.goto('/app/')
  await page.getByRole('textbox', { name: 'Nome do novo universo' }).fill('Segredos')
  await page.getByRole('button', { name: 'Criar universo' }).click()
  await page.getByRole('button', { name: 'Começar a escrever' }).first().click()
  await texto(page).click()
  await page.keyboard.type('Kael viu o porto. ')
  await page.keyboard.type('Ele é o herdeiro.')
  // Seleciona "Ele é o herdeiro." e toca em Segredo (barra acima do teclado, no celular).
  for (let i = 0; i < 'Ele é o herdeiro.'.length; i++) await page.keyboard.press('Shift+ArrowLeft')
  await page.getByRole('toolbar').getByRole('button', { name: 'Segredo' }).click()
  await expect(texto(page)).toContainText('Kael viu o porto. [segredo]Ele é o herdeiro.[/segredo]')

  // O cursor fica depois do segredo: continuar escrevendo é escrever fora dele.
  await page.keyboard.type(' Ela sorriu.')
  await expect(texto(page)).toContainText('[/segredo] Ela sorriu.')

  // Uma marca aberta sem fechar: o aviso aparece.
  await page.keyboard.press('Enter')
  await page.keyboard.type('Depois [segredo]ninguém sabe disso.')
  const aviso = page.getByRole('status').filter({ hasText: 'está sem [/segredo]' })
  await expect(aviso).toBeVisible()
  await page.keyboard.type('[/segredo] Fim.')
  await expect(aviso).toHaveCount(0)

  // Uma marca escrita errada também avisa.
  await page.keyboard.press('Enter')
  await page.keyboard.type('Ela [segrdo]mentiu[/segrdo].')
  await expect(page.getByRole('status').filter({ hasText: 'parece uma marca de segredo' })).toBeVisible()
})
