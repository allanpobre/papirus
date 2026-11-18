import { expect, test, type Page } from './fixtures.ts'
import { fichaModo } from './areas.ts'

/*
 * As fases: o personagem muda ao longo da história. No celular, o autor cria uma fase (a partir de uma cena,
 * o que muda e por quê), e a ficha muda com a régua; "comparar" mostra o que mudou.
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
const ate = async (page: Page, cena: string | null) => {
  const sel = page.getByRole('group', { name: 'Ponto da história' }).getByRole('combobox', { name: 'Até onde na história' })
  await sel.selectOption(cena ? (await sel.locator('option', { hasText: cena }).getAttribute('value'))! : '')
}

test('uma fase muda nome e campos a partir de uma cena, e dá para comparar', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await page.getByRole('button', { name: 'Mundo', exact: true }).first().click()
  await page.getByRole('region', { name: 'Lista de fichas' }).getByRole('button', { name: /^Kael/ }).first().click()
  await fichaModo(page, 'Editar')

  await page.getByText('Ao longo da história', { exact: true }).click()
  await page.getByRole('button', { name: 'Nova fase' }).click()
  const fase = page.locator('.phase-card').first()
  const cena = fase.getByRole('combobox', { name: 'A partir de' })
  await cena.selectOption((await cena.locator('option', { hasText: 'Duas portas' }).getAttribute('value'))!)
  await fase.getByRole('textbox', { name: 'Nome da fase' }).fill('Procurado')
  await fase.getByRole('textbox', { name: 'Por quê' }).fill('Viu o regente')
  await fase.getByRole('textbox', { name: 'Passa a ser chamado' }).fill('O Fugitivo')
  await fase.getByRole('button', { name: 'Campo que muda' }).click()
  await fase.getByRole('combobox', { name: 'Campo', exact: true }).fill('Medo')
  await fase.getByRole('textbox', { name: 'Novo valor de Medo' }).fill('O regente')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  // Ler, na história toda: como ele termina, com a fase de agora.
  await fichaModo(page, 'Ler')
  const ficha = page.getByRole('article', { name: /Ler a ficha/ })
  await expect(ficha.getByRole('heading', { level: 1 })).toHaveText('O Fugitivo')
  await expect(ficha.locator('.phase-now')).toContainText('Procurado desde “Duas portas” · Viu o regente')
  await expect(ficha.getByRole('complementary', { name: 'Em resumo' })).toContainText('O regente')
  const linha = ficha.getByRole('region', { name: 'Ao longo da história' })
  await expect(linha.locator('.phase-line li.is-current')).toContainText('Procurado')
  const mudou = linha.getByRole('list', { name: 'O que mudou' })
  await expect(mudou).toContainText('Kael')
  await expect(mudou).toContainText('O Fugitivo')
  await expect(mudou).toContainText('O regente')

  // Antes da fase: como ele começa.
  await ate(page, 'A chegada')
  await expect(ficha.getByRole('heading', { level: 1 })).toHaveText('Kael')
  await expect(ficha.locator('.phase-now')).toHaveCount(0)
  await expect(linha.locator('.phase-line li.is-current')).toContainText('O começo')
  // Como o leitor, antes da fase: ela nem aparece.
  await page.getByRole('group', { name: 'Ponto da história' }).getByText('Ver como o leitor').click()
  await expect(ficha.getByRole('region', { name: 'Ao longo da história' })).toHaveCount(0)
  await expect(ficha).not.toContainText('O Fugitivo')
})
