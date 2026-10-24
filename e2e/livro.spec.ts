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

  // Fica guardado no universo.
  await designer.getByRole('button', { name: 'Fechar' }).click()
  await page.getByRole('button', { name: 'Ajustes e dados' }).click()
  await page.getByRole('navigation', { name: 'Categorias dos ajustes' }).getByRole('button', { name: 'Livros' }).click()
  await page.getByRole('button', { name: 'Diagramar o livro' }).click()
  await expect(designer.getByRole('img', { name: 'Capa escolhida' })).toBeVisible()
  await designer.locator('summary', { hasText: /^Capítulos$/ }).click()
  await expect(designer.getByRole('radio', { name: 'Capítulo Um' })).toHaveAttribute('aria-checked', 'true')
})
