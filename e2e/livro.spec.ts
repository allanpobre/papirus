import { expect, test } from './fixtures.ts'

test.setTimeout(90_000)

test('diagramar o livro: modelo, capa do autor, prévia paginada com sumário', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await expect(page.getByRole('button', { name: 'Ler como leitor' })).toBeVisible()
  await page.keyboard.press('Control+k')
  await page.getByRole('combobox', { name: 'Buscar no universo' }).fill('diagramar')
  await page.keyboard.press('Enter')
  const designer = page.getByRole('dialog', { name: 'Diagramar o livro' })
  await expect(designer.locator('.book-top-title').getByText(/\d+ páginas/)).toBeVisible({ timeout: 30_000 })

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
  await page.locator('[data-tour="livro-acoes"]').getByRole('button', { name: 'Diagramar', exact: true }).click()
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

  // Próximo volume: mesmo estilo (no "⋯" do livro).
  await page.getByRole('button', { name: /^Mais de / }).click()
  await page.getByRole('button', { name: 'Próximo volume, com o mesmo estilo' }).click()
  await page.getByRole('textbox', { name: 'Título' }).fill('Livro II — A Torre')
  await expect(page.getByRole('combobox', { name: 'Estilo' })).toHaveValue(/.+/)
  await page.getByRole('button', { name: 'Criar livro' }).click()
  const estante = page.getByRole('listbox', { name: 'Estante' })
  await expect(estante.getByRole('option')).toHaveCount(2)
  await expect(page.getByRole('region', { name: 'Livro Livro II — A Torre' })).toContainText('capítulos em estilo ornamentado')

  // E-book com a cara do livro, pelo "Baixar".
  const download = page.waitForEvent('download')
  await page.locator('[data-tour="livro-acoes"]').getByRole('button', { name: 'Baixar' }).click()
  await page.getByRole('button', { name: /^E-book \(EPUB\)/ }).click()
  expect((await download).suggestedFilename()).toMatch(/\.epub$/)
  // E em Word, o livro como ele é.
  const word = page.waitForEvent('download')
  await page.locator('[data-tour="livro-acoes"]').getByRole('button', { name: 'Baixar' }).click()
  await page.getByRole('button', { name: /^Word/ }).click()
  expect((await word).suggestedFilename()).toBe('livro-ii-a-torre.docx')

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
  // O caminho diz o que o Papirus arruma sozinho.
  const path = page.getByRole('list', { name: 'Do manuscrito ao livro' })
  await expect(path).toContainText('Reticências: o Papirus arruma sozinho')
  await path.getByRole('button', { name: 'Revisar' }).click()
  const review = page.getByRole('dialog', { name: /^Revisar/ })
  const fix = review.getByRole('region', { name: 'O Papirus arruma' })
  await expect(fix).toContainText('Reticências com três pontos')
  await fix.getByRole('button', { name: 'Arrumar tudo' }).click()
  await expect(review.getByRole('region', { name: 'O Papirus arruma' })).toHaveCount(0)
  await expect(page.getByText(/Tipografia arrumada em 1 cena/)).toBeVisible()

  // Vale olhar, cena a cena: abrir a cena a partir do Revisar.
  const scene = review.locator('.review-scene', { hasText: 'A chegada' })
  await scene.locator('summary').click()
  await scene.getByRole('button', { name: 'Abrir a cena' }).click()
  await expect(page.getByRole('textbox', { name: 'Texto da cena' })).toContainText('— Espere… — disse Mira.')

  // As palavras repetidas, com quantas vezes; uma que é tema do livro pode ser ignorada.
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Livro', exact: true }).click()
  await path.getByRole('button', { name: 'Revisar' }).click()
  const top = review.locator('.review-scene').first()
  await top.locator('summary').click()
  const word = top.locator('.review-word').first()
  await expect(word).toContainText(/×\d+/)
  const name = (await word.innerText()).split(/\s/)[0]
  await word.getByRole('button', { name: /^Ignorar/ }).click()
  await expect(page.getByText(`“${name}” não conta mais como repetição neste livro.`)).toBeVisible()
  await expect(review).toContainText(`Ignoradas neste livro: ${name}.`)
})

