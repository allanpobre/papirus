import { expect, test } from './fixtures.ts'
import { fichaModo } from './areas.ts'

// As versões do personagem nascem e se veem na própria ficha: barra "Versões", "+ Nova versão", ver e editar.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

test('criar, ver e editar uma versão do personagem pela própria ficha', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await page.getByRole('button', { name: 'Mundo', exact: true }).first().click()
  await page.getByRole('region', { name: 'Lista de fichas' }).getByRole('button', { name: /^Kael/ }).first().click()
  await fichaModo(page, 'Ler')
  const ficha = page.getByRole('article', { name: /Ler a ficha/ })
  const barra = ficha.getByRole('region', { name: 'Versões' })

  // Nova versão, planejada, com nome, posto novo e um campo que só existe nela.
  await barra.getByRole('button', { name: /Nova versão/ }).click()
  const nova = page.getByRole('dialog', { name: 'Nova versão de Kael' })
  await nova.getByRole('textbox', { name: 'Nome da versão' }).fill('Rei do porto')
  await nova.getByRole('textbox', { name: 'Quando' }).fill('Livro 2')
  await nova.getByRole('textbox', { name: 'Chamado' }).fill('Kael I')
  await nova.getByRole('button', { name: /Campo que só existe nesta versão/ }).click()
  await nova.getByRole('textbox', { name: 'Campo novo', exact: true }).fill('Coroa')
  await nova.getByRole('textbox', { name: 'Valor de Coroa' }).fill('De vidro negro')
  await nova.getByRole('button', { name: 'Criar versão' }).click()

  // A ficha mostra a versão nova inteira, com o aviso.
  await expect(ficha.getByRole('heading', { level: 1 })).toHaveText('Kael I')
  await expect(ficha.getByRole('status').filter({ hasText: 'Vendo a versão' })).toContainText('Rei do porto')
  await expect(ficha).toContainText('De vidro negro')
  await expect(barra.getByRole('button', { name: /Kael I/ })).toHaveAttribute('aria-pressed', 'true')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  // O começo, e voltar para agora (a planejada não vale na história).
  await barra.getByRole('button', { name: 'O começo' }).click()
  await expect(ficha.getByRole('heading', { level: 1 })).toHaveText('Kael')
  await barra.getByRole('button', { name: /Kael I/ }).click()
  await ficha.getByRole('button', { name: 'Voltar para agora' }).click()
  await expect(ficha.getByRole('heading', { level: 1 })).toHaveText('Kael')

  // Editar a versão: prender a uma cena. Ela passa a valer na história (a régua está no fim).
  await barra.getByRole('button', { name: /Kael I/ }).click()
  await ficha.getByRole('button', { name: 'Editar esta versão' }).click()
  const editar = page.getByRole('dialog', { name: /Versão: Rei do porto/ })
  await expect(editar.getByRole('textbox', { name: 'Coroa nesta versão' })).toHaveValue('De vidro negro')
  const cena = editar.getByRole('combobox', { name: 'A partir de' })
  await cena.selectOption((await cena.locator('option', { hasText: 'A maré volta' }).getAttribute('value'))!)
  await editar.getByRole('button', { name: 'Guardar' }).click()
  await expect(barra.getByRole('button', { name: /Kael I/ })).toContainText('A maré volta')
  await ficha.getByRole('button', { name: 'Voltar para agora' }).click()
  await expect(ficha.getByRole('heading', { level: 1 })).toHaveText('Kael I')
})
