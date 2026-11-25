import { expect, test } from './fixtures.ts'

// No celular não havia nenhum sinal de que salvou (auditoria 23). Agora: "Salvo" por um instante, e "Sem espaço
// neste aparelho" (com o que fazer) quando o navegador recusa por falta de espaço.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

test('o celular mostra que salvou, e avisa quando falta espaço', async ({ page, context }) => {
  await context.addInitScript(() => localStorage.setItem('papirus:escrita-modo', 'pagina'))
  await page.goto('/app/')
  await page.getByRole('textbox', { name: 'Nome do novo universo' }).fill('Salvo')
  await page.getByRole('button', { name: 'Criar universo' }).click()
  await page.getByRole('button', { name: 'Começar a escrever' }).first().click()
  const texto = page.getByRole('textbox', { name: 'Texto da cena' })
  await texto.click()
  await page.keyboard.type('Uma frase.')
  const selo = page.locator('.mobile-save')
  await expect(selo).toHaveClass(/is-shown/)
  await expect(selo).toContainText('Salvo')
  // Some sozinho: não fica no caminho de quem escreve.
  await expect(selo).not.toHaveClass(/is-shown/, { timeout: 5000 })

  // Falta espaço: o navegador recusa a gravação (como ele faz: um QuotaExceededError no IndexedDB).
  await page.evaluate(() => {
    const w = window as unknown as { semEspaco: boolean }
    w.semEspaco = true
    const put = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof put>) {
      if (w.semEspaco) throw new DOMException('O espaço acabou.', 'QuotaExceededError')
      return put.apply(this, args)
    }
  })
  await page.keyboard.type(' Mais texto.')
  await expect(selo).toContainText('Sem espaço neste aparelho', { timeout: 10_000 })
  await expect(selo.getByRole('button', { name: 'Liberar espaço' })).toBeVisible()

  // Com espaço de novo, ele tenta outra vez sozinho e volta a "Salvo".
  await page.evaluate(() => ((window as unknown as { semEspaco: boolean }).semEspaco = false))
  await expect(selo).toContainText('Salvo', { timeout: 15_000 })
})
