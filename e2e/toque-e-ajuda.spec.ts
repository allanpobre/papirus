import { expect, test } from './fixtures.ts'
import { fichaModo, openPart } from './areas.ts'

// Auditoria 23 (H6.2 e H10.1): na ficha, os botões do alto com nome e com área para o dedo; e as janelas
// simples com um (?) que diz para que servem.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

test('ficha no celular: Editar e E se sumir? com nome, ícones com 40 px e Arrumar no Mais', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await openPart(page, 'Fichas')
  await page.getByRole('region', { name: 'Lista de fichas' }).getByRole('button', { name: /^Kael/ }).first().click()
  await fichaModo(page, 'Ler')
  const head = page.locator('.reader-head')
  await expect(head.getByRole('button', { name: 'Editar', exact: true })).toHaveText('Editar')
  // O “E se sumir?” mora no menu da ficha, com o nome por extenso.
  await head.getByRole('button', { name: 'Mais da ficha' }).click()
  await expect(page.getByRole('button', { name: /E se sumir\?/ })).toBeVisible()
  await page.keyboard.press('Escape')
  // Os que seguem só com desenho têm pelo menos 40 px.
  for (const nome of ['Voltar para a lista', 'Mais da ficha']) {
    const b = (await head.getByRole('button', { name: nome }).boundingBox())!
    expect(Math.min(b.width, b.height)).toBeGreaterThanOrEqual(40)
  }
  // O lápis de cada bloco diz “Editar”.
  await expect(page.getByRole('button', { name: 'Editar: Texto' })).toHaveText('Editar')
  await head.getByRole('button', { name: 'Mais da ficha' }).click()
  await page.getByRole('button', { name: 'Arrumar a página' }).click()
  await expect(page.getByRole('button', { name: 'Descer: Texto' })).toBeVisible()
})

test('janela simples: o (?) explica para que ela serve', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await page.getByRole('button', { name: 'Mundo', exact: true }).first().click()
  await page.getByRole('button', { name: 'Rolar no mundo' }).first().click()
  const janela = page.getByRole('dialog', { name: 'Rolar no mundo' })
  const ajuda = janela.getByRole('button', { name: 'Para que serve esta janela' })
  await expect(ajuda).toHaveAttribute('aria-expanded', 'false')
  await ajuda.click()
  await expect(janela.getByRole('note')).toContainText('tirados do seu mundo')
  await ajuda.click()
  await expect(janela.getByRole('note')).toHaveCount(0)
})
