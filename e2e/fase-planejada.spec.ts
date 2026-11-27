import { expect, test } from './fixtures.ts'
import { fichaModo, openPart } from './areas.ts'

// Uma fase do personagem antes de existir a cena: fica planejada, só para o autor, e depois se prende a uma cena.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

test('fase planejada: sem cena ainda, aparece só para o autor e passa a valer quando ganha uma cena', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await openPart(page, 'Fichas')
  await page.getByRole('region', { name: 'Lista de fichas' }).getByRole('button', { name: /^Kael/ }).first().click()
  await fichaModo(page, 'Editar')
  await page.getByText('Ao longo da história', { exact: true }).click()
  await page.getByRole('button', { name: /Fase planejada/ }).click()
  const fase = page.locator('.phase-card.is-planned').first()
  await expect(fase.getByRole('combobox', { name: 'A partir de' })).toHaveValue('')
  await fase.getByRole('textbox', { name: 'Quando' }).fill('Livro 2')
  await fase.getByRole('textbox', { name: 'Nome da fase' }).fill('Rei do porto')
  await fase.getByRole('textbox', { name: 'Passa a ser chamado' }).fill('Kael I')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  // Ler: a ficha continua "Kael"; a fase aparece em "Planejadas", com o quando e como ficaria.
  await fichaModo(page, 'Ler')
  const ficha = page.getByRole('article', { name: /Ler a ficha/ })
  await expect(ficha.getByRole('heading', { level: 1 })).toHaveText('Kael')
  const planejadas = ficha.locator('.phase-planned')
  await expect(planejadas).toContainText('Rei do porto')
  await expect(planejadas).toContainText('Livro 2')
  await expect(planejadas.getByRole('list', { name: /Como fica em Rei do porto/ })).toContainText('Kael I')

  // Como o leitor: nada da fase planejada.
  await ficha.getByText('Ver como o leitor').click()
  await expect(ficha.locator('.phase-planned')).toHaveCount(0)
  await ficha.getByText('Ver como o leitor').click()

  // Quando a cena existe: prende a fase a ela e o nome passa a valer no fim da história.
  await fichaModo(page, 'Editar')
  const presa = page.locator('.phase-card').filter({ hasText: 'Rei do porto' })
  const cena = presa.getByRole('combobox', { name: 'A partir de' })
  await cena.selectOption((await cena.locator('option', { hasText: 'A maré volta' }).getAttribute('value'))!)
  await fichaModo(page, 'Ler')
  await expect(page.getByRole('article', { name: /Ler a ficha/ }).getByRole('heading', { level: 1 })).toHaveText('Kael I')
})
