import { expect, test } from './fixtures.ts'
import { fichaModo, openPart, abaFicha } from './areas.ts'

// As referências ficam no alto da ficha: colar um link, uma frase ou um nome vira referência; tocar abre em grande.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

test('a faixa de referências no alto da ficha: colar, abrir, marcar o que peguei, e o leitor não vê', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await openPart(page, 'Fichas')
  await page.getByRole('region', { name: 'Lista de fichas' }).getByRole('button', { name: /^Mira/ }).first().click()
  await fichaModo(page, 'Ler')
  const faixa = page.getByRole('region', { name: 'Referências desta ficha' })
  await expect(faixa).toBeVisible()
  // Logo no alto: antes de rolar a tela.
  expect((await faixa.boundingBox())!.y).toBeLessThan(844)

  await faixa.getByRole('button', { name: 'Nova referência' }).click()
  const campo = faixa.getByRole('textbox', { name: 'Colar uma referência' })
  await campo.fill('https://example.com/arya')
  await campo.press('Enter')
  await campo.fill('Arya Stark')
  await campo.press('Enter')
  await campo.fill('“Ninguém lembra do nome de quem fica nas docas.”')
  await campo.press('Enter')
  await expect(faixa.locator('.ref-tile:not(.ref-tile-add)')).toHaveCount(3)
  await expect(faixa.locator('.ref-tile.is-link')).toBeVisible()
  await expect(faixa.locator('.ref-tile.is-obra')).toContainText('Arya Stark')
  await expect(faixa.locator('.ref-tile.is-trecho')).toContainText('Ninguém lembra')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  // Tocar abre em grande; marcar o que peguei fica guardado.
  await faixa.locator('.ref-tile.is-obra').click()
  const janela = page.getByRole('dialog', { name: 'Arya Stark' })
  await janela.getByRole('button', { name: 'personalidade' }).click()
  await expect(janela.getByRole('button', { name: 'personalidade' })).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Escape')
  await abaFicha(page, 'Referências')
  await expect(page.getByRole('region', { name: 'Referências', exact: true })).toContainText('personalidade')

  // Como o leitor: a faixa some.
  await page.getByText('Ver como o leitor').click()
  await expect(page.getByRole('region', { name: 'Referências desta ficha' })).toHaveCount(0)
})
