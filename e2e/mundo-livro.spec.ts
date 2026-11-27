import { expect, test } from './fixtures.ts'

/*
 * Nova cara: mundo → livro. No Início, as capas ("Em qual livro você vai trabalhar?"); em todas as telas, a
 * faixa fixa diz o mundo e o livro, e "Trocar livro" abre as capas. No celular.
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

test('escolher o livro pelas capas e ver sempre em qual se está', async ({ page }) => {
  await page.addInitScript(() => {
    const prefs = JSON.parse(localStorage.getItem('papirus:prefs') ?? '{}')
    localStorage.setItem('papirus:prefs', JSON.stringify({ ...prefs, novaCara: true }))
  })
  // As capas no Início são do computador; no celular elas ficam no “Trocar livro” da faixa (o Continuar vem primeiro).
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/app/?exemplo')
  const capas = page.getByRole('region', { name: 'Em qual livro você vai trabalhar?' }).getByRole('radiogroup', { name: 'Livros deste mundo' })
  await expect(capas.getByRole('radio', { name: /Todos os livros/ })).toHaveAttribute('aria-checked', 'true')
  await capas.getByRole('radio', { name: /^O Mágico de Oz/ }).click()
  await expect(capas.getByRole('radio', { name: /^O Mágico de Oz/ })).toHaveAttribute('aria-checked', 'true')

  // Em outra área, a faixa diz o mundo e o livro.
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Mundo', exact: true }).click()
  const faixa = page.getByRole('region', { name: 'Livro atual' })
  await expect(faixa).toContainText('O Mágico de Oz')
  // Trocar livro: as capas numa janela; escolher fecha e a faixa muda.
  await faixa.getByRole('button', { name: 'Trocar livro' }).click()
  const janela = page.getByRole('dialog', { name: 'Trocar de livro' })
  await janela.getByRole('radio', { name: /^Ozma de Oz/ }).click()
  await expect(janela).toHaveCount(0)
  await expect(faixa).toContainText('Ozma de Oz')
  // O seletor antigo não aparece com a Nova cara.
  await expect(page.getByLabel('Livro', { exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
