import { openPart } from './areas.ts'
import { expect, test } from './fixtures.ts'

/*
 * O papel na história (Dorothy é a protagonista no exemplo de Oz): filtrar e ordenar em Fichas, a bolinha maior nas
 * Ligações e o papel ao lado do tipo na wiki. No celular (390 px).
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

test('Fichas: filtrar por papel e ordenar com os protagonistas primeiro', async ({ page }) => {
  await page.goto('/app/?exemplo')
  await openPart(page, 'Fichas')
  const lista = page.getByRole('region', { name: 'Lista de fichas' })
  const nomes = () => lista.locator('.entity-row-name').allInnerTexts().then((t) => t.map((x) => x.trim()))

  // Ordem "Papel": protagonista (Dorothy) no alto, depois os antagonistas, secundários…
  await page.getByLabel('Ordem da lista').selectOption('papel')
  await expect.poll(async () => (await nomes())[0]).toBe('Dorothy')
  const todos = await nomes()
  expect(todos.indexOf('Dorothy')).toBeLessThan(todos.indexOf('Espantalho'))
  // A escolha da ordem fica guardada.
  await page.reload()
  await openPart(page, 'Fichas')
  await expect(page.getByLabel('Ordem da lista')).toHaveValue('papel')

  // Filtro por papel: só os protagonistas; só quem não tem papel.
  const filtro = page.getByLabel('Filtrar por papel')
  await expect(filtro.locator('option', { hasText: /^Protagonista \(1\)/ })).toBeAttached()
  await filtro.selectOption('protagonista')
  await expect.poll(nomes).toEqual(['Dorothy'])
  await filtro.selectOption('secundario')
  expect((await nomes()).length).toBeGreaterThan(3)
  expect(await nomes()).toContain('Espantalho')
  expect(await nomes()).not.toContain('Dorothy')
  await filtro.selectOption('sem')
  expect(await nomes()).not.toContain('Dorothy')
  expect((await nomes()).length).toBeGreaterThan(10)
  await filtro.selectOption('')
  expect((await nomes()).length).toBeGreaterThan(20)
})

test('Ligações: a bolinha do protagonista é um pouco maior que a dos outros', async ({ page }) => {
  await page.goto('/app/?exemplo')
  await openPart(page, 'Ligações')
  await expect(page.locator('.node').first()).toBeVisible()
  const raio = (nome: string) =>
    page.locator('.node', { has: page.locator('text.node-label', { hasText: new RegExp(`^${nome}$`) }) }).locator('> circle:not(.node-ring)').first().getAttribute('r').then(Number)
  const dorothy = await raio('Dorothy')
  const espantalho = await raio('Espantalho')
  expect(dorothy).toBeGreaterThan(espantalho)
  // A conta do tamanho (o protagonista ganha 3 px no celular) é testada em `src/logic/roles.test.ts`; aqui, que está no desenho.
  expect(dorothy).toBeLessThanOrEqual(11 + 7 + 3)
})

test('papel por livro: secundária no livro 3, protagonista nos outros; vale na ficha, na lista e no filtro', async ({ page }) => {
  await page.goto('/app/?exemplo')
  await openPart(page, 'Fichas')
  const lista = page.getByRole('region', { name: 'Lista de fichas' })
  await lista.getByRole('button', { name: /^Dorothy/ }).first().click()
  // Na ficha (editar): o papel geral e um papel por livro, opcional.
  await expect(page.getByLabel('Papel na história').first()).toHaveValue('protagonista')
  const doLivro3 = page.getByLabel(/^Papel de Dorothy em Ozma de Oz/)
  await expect(doLivro3.locator('option:checked')).toHaveText('Igual ao geral (Protagonista)')
  await doLivro3.selectOption('secundario')

  // Com o livro 3 escolhido, a Dorothy é secundária: sai do filtro "Protagonista" e a ficha diz "Secundário".
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Início/ }).click()
  await page.getByLabel('Livro', { exact: true }).selectOption({ label: (await page.getByLabel('Livro', { exact: true }).locator('option', { hasText: /^Ozma de Oz/ }).innerText()).trim() })
  await openPart(page, 'Fichas')
  await expect(page.getByLabel('Filtrar por papel').locator('option', { hasText: /^Protagonista/ })).toHaveCount(0)
  const nomes = () => lista.locator('.entity-row-name').allInnerTexts().then((t) => t.map((x) => x.trim()))
  await expect(lista.locator('.entity-row').filter({ has: page.locator('.entity-row-name', { hasText: /^Dorothy$/ }) }).locator('.entity-row-kindtext')).toContainText('Secundário')
  await lista.getByRole('button', { name: /^Dorothy/ }).first().click()
  await page.getByRole('button', { name: 'Ler', exact: true }).click()
  await expect(page.locator('.entity-role')).toHaveText(/Secundário/)

  // Em todos os livros, volta o papel geral: protagonista.
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Início/ }).click()
  await page.getByLabel('Livro', { exact: true }).selectOption('')
  await openPart(page, 'Fichas')
  await expect(lista.locator('.entity-row').filter({ has: page.locator('.entity-row-name', { hasText: /^Dorothy$/ }) }).locator('.entity-row-kindtext')).toContainText('Protagonista')
  await page.getByLabel('Ordem da lista').selectOption('papel')
  await expect.poll(async () => (await nomes())[0]).toBe('Dorothy')
  await expect(page.getByLabel('Filtrar por papel').locator('option', { hasText: /^Protagonista \(1\)/ })).toBeAttached()
})
