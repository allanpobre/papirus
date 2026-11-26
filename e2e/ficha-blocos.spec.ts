import { expect, test } from './fixtures.ts'
import { fichaModo } from './areas.ts'

/*
 * A ficha como página de blocos, no celular: editar um bloco ali mesmo (sem trocar para "Editar"), arrumar a
 * ordem, tirar e pôr de volta, e acrescentar nota e citação.
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

test('ficha de blocos: editar no lugar, arrumar, tirar, pôr de volta e acrescentar', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await page.getByRole('button', { name: 'Mundo', exact: true }).first().click()
  await page.getByRole('region', { name: 'Lista de fichas' }).getByRole('button', { name: /^Kael/ }).first().click()
  await fichaModo(page, 'Ler')
  const ficha = page.getByRole('article', { name: /^Ler a ficha/ })
  await expect(ficha).toBeVisible()
  const ordem = () => ficha.locator('.reader-text > [data-block]').evaluateAll((els) => els.map((el) => el.getAttribute('data-block')))

  // Editar o texto ali mesmo.
  await ficha.getByRole('button', { name: 'Editar: Texto' }).click()
  const editando = ficha.getByRole('group', { name: 'Editando: Texto' })
  await editando.getByRole('textbox', { name: 'Descrição' }).fill('Kael cresceu no porto.\n\nSonha com o mar.')
  await editando.getByRole('button', { name: 'Pronto' }).click()
  await expect(ficha.getByText('Sonha com o mar.')).toBeVisible()

  // Arrumar: descer o texto, tirar os fatos e pôr de volta.
  // Arrumar a página fica no “Mais da ficha”.
  await ficha.page().getByRole('button', { name: 'Mais da ficha' }).click()
  await ficha.page().getByRole('button', { name: 'Arrumar a página' }).click()
  const antes = await ordem()
  await ficha.getByRole('button', { name: 'Descer: Texto' }).click()
  const depois = await ordem()
  expect(depois.indexOf('texto')).toBe(antes.indexOf('texto') + 1)
  const tirar = depois.includes('fatos') ? 'Fatos' : 'Aparece em'
  await ficha.getByRole('button', { name: `Tirar da página: ${tirar}` }).click()
  await expect(ficha.locator(`[data-block="${tirar === 'Fatos' ? 'fatos' : 'aparece'}"]`)).toHaveCount(0)
  await ficha.getByRole('button', { name: 'Bloco', exact: true }).click()
  await ficha.getByRole('group', { name: 'Acrescentar bloco' }).getByRole('button', { name: `${tirar} (tirado)` }).click()
  await expect(ficha.locator(`[data-block="${tirar === 'Fatos' ? 'fatos' : 'aparece'}"]`)).toHaveCount(1)

  // Uma nota nova.
  await ficha.getByRole('button', { name: 'Bloco', exact: true }).click()
  await ficha.getByRole('group', { name: 'Acrescentar bloco' }).getByRole('button', { name: 'Nota' }).click()
  const nota = ficha.getByRole('group', { name: 'Editando: Nota' })
  await nota.getByRole('textbox', { name: 'Título da nota' }).fill('Sonhos')
  await nota.getByRole('textbox', { name: 'Texto da nota' }).fill('Sempre o mesmo farol.')
  await ficha.getByRole('group', { name: /^Editando: Nota/ }).getByRole('button', { name: 'Pronto' }).click()
  await expect(ficha.getByRole('region', { name: 'Sonhos' })).toContainText('Sempre o mesmo farol.')

  // Uma citação de cena, com o link para ela.
  await ficha.getByRole('button', { name: 'Bloco', exact: true }).click()
  await ficha.getByRole('group', { name: 'Acrescentar bloco' }).getByRole('button', { name: 'Citação de uma cena' }).click()
  const cit = ficha.getByRole('group', { name: 'Editando: Citação de uma cena' })
  await cit.getByRole('combobox', { name: 'Cena' }).selectOption({ index: 1 })
  await cit.getByRole('textbox', { name: 'O trecho' }).fill('O mar não espera ninguém.')
  await cit.getByRole('button', { name: 'Pronto' }).click()
  await expect(ficha.locator('.block-quote blockquote')).toHaveText('O mar não espera ninguém.')
  await expect(ficha.locator('.block-quote figcaption button')).toBeVisible()

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  // Depois de recarregar, a ordem e os blocos novos continuam.
  const final = await ordem()
  await page.reload()
  await expect(page.getByRole('article', { name: /^Ler a ficha/ })).toBeVisible()
  expect(await ordem()).toEqual(final)
})
