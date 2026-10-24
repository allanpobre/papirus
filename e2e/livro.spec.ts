import { expect, test } from './fixtures.ts'

test.setTimeout(90_000)

test('diagramar o livro: modelo, capa do autor, prévia paginada com sumário', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
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

test('estante: segundo volume com o mesmo estilo do primeiro', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Livro', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Seu primeiro livro' })).toBeVisible()
  await page.getByRole('button', { name: 'Criar o livro' }).click()
  const designer = page.getByRole('dialog', { name: 'Diagramar o livro' })
  await designer.getByRole('button', { name: /^Fantasia/ }).click()
  await designer.getByRole('button', { name: 'Fechar' }).click()

  // Próximo volume: mesmo estilo.
  await page.getByRole('button', { name: 'Próximo volume' }).click()
  await page.getByRole('textbox', { name: 'Título' }).fill('Livro II — A Torre')
  await expect(page.getByRole('combobox', { name: 'Estilo' })).toHaveValue(/.+/)
  await page.getByRole('button', { name: 'Criar livro' }).click()
  const estante = page.getByRole('listbox', { name: 'Estante' })
  await expect(estante.getByRole('option')).toHaveCount(2)
  await expect(page.getByRole('region', { name: 'Livro Livro II — A Torre' })).toContainText('capítulos em estilo ornamentado')

  // E-book com a cara do livro.
  const download = page.waitForEvent('download')
  await page.getByRole('region', { name: 'Livro Livro II — A Torre' }).getByRole('button', { name: 'E-book' }).click()
  expect((await download).suggestedFilename()).toMatch(/\.epub$/)

  // Cada livro tem a sua diagramação.
  await estante.getByRole('option', { name: /Livro I — A Maré Volta/ }).click()
  await expect(page.getByRole('region', { name: 'Livro Livro I — A Maré Volta' })).toBeVisible()
})

test('revisar antes de publicar: aponta e corrige a tipografia com desfazer', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  // "- " no começo da fala vira travessão enquanto se digita (e não uma lista).
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Escrever' }).click()
  const text = page.getByRole('textbox', { name: 'Texto da cena' })
  await text.click()
  await page.keyboard.press('Control+End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('- Espere... - disse Mira.')
  await expect(text).toContainText('— Espere... — disse Mira.')
  await expect(text.locator('ul')).toHaveCount(0)
  await expect(page.getByRole('status').filter({ hasText: 'Salvo' }).first()).toBeVisible()

  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Livro', exact: true }).click()
  await page.getByRole('button', { name: 'Criar o livro' }).click()
  await page.getByRole('dialog', { name: 'Diagramar o livro' }).getByRole('button', { name: 'Fechar' }).click()
  await page.getByRole('button', { name: 'Revisar' }).click()
  const review = page.getByRole('dialog', { name: /^Revisar/ })
  await expect(review).toContainText('Reticências com três pontos')
  await expect(review).toContainText('Palavras repetidas perto')
  const dots = review.locator('details', { hasText: 'Reticências' })
  await dots.evaluate((el) => ((el as HTMLDetailsElement).open = true))
  await dots.getByRole('button', { name: 'Corrigir no livro todo' }).click()
  await expect(review).not.toContainText('Reticências com três pontos')
  await expect(page.getByText(/corrigido em 1 cena/)).toBeVisible()

  // Ir para a cena a partir de um apontamento.
  const reps = review.locator('details', { hasText: 'Palavras repetidas' })
  await reps.evaluate((el) => ((el as HTMLDetailsElement).open = true))
  await reps.getByRole('button').filter({ hasText: 'A chegada' }).first().click()
  await expect(page.getByRole('textbox', { name: 'Texto da cena' })).toContainText('— Espere… — disse Mira.')
})
