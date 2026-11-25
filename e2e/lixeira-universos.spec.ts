import { expect, test } from './fixtures.ts'

// Apagar um universo não tinha volta (auditoria 23). Agora vai para "Apagados recentemente" por 30 dias.
async function abrirUniverso(page: import('@playwright/test').Page) {
  // No celular, os Ajustes abrem na lista de categorias.
  const cat = page.getByRole('navigation', { name: 'Categorias dos ajustes' }).getByRole('button', { name: 'Universo', exact: true })
  await cat.click({ timeout: 5000 }).catch(() => {})
}

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

test('apagar um universo manda para a lixeira; Recuperar traz tudo de volta; Apagar de vez some', async ({ page, context }) => {
  await context.addInitScript(() => localStorage.setItem('papirus:escrita-modo', 'pagina'))
  await page.goto('/app/')
  await page.getByRole('textbox', { name: 'Nome do novo universo' }).fill('Ilha Velha')
  await page.getByRole('button', { name: 'Criar universo' }).click()
  await page.getByRole('button', { name: 'Começar a escrever' }).first().click()
  await page.getByRole('textbox', { name: 'Texto da cena' }).click()
  await page.keyboard.type('O farol apagou na noite em que ela voltou.')
  await page.waitForTimeout(1000)

  // Apaga pelos Ajustes (o mesmo caminho do menu do cartão).
  await page.getByRole('button', { name: 'Fechar o teclado' }).click().catch(() => {})
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Mais', exact: true }).click()
  await page.locator('#menu-mais').getByRole('button', { name: /^Ajustes e dados/ }).click()
  await abrirUniverso(page)
  await page.getByRole('button', { name: 'Apagar este universo…' }).click()
  await expect(page.getByText('fica 30 dias em “Apagados recentemente”')).toBeVisible()
  await page.getByRole('button', { name: 'Apagar universo' }).click()

  // Na lista: não está mais nos universos, mas está na lixeira.
  const lixeira = page.getByRole('region', { name: 'Apagados recentemente' })
  await expect(lixeira).toContainText('Ilha Velha')
  await expect(lixeira).toContainText('some em 30 dias')
  await lixeira.getByRole('button', { name: 'Recuperar' }).click()

  // Volta aberto, com o texto.
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Escrever' }).first().click()
  await expect(page.getByRole('textbox', { name: 'Texto da cena' })).toContainText('O farol apagou na noite em que ela voltou.')

  // Apagar de novo e, desta vez, de vez.
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Mais', exact: true }).click()
  await page.locator('#menu-mais').getByRole('button', { name: /^Ajustes e dados/ }).click()
  await abrirUniverso(page)
  await page.getByRole('button', { name: 'Apagar este universo…' }).click()
  await page.getByRole('button', { name: 'Apagar universo' }).click()
  await lixeira.getByRole('button', { name: 'Apagar de vez' }).click()
  await page.getByRole('button', { name: 'Apagar de vez' }).last().click()
  await expect(lixeira).toHaveCount(0)
  await page.reload()
  await expect(page.getByText('Ilha Velha')).toHaveCount(0)
})
