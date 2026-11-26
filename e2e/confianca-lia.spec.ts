import { expect, test, type Page } from './fixtures.ts'

// Auditoria 26, pacote 2: a confiança da Lia. Colar do Google Docs, o convite para guardar na nuvem na hora
// certa e o histórico da cena à mão. No celular.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

async function novoUniverso(page: Page) {
  await page.goto('/app/')
  await page.getByRole('textbox', { name: 'Nome do novo universo' }).fill('A Coroa de Sal')
  await page.getByRole('button', { name: 'Criar universo' }).click()
  await page.getByRole('button', { name: /Começar a escrever/ }).first().click()
}

/** Cola no editor como o navegador faria (o mesmo evento de colar do celular e do computador). */
async function colar(page: Page, html: string, text: string) {
  const editor = page.getByRole('textbox', { name: 'Texto da cena' })
  await editor.click()
  await editor.evaluate(
    (el, { html, text }) => {
      const dt = new DataTransfer()
      dt.setData('text/html', html)
      dt.setData('text/plain', text)
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    },
    { html, text },
  )
}

test('colar do Google Docs mantém negrito, itálico e parágrafos (e não deixa tudo em negrito)', async ({ page, context }) => {
  await context.addInitScript(() => localStorage.setItem('papirus:escrita-modo', 'pagina'))
  await novoUniverso(page)
  // O Docs embrulha tudo num <b style="font-weight:normal">: há editor que deixa o texto inteiro em negrito.
  const docs =
    '<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-1"><p dir="ltr"><span style="font-weight:400;">Selene viu o </span><span style="font-weight:700;">porto</span><span style="font-weight:400;"> e o </span><span style="font-weight:400;font-style:italic;">mar</span><span style="font-weight:400;">.</span></p><p dir="ltr"><span style="font-weight:400;">Segundo parágrafo.</span></p></b>'
  await colar(page, docs, 'Selene viu o porto e o mar.\n\nSegundo parágrafo.')
  const editor = page.getByRole('textbox', { name: 'Texto da cena' })
  await expect(editor.locator('p')).toHaveCount(2)
  await expect(editor.locator('strong')).toHaveText(['porto'])
  await expect(editor.locator('em')).toHaveText(['mar'])
})

test('com mais de mil palavras só no aparelho, o Início convida a guardar na conta; “Agora não” some', async ({ page, context }) => {
  await context.addInitScript(() => localStorage.setItem('papirus:escrita-modo', 'pagina'))
  await novoUniverso(page)
  const muito = Array.from({ length: 1050 }, (_, i) => `palavra${i}`).join(' ')
  await colar(page, `<p>${muito}</p>`, muito)
  await page.waitForTimeout(800)
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Início', exact: true }).click()
  const convite = page.getByRole('note', { name: 'Seu livro só está neste aparelho' })
  await expect(convite).toContainText('1.050 palavras')
  await expect(convite.getByRole('button', { name: 'Guardar na minha conta' })).toBeVisible()
  await convite.getByRole('button', { name: /Agora não/ }).click()
  await expect(convite).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'A Coroa de Sal' })).toBeVisible()
  await expect(convite).toHaveCount(0)
})

test('o histórico da cena fica no rodapé quando a cena tem versões', async ({ page, context }) => {
  await context.addInitScript(() => localStorage.setItem('papirus:escrita-modo', 'pagina'))
  await novoUniverso(page)
  await page.getByRole('textbox', { name: 'Texto da cena' }).click()
  await page.keyboard.type('A primeira versão da cena.')
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  // A cena guarda a versão do dia sozinha: o atalho já aparece, com a contagem.
  const atalho = page.getByRole('button', { name: /^Versões desta cena/ })
  await expect(atalho).toBeVisible()
  const antes = Number((await atalho.getAttribute('aria-label'))!.match(/\((\d+)\)/)![1])
  // Guardar à mão uma versão a mais faz a contagem subir.
  await page.getByRole('button', { name: 'Mais ações da cena' }).click()
  await page.getByRole('button', { name: /Versões da cena/ }).click()
  await page.getByRole('button', { name: 'Guardar texto atual' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar' }).first().click()
  await expect(atalho).toHaveAccessibleName(`Versões desta cena (${antes + 1})`)
  await atalho.click()
  await expect(page.getByRole('dialog')).toContainText('A primeira versão da cena')
})