test('o caminho do livro: passos, um Baixar só, leitores, capa para gráfica e "Também de"', async ({ page }) => {
  await page.goto('/app/?exemplo')
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Livro', exact: true }).click()

  // Cinco passos, cada um com o que achou.
  const path = page.getByRole('list', { name: 'Do manuscrito ao livro' })
  await expect(path.getByRole('listitem')).toHaveCount(5)
  await expect(path).toContainText('13 capítulos')
  await expect(path).toContainText('cenas para olhar')
  // As explicações ficam só com a estante vazia; o cartão de exportar repetido saiu.
  await expect(page.locator('.book-how')).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: 'História' })).toHaveCount(0)

  // Leitores: no exemplo, não há (fica só neste aparelho).
  await path.getByRole('button', { name: 'Ver', exact: true }).click()
  await expect(page.getByRole('dialog', { name: /^O que os leitores disseram/ })).toContainText('No exemplo, não há leitores')
  await page.keyboard.press('Escape')

  // Texto (.md) do livro, com o título e a autoria da capa.
  const md = page.waitForEvent('download')
  await page.locator('[data-tour="livro-acoes"]').getByRole('button', { name: 'Baixar' }).click()
  await page.getByRole('button', { name: /^Texto \(\.md\)/ }).click()
  const file = await md
  expect(file.suggestedFilename()).toBe('o-alienista.md')

  // Capa para gráfica: abre a diagramação na parte certa, com a lombada, e baixa o molde.
  await page.locator('[data-tour="livro-acoes"]').getByRole('button', { name: 'Baixar' }).click()
  await page.getByRole('button', { name: /^Capa para gráfica/ }).click()
  const designer = page.getByRole('dialog', { name: 'Diagramar o livro' })
  await expect(designer.locator('.book-top-title').getByText(/\d+ páginas/)).toBeVisible({ timeout: 30_000 })
  await expect(designer.locator('.book-wrap-size')).toContainText(/Lombada\s*\d+(,\d)? mm/)
  const svg = page.waitForEvent('download')
  await designer.getByRole('button', { name: 'Baixar o molde da capa (SVG)' }).click()
  expect((await svg).suggestedFilename()).toMatch(/^molde-da-capa-o-alienista\.svg$/)
  // A linha do texto em caracteres, com a referência de Bringhurst.
  await designer.locator('summary', { hasText: /^Texto$/ }).click()
  await expect(designer.getByText(/Cerca de \d+ caracteres por linha/)).toBeVisible()
  await designer.getByRole('button', { name: 'Fechar' }).click()

  // Um segundo livro: o primeiro ganha a página "Também de" no fim.
  await page.getByRole('button', { name: 'Novo livro' }).click()
  await page.getByRole('textbox', { name: 'Título' }).fill('Papéis avulsos')
  await page.getByRole('button', { name: 'Criar livro' }).click()
  await page.getByRole('listbox', { name: 'Estante' }).getByRole('option', { name: /O Alienista/ }).click()
  await page.locator('[data-tour="livro-acoes"]').getByRole('button', { name: 'Diagramar', exact: true }).click()
  await designer.locator('summary', { hasText: /^Também de$/ }).click()
  await expect(designer.getByText('Papéis avulsos', { exact: true })).toBeVisible()
  const preview = page.frameLocator('iframe[title="Prévia do livro"]')
  await expect(preview.locator('.also-by')).toContainText('Também de Machado de Assis', { timeout: 30_000 })
  await expect(preview.locator('.also-by li')).toHaveText(['Papéis avulsos'])
})

test('importar pelo Livro: o texto vira uma história nova', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Livro', exact: true }).click()
  await page.getByRole('button', { name: 'Importar' }).click()
  await page.getByLabel('Arquivo do livro').setInputFiles({ name: 'sal.md', mimeType: 'text/markdown', buffer: Buffer.from('# O Sal\n\n## Chegada\n\nKael desceu.\n') })
  await expect(page.getByText('“O Sal” importado em 1 cena.')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Importar um texto' })).toHaveCount(0)
})
