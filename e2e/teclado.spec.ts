import { expect, test } from './fixtures.ts'

// Pacote C (personas, teclado): atalhos para quem vem do Notion/Obsidian. No computador, na Nova cara.
test.use({ viewport: { width: 1280, height: 800 } })

test('“?” mostra os atalhos; Alt+número troca de área; [ e ] trocam de parte', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await expect(page.getByRole('navigation', { name: 'Áreas' })).toBeVisible()
  await page.locator('body').click({ position: { x: 640, y: 5 } })
  await page.keyboard.press('Shift+?')
  const janela = page.getByRole('dialog', { name: 'Atalhos de teclado' })
  await expect(janela).toContainText('Próxima parte')
  await page.keyboard.press('Escape')
  await expect(janela).toBeHidden()

  // A ordem do menu: Início é o 1.
  await page.keyboard.press('Alt+1')
  await expect(page.locator('.shell')).toHaveAttribute('data-view', 'inicio')
  const fichas = page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Mundo|^Fichas/ }).first()
  await fichas.click()
  await expect(page.getByRole('heading', { name: 'Fichas', level: 1 })).toBeVisible()
  const antes = 'fichas'
  await page.keyboard.press(']')
  await expect(page.getByRole('heading', { name: 'Ligações', level: 1 })).toBeVisible()
  await page.keyboard.press('[')
  await expect(page.locator('.shell')).toHaveAttribute('data-view', antes!)
})

test('na lista de fichas, J e K andam; E alterna ler e editar; dentro de um campo, nada acontece', async ({ page, context }) => {
  await context.addInitScript(() => localStorage.setItem('papirus:ficha-vista', 'ler'))
  await page.goto('/app/?exemplo=ostria')
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Mundo|^Fichas/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Fichas', level: 1 })).toBeVisible()
  const pagina = page.getByRole('article', { name: /^Ler a ficha/ })
  await page.keyboard.press('j')
  await expect(pagina).toBeVisible()
  const primeira = (await pagina.getAttribute('aria-label'))!
  await page.keyboard.press('j')
  await expect(pagina).not.toHaveAttribute('aria-label', primeira)
  await page.keyboard.press('k')
  await expect(pagina).toHaveAttribute('aria-label', primeira)

  // E: para editar e de volta à página.
  await page.keyboard.press('e')
  await expect(page.getByRole('button', { name: 'Ver a página' })).toBeVisible()
  await expect(pagina).toHaveCount(0)
  await page.keyboard.press('e')
  await expect(pagina).toHaveAttribute('aria-label', primeira)

  // Num campo, as letras são só letras.
  const busca = page.getByRole('textbox', { name: 'Filtrar fichas' })
  await busca.press('j')
  await expect(busca).toHaveValue('j')
  await busca.fill('')
  await expect(pagina).toHaveAttribute('aria-label', primeira)
})

test('a busca (Ctrl+K) acha “atalhos”', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await expect(page.getByRole('navigation', { name: 'Áreas' })).toBeVisible()
  await page.keyboard.press('Control+k')
  await page.getByRole('combobox', { name: 'Buscar no universo' }).fill('atalhos')
  await page.getByRole('option', { name: /Ver os atalhos de teclado/ }).click()
  await expect(page.getByRole('dialog', { name: 'Atalhos de teclado' })).toBeVisible()
})
