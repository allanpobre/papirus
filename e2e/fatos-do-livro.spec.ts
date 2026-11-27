import { openPart, escolherLivro } from './areas.ts'
import { expect, test } from './fixtures.ts'

/** O livro se escolhe no Início (nas outras áreas há só um selo): escolhe lá e volta aos fatos. */
async function irAoLivro(page: import('@playwright/test').Page, nome: RegExp) {
  await escolherLivro(page, nome)
  await openPart(page, 'Quem sabe o quê')
}

test('Quem sabe o quê com livro escolhido: "Revelados neste livro", e em cada fato em que livro e cena o leitor fica sabendo', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/app/?exemplo')
  await openPart(page, 'Quem sabe o quê')
  const fatos = page.locator('.fact-card')
  await expect(fatos.first()).toBeVisible()
  // Sem livro escolhido: o universo todo, sem os botões de recorte, e cada fato diz onde o leitor fica sabendo (com o livro, que são vários).
  const todos = await fatos.count()
  expect(todos).toBeGreaterThanOrEqual(8)
  await expect(page.getByRole('radiogroup', { name: 'Quais fatos' })).toHaveCount(0)
  await expect(fatos.first().locator('.fact-where')).toContainText(/O leitor fica sabendo em “.+”, no livro “O Mágico de Oz”\./)

  // No livro 1: todos os fatos de Oz são dele, e dizem "neste livro".
  await irAoLivro(page, /^O Mágico de Oz/)
  const recorte = page.getByRole('radiogroup', { name: 'Quais fatos' })
  await expect(recorte.getByRole('radio', { name: /^Revelados neste livro/ })).toHaveAttribute('aria-checked', 'true')
  // Só os que vêm de cenas do livro (os do autor, sem cena, ficam de fora) e todos dizem "neste livro".
  const doLivro = await fatos.count()
  expect(doLivro).toBeGreaterThanOrEqual(8)
  expect(doLivro).toBeLessThanOrEqual(todos)
  await expect(recorte.getByRole('radio', { name: new RegExp(`^Revelados neste livro ${doLivro}`) })).toBeVisible()
  for (const linha of await fatos.locator('.fact-where').allInnerTexts()) expect(linha).toContain('O leitor fica sabendo neste livro, em “')

  // No livro 3 (Ozma de Oz): nenhum fato é revelado nele; a janela explica e o botão leva a todos.
  await irAoLivro(page, /^Ozma de Oz/)
  await expect(recorte.getByRole('radio', { name: /^Revelados neste livro 0/ })).toHaveAttribute('aria-checked', 'true')
  await expect(fatos).toHaveCount(0)
  await expect(page.getByText(/Nenhum fato é revelado em “Ozma de Oz/)).toBeVisible()
  await page.getByRole('button', { name: 'Ver os fatos de todo o universo' }).click()
  await expect(recorte.getByRole('radio', { name: /^Todos os fatos/ })).toHaveAttribute('aria-checked', 'true')
  await expect(fatos).toHaveCount(todos)
  // Vistos do livro 3, os fatos do livro 1 já eram sabidos (e o que não vem de cena nenhuma é só do autor).
  const linhas = await fatos.locator('.fact-where').allInnerTexts()
  expect(linhas.filter((l) => l.includes('O leitor já sabia desde o livro “O Mágico de Oz”, em “'))).toHaveLength(doLivro)
  // Os do livro 2 também vieram antes do livro 3.
  expect(linhas.filter((l) => l.includes('O leitor já sabia desde o livro “A Maravilhosa Terra de Oz”, em “'))).toHaveLength(todos - doLivro)
  // E o recorte volta pelo botão.
  await recorte.getByRole('radio', { name: /^Revelados neste livro/ }).click()
  await expect(fatos).toHaveCount(0)

  // No livro 2 (A Maravilhosa Terra de Oz): só os dois fatos dele; nos "todos", os do livro 1 já eram sabidos.
  await irAoLivro(page, /^A Maravilhosa Terra de Oz/)
  await expect(recorte.getByRole('radio', { name: /^Revelados neste livro 2/ })).toHaveAttribute('aria-checked', 'true')
  await expect(fatos).toHaveCount(todos - doLivro)
  await recorte.getByRole('radio', { name: /^Todos os fatos/ }).click()
  const doDois = await fatos.locator('.fact-where').allInnerTexts()
  expect(doDois.filter((l) => l.includes('O leitor já sabia desde o livro “O Mágico de Oz”'))).toHaveLength(doLivro)
  expect(doDois.filter((l) => l.includes('O leitor fica sabendo neste livro'))).toHaveLength(todos - doLivro)
  // Visto do livro 1, o que vem no livro 2 só aparece depois (e em destaque).
  await irAoLivro(page, /^O Mágico de Oz/)
  await recorte.getByRole('radio', { name: /^Todos os fatos/ }).click()
  await expect(fatos.locator('.fact-where.is-later')).toHaveCount(todos - doLivro)
  await expect(fatos.locator('.fact-where.is-later').first()).toContainText('O leitor só fica sabendo no livro “A Maravilhosa Terra de Oz”, em “')

  // Voltando a "todos os livros", o recorte some.
  await irAoLivro(page, /^Todos/)
  await expect(page.getByRole('radiogroup', { name: 'Quais fatos' })).toHaveCount(0)
  await expect(fatos).toHaveCount(todos)
})
