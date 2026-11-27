import { expect, test, type Page } from './fixtures.ts'
import { fichaModo, openPart } from './areas.ts'

/*
 * Máscara no texto e ficha revelada numa cena, no celular. O autor marca o que o leitor lê até a revelação
 * ("até lá…") e a partir de que cena o leitor conhece a ficha; a régua mostra cada lado.
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

const abrir = async (page: Page, nome: string) => {
  await openPart(page, 'Fichas')
  await page.getByRole('region', { name: 'Lista de fichas' }).getByRole('button', { name: new RegExp(`^${nome}`) }).first().click()
}
const ate = async (page: Page, cena: string | null) => {
  const sel = page.getByRole('group', { name: 'Ponto da história' }).getByRole('combobox', { name: 'Até onde na história' })
  await sel.selectOption(cena ? (await sel.locator('option', { hasText: cena }).getAttribute('value'))! : '')
}

test('o leitor lê a máscara até a revelação, e só conhece a ficha a partir da cena marcada', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await abrir(page, 'Homem Pálido')
  await fichaModo(page, 'Editar')

  // A arma (revelada em "A maré volta"): até lá, o leitor lê outra coisa.
  await page.getByRole('button', { name: 'Arma: o que o leitor lê até a cena' }).click()
  await page.getByRole('textbox', { name: /^Arma: o que o leitor lê até a cena/ }).fill('Uma espada embrulhada em pano')
  await page.getByRole('textbox', { name: /^Arma: o que o leitor lê até a cena/ }).press('Enter')
  await expect(page.getByRole('button', { name: 'Arma: o que o leitor lê até a cena' })).toContainText('até lá: Uma espada embrulhada')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  await fichaModo(page, 'Ler')
  const quadro = page.getByRole('complementary', { name: 'Em resumo' })
  // Autor: a verdade e a máscara, cada uma com a cena.
  await expect(quadro.locator('.mask-mark')).toContainText('o leitor lê isto até “A maré volta”')
  await expect(quadro).toContainText('Lâmina de vidro negro')
  // Leitor antes da revelação: a máscara; depois, a verdade.
  await ate(page, 'A chegada')
  await page.getByRole('group', { name: 'Ponto da história' }).getByText('Ver como o leitor').click()
  await expect(quadro).toContainText('Uma espada embrulhada em pano')
  await expect(quadro).not.toContainText('vidro negro')
  await ate(page, 'A maré volta')
  await expect(quadro).toContainText('Lâmina de vidro negro')
  await expect(quadro).not.toContainText('embrulhada em pano')
  await page.getByRole('group', { name: 'Ponto da história' }).getByText('Ver como o leitor').click()

  // A Rhea: o leitor só a conhece a partir de "Duas portas", mesmo citada antes. O app diz se há pistas antes.
  await page.getByRole('button', { name: 'Voltar para a lista' }).click()
  await abrir(page, 'Rhea')
  await fichaModo(page, 'Editar')
  // Fica em "Mais opções", junto de "Entra na wiki".
  await page.getByText('Mais opções', { exact: true }).click()
  const quando = page.getByRole('combobox', { name: 'O leitor conhece esta ficha' })
  await quando.selectOption((await quando.locator('option', { hasText: 'Duas portas' }).getAttribute('value'))!)
  await expect(page.getByRole('note').filter({ hasText: /Antes desta cena, o leitor tem|Nenhuma pista antes/ })).toBeVisible()
  await fichaModo(page, 'Ler')
  await expect(page.locator('.entity-reveal-note')).toContainText('O leitor conhece esta ficha em “Duas portas”')
  await ate(page, 'O navio sem nome')
  await expect(page.locator('.entity-reveal-note')).toContainText('O leitor só conhece esta ficha em “Duas portas”')
  await page.getByRole('group', { name: 'Ponto da história' }).getByText('Ver como o leitor').click()
  await expect(page.getByRole('status').filter({ hasText: 'O leitor ainda não conhece Rhea neste ponto' })).toContainText('Duas portas')
  await ate(page, 'Duas portas')
  await expect(page.locator('.story-point-unknown')).toHaveCount(0)
})
