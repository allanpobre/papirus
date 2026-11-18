import { expect, test } from './fixtures.ts'
import { openPart } from './areas.ts'

/*
 * A régua da história na ficha, no celular: até qual cena se olha, e "ver como o leitor".
 * O autor vê tudo, com o que o leitor só descobre depois marcado; como o leitor, só o que ele já sabe.
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

const abrir = async (page: import('@playwright/test').Page, nome: string) => {
  await page.getByRole('button', { name: 'Mundo', exact: true }).first().click()
  await page.getByRole('region', { name: 'Lista de fichas' }).getByRole('button', { name: new RegExp(`^${nome}`) }).first().click()
  const ler = page.getByRole('button', { name: 'Ler', exact: true })
  if (await ler.count()) await ler.click()
}

test('a ficha muda com o ponto da história: o autor vê as marcas, o leitor só o que já sabe', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await abrir(page, 'Homem Pálido')
  const ficha = page.getByRole('article', { name: /Ler a ficha Homem Pálido/ })
  const regua = ficha.getByRole('group', { name: 'Ponto da história' })
  await expect(regua).toBeVisible()

  // Sem ponto: o autor vê tudo, e o trecho que o leitor só descobre numa cena vem com a cena.
  const trecho = ficha.locator('.reveal-mark', { hasText: 'olhos cinzentos do retrato' })
  await expect(trecho).toContainText('o leitor descobre em “O retrato”')
  await expect(ficha.locator('.secret-mark', { hasText: 'É Vaelor.' })).toBeVisible()

  // Até "A chegada": o mesmo trecho ainda está no futuro.
  const ate = regua.getByRole('combobox', { name: 'Até onde na história' })
  const chegada = await ate.locator('option', { hasText: 'A chegada' }).getAttribute('value')
  await ate.selectOption(chegada!)
  await expect(trecho).toHaveClass(/is-future/)
  await expect(trecho).toContainText('o leitor só descobre em “O retrato”')
  await expect(regua).toContainText('Até “A chegada”')

  // Como o leitor, até "A chegada": nem o trecho futuro nem o segredo; os olhos (de "A chegada") sim, a arma (de depois) não.
  await regua.getByText('Ver como o leitor').click()
  await expect(regua).toContainText('Como o leitor ao terminar “A chegada”')
  await expect(ficha).not.toContainText('olhos cinzentos do retrato')
  await expect(ficha).not.toContainText('É Vaelor')
  const quadro = ficha.getByRole('complementary', { name: 'Em resumo' })
  await expect(quadro).toContainText('Cinzentos, segundo Mira')
  await expect(quadro).not.toContainText('vidro negro')
  // "Aparece em" só até ali.
  await expect(ficha.locator('.appear-sum')).toContainText('de 1 cena')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  // A escolha vale para as outras fichas: a Rhea, que só aparece depois, o leitor ainda não conhece.
  await page.getByRole('button', { name: 'Voltar para a lista' }).click()
  await abrir(page, 'Rhea')
  const rhea = page.getByRole('article', { name: /Ler a ficha Rhea/ })
  await expect(rhea.getByRole('status').filter({ hasText: 'O leitor ainda não conhece Rhea neste ponto' })).toContainText('Aparece pela primeira vez em')
  await expect(rhea.getByRole('combobox', { name: 'Até onde na história' })).toHaveValue(chegada!)

  // As Ligações, no cena a cena, começam no mesmo ponto; mover lá muda a régua das fichas.
  await openPart(page, 'Ligações')
  // No celular, os filtros do grafo ficam recolhidos.
  await page.getByRole('button', { name: /^Filtros/ }).click()
  await page.getByRole('radio', { name: 'Num ponto da história' }).click()
  const cena = page.getByRole('slider', { name: 'Cena' })
  await expect(cena).toHaveAttribute('aria-valuetext', 'A chegada')
  await cena.fill('1')
  const segunda = await cena.getAttribute('aria-valuetext')
  await openPart(page, 'Fichas')
  await page.getByRole('region', { name: 'Lista de fichas' }).getByRole('button', { name: /^Rhea/ }).first().click()
  if (await page.getByRole('button', { name: 'Ler', exact: true }).count()) await page.getByRole('button', { name: 'Ler', exact: true }).click()
  await expect(rhea.getByRole('combobox', { name: 'Até onde na história' }).locator('option:checked')).toContainText(segunda!)

  // Voltando para a história toda e o modo autor, tudo volta.
  await rhea.getByText('Ver como o leitor').click()
  await rhea.getByRole('combobox', { name: 'Até onde na história' }).selectOption('')
  await expect(rhea.locator('.story-point-unknown')).toHaveCount(0)
})
