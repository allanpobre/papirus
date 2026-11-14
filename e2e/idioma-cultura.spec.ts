import { expect, test } from './fixtures.ts'

/** Cria uma ficha do tipo "Cultura" já em Editar, com o idioma preenchido. */
async function culturaComIdioma(page: import('@playwright/test').Page) {
  await page.goto('/app/?exemplo=ostria')
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Mundo/ }).first().click()
  await page.getByRole('combobox', { name: 'Tipo da nova ficha' }).selectOption({ label: 'Cultura' })
  await page.getByLabel('Nome da nova ficha').fill('Gente do Sal')
  await page.getByRole('button', { name: 'Criar ficha' }).click()
  const idioma = page.locator('details.fold', { hasText: 'Idioma' })
  await expect(idioma).toBeVisible()
  await idioma.locator('summary').click()
  await idioma.getByLabel('Sílabas').fill('sal- vo ra mi -dun -esh')
  await idioma.getByLabel('Como soa').fill('macio, com s e v')
  await idioma.getByLabel('Um exemplo').fill('Salvo mi dun')
  return idioma
}

test('o povo ganha um idioma (sílabas, como soa e um exemplo) e dá para testar nomes ali mesmo', async ({ page }) => {
  const idioma = await culturaComIdioma(page)
  // "Testar": nomes montados só com as sílabas.
  await idioma.getByRole('button', { name: 'Testar: sugerir nomes' }).click()
  const tries = await idioma.getByLabel('Nomes de teste').innerText()
  const names = tries.split(' · ')
  expect(names.length).toBeGreaterThanOrEqual(3)
  for (const n of names) expect(n.toLowerCase(), n).toMatch(/^(sal|vo|ra|mi|dun|esh)+$/)
  // E o que foi escrito fica guardado.
  await page.reload()
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Mundo/ }).first().click()
  await page.getByRole('button', { name: /^Gente do Sal/ }).first().click()
  await expect(page.locator('details.fold', { hasText: 'Idioma' }).getByLabel('Sílabas')).toHaveValue('sal- vo ra mi -dun -esh')
})

test('ao criar uma ficha, "Sugerir nomes" pode ser no estilo de um povo com idioma; sem idioma, no dos nomes que já existem', async ({ page }) => {
  await culturaComIdioma(page)
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Mundo/ }).first().click()
  // O mundo agora tem um idioma: a escolha do estilo aparece depois do primeiro sorteio (na linha curta de criar).
  await page.getByRole('combobox', { name: 'Tipo da nova ficha' }).selectOption({ label: 'Personagem' })
  await page.getByRole('button', { name: 'Sugerir nomes' }).click()
  const estilo = page.getByRole('combobox', { name: 'No estilo de' })
  await expect(estilo).toBeVisible()
  await expect(estilo.locator('option')).toHaveText(['Como os nomes que já existem', 'No estilo de Gente do Sal'])
  await estilo.selectOption({ label: 'No estilo de Gente do Sal' })
  const chips = page.getByRole('group', { name: 'Nomes sugeridos' }).getByRole('button')
  await expect(chips.first()).toBeVisible()
  const names = await chips.allTextContents()
  expect(names.length).toBeGreaterThanOrEqual(3)
  // Só com as sílabas do idioma ("sal", "vo", "ra", "mi", "dun", "esh").
  for (const n of names) expect(n.toLowerCase(), n).toMatch(/^(sal|vo|ra|mi|dun|esh)+$/)
  // Tocar num nome o põe no campo.
  await chips.first().click()
  await expect(page.getByLabel('Nome da nova ficha')).toHaveValue(names[0])
  // De volta a "como os que já existem": os nomes deixam de seguir as sílabas do povo.
  await estilo.selectOption({ label: 'Como os nomes que já existem' })
  const outros = await page.getByRole('group', { name: 'Nomes sugeridos' }).getByRole('button').allTextContents()
  expect(outros.some((n) => !/^(sal|vo|ra|mi|dun|esh)+$/.test(n.toLowerCase()))).toBe(true)
})

test('criar várias fichas na lista de um povo: os nomes sugeridos já vêm no estilo do idioma dele', async ({ page }) => {
  await culturaComIdioma(page)
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Mundo/ }).first().click()
  await page.getByRole('button', { name: 'Criar várias de uma vez' }).click()
  const janela = page.getByRole('dialog', { name: 'Criar várias fichas' })
  await janela.getByRole('combobox', { name: 'Pôr na lista de (opcional)' }).fill('Gente do')
  await page.getByRole('option', { name: /^Gente do Sal/ }).click()
  await expect(janela.getByRole('combobox', { name: 'No estilo de' })).toHaveValue(/.+/)
  await janela.getByRole('button', { name: 'Sugerir nomes' }).click()
  const nomes = await janela.getByRole('group', { name: 'Nomes sugeridos' }).getByRole('button').allTextContents()
  expect(nomes.length).toBeGreaterThanOrEqual(3)
  for (const n of nomes) expect(n.toLowerCase(), n).toMatch(/^(sal|vo|ra|mi|dun|esh)+$/)
  // Tocar num nome o põe numa linha nova da lista.
  await janela.getByRole('group', { name: 'Nomes sugeridos' }).getByRole('button').first().click()
  await expect(janela.getByRole('textbox', { name: 'Um nome por linha' })).toHaveValue(nomes[0])
})
