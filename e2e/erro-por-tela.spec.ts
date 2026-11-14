import { expect, test } from './fixtures.ts'

/*
 * Se uma tela quebrar, só ela mostra "Esta parte deu erro": o menu, o resto do app e o universo continuam.
 * O erro é de verdade: o código da tela Mundo (Fichas) não carrega, como numa falha de rede ou numa versão publicada pela metade.
 */
test('uma tela que quebra não derruba o app: o menu continua e o universo fica como estava', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/app/?exemplo')
  const menu = page.getByRole('navigation', { name: 'Áreas' })
  await expect(menu.getByRole('button', { name: /^Mundo/ })).toBeVisible()

  // O código da tela das Fichas deixa de chegar.
  await page.route(/EntitiesView\.tsx/, (route) => route.abort())
  await menu.getByRole('button', { name: /^Mundo/ }).click()
  const aviso = page.getByRole('alert').filter({ hasText: 'Esta parte deu erro' })
  await expect(aviso).toBeVisible()
  await expect(aviso.getByRole('button', { name: 'Voltar ao Início' })).toBeVisible()

  // O menu continua funcionando: outra área abre normalmente.
  await menu.getByRole('button', { name: /^Escrever/ }).click()
  await expect(aviso).toHaveCount(0)
  await expect(page.getByRole('tab', { name: /Página|Estrutura|Revisão/ }).first().or(page.locator('.view.write'))).toBeVisible()

  // De volta à tela que quebrou: o aviso aparece de novo, com um jeito de copiar os detalhes.
  await menu.getByRole('button', { name: /^Mundo/ }).click()
  await expect(aviso).toBeVisible()
  await aviso.getByRole('button', { name: 'Copiar detalhes' }).click()
  await expect(aviso.getByRole('button', { name: 'Copiado' })).toBeVisible()
  const copiado = await page.evaluate(() => navigator.clipboard.readText())
  expect(copiado).toContain('Esta parte deu erro')
  expect(copiado).toContain('Erro:')

  // "Voltar ao Início" leva ao Início, e o universo continua lá, inteiro.
  await aviso.getByRole('button', { name: 'Voltar ao Início' }).click()
  await expect(aviso).toHaveCount(0)
  await expect(page.getByText('Exemplo — Terra de Oz').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: /Exemplo — Terra de Oz/ }).first()).toBeVisible()

  // E, depois de recarregar, tudo está salvo como estava (o erro não escreveu nada).
  await page.unroute(/EntitiesView\.tsx/)
  await page.reload()
  await menu.getByRole('button', { name: /^Mundo/ }).click()
  await expect(page.locator('.entity-row-name', { hasText: 'Dorothy' }).first()).toBeVisible()
})
