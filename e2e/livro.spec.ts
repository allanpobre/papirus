import { expect, test } from './fixtures.ts'

test.setTimeout(90_000)

test('diagramar o livro: modelo, capa do autor, prévia paginada com sumário', async ({ page }) => {
  await page.goto('/app/?exemplo')
  await expect(page.getByRole('button', { name: 'Ler como leitor' })).toBeVisible()
  await page.keyboard.press('Control+k')
  await page.getByRole('combobox', { name: 'Buscar no universo' }).fill('diagramar')
  await page.keyboard.press('Enter')
  const designer = page.getByRole('dialog', { name: 'Diagramar o livro' })
  await expect(designer.getByText(/\d+ páginas/)).toBeVisible({ timeout: 30_000 })

  const preview = page.frameLocator('iframe[title="Prévia do livro"]')
  await expect(preview.locator('.pagedjs_page').first()).toBeVisible()
  await expect(preview.locator('.chapter-title', { hasText: 'A chegada' })).toBeVisible()
  // Sumário com números de página vindos da paginação.
  await expect(preview.locator('.toc li').first()).toBeVisible()

  // Modelo "Fantasia": capítulo por extenso.
  await designer.getByRole('button', { name: /^Fantasia/ }).click()
  await expect(preview.locator('.chapter-label', { hasText: 'Capítulo Um' })).toBeVisible({ timeout: 30_000 })

  // A capa é do autor.
  await designer.getByLabel('Imagem da capa').setInputFiles({
    name: 'capa.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAIAAAA2iEnWAAAAEklEQVR4nGNgYGD4z8DAwMAAAA8AAf8k0R0AAAAASUVORK5CYII=', 'base64'),
  })
  await expect(designer.getByRole('img', { name: 'Capa escolhida' })).toBeVisible()
  await expect(preview.locator('.cover img')).toBeVisible({ timeout: 30_000 })

  // Símbolos à escolha: ornamento do capítulo e quebra de cena personalizada.
  await designer.locator('summary', { hasText: /^Capítulos$/ }).click()
  await designer.getByRole('radiogroup', { name: 'Ornamento acima do capítulo' }).getByRole('radio', { name: '⚜' }).click()
  await expect(preview.locator('.chapter-ornament', { hasText: '⚜' }).first()).toBeVisible({ timeout: 30_000 })
  await designer.locator('summary', { hasText: /^Quebra de cena$/ }).click()
  await designer.getByRole('radio', { name: 'Outro símbolo…' }).click()
  await designer.getByRole('textbox', { name: 'Símbolo da quebra de cena: outro símbolo' }).fill('🜂')
  await expect(preview.locator('.scene-break', { hasText: '🜂' }).first()).toBeVisible({ timeout: 30_000 })

  // Fica guardado no universo; e o livro tem lugar próprio no menu.
  await designer.getByRole('button', { name: 'Fechar' }).click()
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Livro', exact: true }).click()
  await expect(page.getByRole('img', { name: /^Capa de / })).toBeVisible()
  await page.getByRole('button', { name: 'Diagramar e gerar PDF' }).click()
  await expect(designer.getByRole('img', { name: 'Capa escolhida' })).toBeVisible()
  await designer.locator('summary', { hasText: /^Capítulos$/ }).click()
  await expect(designer.getByRole('radio', { name: 'Capítulo Um' })).toHaveAttribute('aria-checked', 'true')
  await expect(designer.getByRole('radiogroup', { name: 'Ornamento acima do capítulo' }).getByRole('radio', { name: '⚜' })).toHaveAttribute('aria-checked', 'true')
})
