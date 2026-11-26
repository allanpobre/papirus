import { expect, test } from './fixtures.ts'

// Pacote D (personas): abas perto do polegar no celular, e a sessão como centro da Mesa. Na Nova cara.
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem('papirus:cara-antiga', '0'))
})

test('celular: com a opção ligada, as partes do Mundo ficam embaixo, logo acima da barra', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 })
  await page.goto('/app/?exemplo=ostria')
  const areas = page.getByRole('navigation', { name: 'Áreas' })
  // A opção mora em Ajustes › Aparência.
  await areas.getByRole('button', { name: 'Menu' }).click()
  await page.getByRole('button', { name: /^Ajustes/ }).first().click()
  await page.getByRole('button', { name: /^Aparência/ }).click()
  const opcao = page.getByRole('switch', { name: /partes de cada área .* ficam embaixo/ })
  await page.getByText(/^No celular, as partes de cada área/).click()
  await expect(opcao).toBeChecked()
  await areas.getByRole('button', { name: 'Mundo' }).click()
  const partes = page.getByRole('tablist', { name: 'Partes do mundo' }).or(page.getByRole('navigation', { name: 'Partes do mundo' }))
  await expect(partes).toBeVisible()
  const caixa = (await partes.boundingBox())!
  const barra = (await areas.boundingBox())!
  expect(caixa.y + caixa.height).toBeLessThanOrEqual(barra.y + 1)
  expect(barra.y - (caixa.y + caixa.height)).toBeLessThan(20)
  // Nada passa da largura da tela.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await partes.getByRole('button', { name: /Ligações/ }).or(partes.getByRole('tab', { name: /Ligações/ })).click()
  await expect(page.getByRole('heading', { name: 'Ligações', level: 1 })).toBeAttached()
})

test('computador: no modo sessão, o Codex fica no painel do Grupo, sem trocar de aba', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.goto('/app/?exemplo=ostria')
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Mesa/ }).first().click()
  await page.getByRole('button', { name: 'Começar agora' }).click()
  await page.getByRole('button', { name: 'Começar a jogar' }).click()
  const grupo = page.getByRole('region', { name: 'Grupo', exact: true })
  await grupo.getByText(/^Codex: mostrar aos jogadores/).click()
  const codex = grupo.getByRole('region', { name: 'Codex da sessão' })
  // A sessão de exemplo já mostrou algumas coisas: conta a partir daí.
  const antes = await codex.locator('.sm-codex-list li').count()
  await codex.getByRole('combobox', { name: 'O que revelar' }).selectOption({ label: 'Mapa' })
  await codex.getByRole('combobox', { name: /^Escolher/ }).selectOption({ index: 1 })
  await codex.getByRole('button', { name: 'Revelar' }).click()
  await expect(grupo.getByText(`Codex: mostrar aos jogadores (${antes + 1} hoje)`)).toBeVisible()
  await expect(codex.locator('.sm-codex-list li')).toHaveCount(antes + 1)
})
