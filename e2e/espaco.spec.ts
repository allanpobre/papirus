import { expect, test, type Page } from './fixtures.ts'

/** O navegador diz quanto espaço usa e permite: aqui, o que o teste quiser. */
async function simularEspaco(page: Page, usage: number, quota: number) {
  await page.addInitScript(
    ([u, q]) => {
      Object.defineProperty(navigator.storage, 'estimate', { configurable: true, value: async () => ({ usage: u, quota: q }) })
    },
    [usage, quota],
  )
}

test.describe('aviso de espaço quase cheio, no celular', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('com 85% usado, o Início avisa com discrição e leva para Seus dados', async ({ page }) => {
    await simularEspaco(page, 85 * 1024 * 1024, 100 * 1024 * 1024)
    await page.goto('/app/?exemplo')
    const aviso = page.getByRole('status').filter({ hasText: 'O espaço deste navegador está ficando cheio' })
    await expect(aviso).toBeVisible()
    await expect(aviso).toContainText('85% usado (85 MB de 100 MB)')
    await aviso.getByRole('button', { name: 'Ver o que fazer' }).click()
    // Ajustes › Seus dados: o aviso completo, com as saídas.
    const card = page.getByRole('status').filter({ hasText: 'Quando acaba, o navegador para de guardar' })
    await expect(card).toBeVisible()
    await expect(card.getByRole('button', { name: 'Baixar backup agora' })).toBeVisible()
    await card.getByRole('button', { name: /Limpar imagens sem uso/ }).click()
    await expect(page.getByRole('heading', { name: 'Imagens' })).toBeInViewport()
    await expect(page.getByRole('button', { name: 'Limpar imagens sem uso' }).last()).toBeVisible()
  })

  test('"Lembrar depois" esconde o aviso do Início por uma semana', async ({ page }) => {
    await simularEspaco(page, 90 * 1024 * 1024, 100 * 1024 * 1024)
    await page.goto('/app/?exemplo')
    const aviso = page.getByRole('status').filter({ hasText: 'O espaço deste navegador' })
    await aviso.getByRole('button', { name: 'Lembrar depois' }).click()
    await expect(aviso).toHaveCount(0)
    await page.reload()
    await expect(page.getByRole('heading', { name: /Terra de Oz/ }).first()).toBeVisible()
    await expect(aviso).toHaveCount(0)
  })

  test('com bastante espaço, nada de aviso', async ({ page }) => {
    await simularEspaco(page, 10 * 1024 * 1024, 100 * 1024 * 1024)
    await page.goto('/app/?exemplo')
    await expect(page.getByRole('heading', { name: /Terra de Oz/ }).first()).toBeVisible()
    await expect(page.getByText('O espaço deste navegador')).toHaveCount(0)
  })
})
