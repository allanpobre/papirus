import { expect, test } from './fixtures.ts'
import { fichaModo, openPart, abaFicha } from './areas.ts'

/*
 * Referências da ficha (o mural do que a inspirou), no celular: imagem, link e trecho, com o que se pegou
 * de cada um. Só o autor vê: "como o leitor", o mural some.
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
// Um PNG de 2x2 pixels.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP8z8DwnwEJMDEgARQOAEsFAgHC5n9hAAAAAElFTkSuQmCC', 'base64')

test('o mural de referências: imagem, link e trecho, com o que se pegou; o leitor não vê', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await openPart(page, 'Fichas')
  await page.getByRole('region', { name: 'Lista de fichas' }).getByRole('button', { name: /^Kael/ }).first().click()
  await fichaModo(page, 'Editar')
  await page.locator('summary', { hasText: 'Referências' }).click()
  const novo = page.getByRole('group', { name: 'Nova referência' })

  // Um trecho, com o que se pegou dele e o que ele não é.
  await novo.getByRole('button', { name: 'Trecho' }).click()
  const cartas = page.locator('.refs-edit .ref-card')
  await cartas.last().getByRole('textbox', { name: 'Título da referência' }).fill('Arya Stark')
  await cartas.last().getByRole('textbox', { name: 'O trecho' }).fill('Um homem não tem nome.')
  await cartas.last().getByRole('group', { name: 'O que peguei daqui' }).getByRole('button', { name: 'personalidade' }).click()
  await cartas.last().getByRole('textbox', { name: 'O que não é' }).fill('Não é nobre')
  // Um link.
  await novo.getByRole('button', { name: 'Link' }).click()
  await cartas.last().getByRole('textbox', { name: 'Endereço' }).fill('https://example.com/porto')
  await cartas.last().getByRole('textbox', { name: 'Título da referência' }).fill('Porto de inverno')
  // Uma imagem.
  await page.locator('.refs-add input[type=file]').setInputFiles({ name: 'ref.png', mimeType: 'image/png', buffer: PNG })
  await expect(cartas).toHaveCount(3)
  await expect(cartas.last().locator('img.ref-image')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  // Lendo: o mural, marcado como só do autor.
  await fichaModo(page, 'Ler')
  await abaFicha(page, 'Referências')
  const mural = page.getByRole('region', { name: 'Referências', exact: true })
  await expect(mural).toContainText('só você vê')
  await expect(mural.locator('blockquote')).toHaveText('Um homem não tem nome.')
  await expect(mural).toContainText('personalidade')
  await expect(mural).toContainText('Não é: Não é nobre')
  await expect(mural.getByRole('link', { name: /example\.com\/porto/ })).toHaveAttribute('href', 'https://example.com/porto')
  await expect(mural.locator('img.ref-image')).toBeVisible()

  // Como o leitor: o mural some.
  await page.getByRole('group', { name: 'Ponto da história' }).getByText('Ver como o leitor').click()
  await expect(page.getByRole('region', { name: 'Referências', exact: true })).toHaveCount(0)
})
