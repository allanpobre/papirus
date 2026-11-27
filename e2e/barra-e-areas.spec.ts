import { expect, test } from './fixtures.ts'

// Auditoria 24, pacote 4: a barra lateral do computador (Ferramentas num grupo que se recolhe, Oficina como item
// comum) e a cor da área aberta num filete no alto da tela.
test.use({ viewport: { width: 1280, height: 800 } })

test('Ferramentas num grupo com nome: recolhe, lembra e a Oficina é um item comum', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  const barra = page.getByRole('navigation', { name: 'Áreas' })
  const grupo = barra.getByRole('button', { name: /^Ferramentas/ })
  await expect(grupo).toHaveAttribute('aria-expanded', 'true')
  for (const nome of ['Ideias', 'Perguntar ao mundo', 'Oficina', 'Guia']) await expect(barra.getByRole('button', { name: new RegExp(`^${nome}`) })).toBeVisible()
  // A Oficina deixou de ser um cartão colorido: é um botão como os outros (sem a linha “Dicas, livros e exercícios”).
  await expect(barra.getByText('Dicas, livros e exercícios')).toHaveCount(0)
  await expect(barra.locator('.oficina-card')).toHaveCount(0)

  // Recolher: os itens somem, o “Ajustes e dados” fica, e depois de recarregar continua recolhido.
  await grupo.click()
  await expect(grupo).toHaveAttribute('aria-expanded', 'false')
  await expect(barra.getByRole('button', { name: /^Guia/ })).toHaveCount(0)
  await expect(barra.getByRole('button', { name: /^Ajustes e dados/ })).toBeVisible()
  await page.reload()
  await expect(barra.getByRole('button', { name: /^Ferramentas/ })).toHaveAttribute('aria-expanded', 'false')
  // Abrir uma delas pelo atalho mantém o grupo aberto enquanto ela está aberta.
  await barra.getByRole('button', { name: /^Ferramentas/ }).click()
  await barra.getByRole('button', { name: /^Guia/ }).click()
  await barra.getByRole('button', { name: /^Ferramentas/ }).click()
  await expect(barra.getByRole('button', { name: /^Guia/ })).toBeVisible()
})

test('cada área tem a sua cor no alto da tela', async ({ page }) => {
  await page.goto('/app/')
  await page.getByRole('textbox', { name: 'Nome do novo universo' }).fill('Cores')
  await page.getByRole('button', { name: 'Criar universo' }).click()
  const barra = page.getByRole('navigation', { name: 'Áreas' })
  const cor = () => page.locator('.stage').evaluate((el) => getComputedStyle(el).boxShadow)
  await barra.getByRole('button', { name: 'Mundo', exact: true }).click()
  const mundo = await cor()
  await barra.getByRole('button', { name: 'História' }).click()
  const trama = await cor()
  expect(mundo).toContain('inset')
  expect(trama).toContain('inset')
  expect(mundo).not.toBe(trama)
  // O filete não ocupa espaço: é sombra por dentro.
  expect(await page.locator('.stage').evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe('0px')
})
