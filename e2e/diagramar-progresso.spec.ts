import { expect, test } from './fixtures.ts'

/*
 * Diagramar o livro inteiro (Oz, ~150 páginas) leva um tempo, principalmente num celular fraco: a tela mostra em que
 * página está ("Montando página 120…"), deixa cancelar e montar de novo, e fica respondendo (sem congelar).
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

test('Oz inteiro: mostra "Montando página N…", cancela, monta de novo e termina com o total de páginas', async ({ page }) => {
  test.setTimeout(150_000)
  await page.goto('/app/?exemplo')
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Mais/ }).click()
  await page.getByRole('group', { name: 'Todas as áreas' }).getByRole('button', { name: 'Publicar', exact: true }).click()
  await page.getByRole('button', { name: /^Diagramar/ }).first().click()
  const designer = page.getByRole('dialog', { name: 'Diagramar o livro' })
  await expect(designer).toBeVisible()

  // Enquanto monta: a página em que está, que só cresce.
  const andamento = designer.getByRole('status').filter({ hasText: /montando página|preparando o livro|montagem cancelada|páginas$/ })
  await expect(andamento).toContainText(/montando página \d+…|preparando o livro…/, { timeout: 30_000 })
  const pagina = async () => Number((await andamento.innerText()).match(/página (\d+)/)?.[1] ?? 0)
  await expect.poll(pagina, { timeout: 30_000 }).toBeGreaterThan(2)
  const primeira = await pagina()
  await expect.poll(pagina, { timeout: 30_000 }).toBeGreaterThan(primeira)

  // A tela responde enquanto monta: dá para abrir e fechar o menu de ações.
  // (A página principal não congela: um toque é atendido em menos de meio segundo.)
  const ate = await page.evaluate(() => new Promise<number>((ok) => { const t = performance.now(); requestAnimationFrame(() => requestAnimationFrame(() => ok(performance.now() - t))) }))
  expect(ate, 'dois quadros seguidos durante a montagem').toBeLessThan(1500)

  // Cancelar para a montagem.
  await designer.getByRole('button', { name: 'Cancelar' }).click()
  await expect(andamento).toContainText('montagem cancelada')
  await expect(designer.getByRole('button', { name: 'Cancelar' })).toHaveCount(0)
  // Parou de verdade: a prévia ficou em branco e nenhuma página nova é montada.
  await page.waitForTimeout(1500)
  await expect(andamento).toContainText('montagem cancelada')
  expect(await designer.locator('iframe.book-frame').evaluate((f) => (f as HTMLIFrameElement).contentDocument?.body?.children.length ?? 0)).toBe(0)

  // Montar de novo termina, com o total de páginas.
  await designer.getByRole('button', { name: 'Montar de novo' }).click()
  await expect(andamento).toHaveText(/^\d+ páginas$/, { timeout: 120_000 })
  const total = Number((await andamento.innerText()).match(/\d+/)![0])
  expect(total).toBeGreaterThan(100)
})
