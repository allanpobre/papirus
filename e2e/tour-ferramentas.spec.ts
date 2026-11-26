import { expect, test } from './fixtures.ts'

// Auditoria 25, item 2: o tour completo com “Ferramentas” recolhido. O grupo abre sozinho enquanto o tour
// passa (senão o passo da Oficina apontaria para um botão que não existe) e volta a ficar recolhido depois.
test.use({ viewport: { width: 1280, height: 800 } })

test('tour completo com Ferramentas recolhido: o grupo abre, cada passo da barra tem o seu botão, e fecha depois', async ({ page, context }) => {
  test.setTimeout(120_000)
  await context.addInitScript(() => localStorage.getItem('ferr-feito') || (localStorage.setItem('papirus:rail-ferramentas', 'fechado'), localStorage.setItem('ferr-feito', '1')))
  await page.goto('/app/?exemplo=ostria')
  const barra = page.getByRole('navigation', { name: 'Áreas' })
  const grupo = barra.getByRole('button', { name: /^Ferramentas/ })
  await expect(grupo).toHaveAttribute('aria-expanded', 'false')

  await barra.getByRole('button', { name: /^Ajustes e dados/ }).click()
  await page.getByRole('button', { name: /^Menu e ajuda/ }).click()
  await page.getByRole('button', { name: 'Refazer o tour' }).click()
  await expect(page.locator('.tour-title')).toBeVisible()
  await expect(grupo).toHaveAttribute('aria-expanded', 'true')
  await page.locator('.tour-actions').getByRole('button', { name: /^Completo/ }).click()

  const vistos: string[] = []
  for (let i = 0; i < 40; i++) {
    const titulo = (await page.locator('.tour-title').innerText()).trim()
    vistos.push(titulo)
    // O passo da Oficina destaca o botão da barra: ele existe e está à vista.
    if (titulo === 'Oficina') {
      await expect(page.locator('[data-tour="nav-oficina"]')).toBeVisible()
      await expect(page.locator('[data-tour="nav-oficina"]')).toHaveCount(1)
    }
    const proximo = page.locator('.tour-actions').getByRole('button', { name: /^(Próximo|Começar)/ })
    const ultimo = (await proximo.innerText()).startsWith('Começar')
    await proximo.click()
    if (ultimo) break
  }
  expect(vistos).toContain('Oficina')
  expect(vistos.at(-1)).toBe('Pronto!')
  await expect(page.locator('.tour-title')).toHaveCount(0)
  // Fechado o tour, o grupo volta a ficar como a pessoa deixou: recolhido.
  await expect(grupo).toHaveAttribute('aria-expanded', 'false')
})
