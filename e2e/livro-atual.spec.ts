import { expect, test, type Locator, type Page } from './fixtures.ts'
import { openPart } from './areas.ts'

const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: new RegExp(`^${name}`) }).first()
const book = (page: Page) => page.getByLabel('Livro', { exact: true })
/** O livro 3 do exemplo (com ou sem "(trechos)" no nome, conforme a versão do exemplo). */
const OZMA = /^Ozma de Oz/

/** Escolhe um livro pelo começo do nome. */
async function pick(select: Locator, name: RegExp) {
  await select.selectOption((await select.locator('option', { hasText: name }).first().getAttribute('value'))!)
}

/** Abre uma área pelo "Mais" do celular. */
async function viaMore(page: Page, area: string) {
  await page.getByRole('button', { name: 'Mais', exact: true }).click()
  await page.getByRole('group', { name: 'Todas as áreas' }).getByRole('button', { name: area, exact: true }).click()
}

test.describe('o livro escolhido no alto', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('Início, Escrever, Fichas e Publicar seguem o livro, e a escolha fica guardada', async ({ page }) => {
    await page.goto('/app/?exemplo')
    // No Início, a faixa está no alto; o "onde você parou" passa a ser do livro.
    await expect(book(page)).toHaveValue('')
    await pick(book(page), OZMA)
    await expect(page.getByText(/^Ozma de Oz.* · onde você parou$/)).toBeVisible()

    // Escrever: no celular a faixa não cabe; o livro fica no topo da lista de cenas.
    await nav(page, 'Escrever').click()
    await expect(page.locator('.book-bar')).toHaveCount(0)
    await expect(page.getByText(/^Ozma de Oz.* · cena 1 de/).filter({ visible: true }).first()).toBeVisible()
    await page.getByRole('button', { name: 'Mostrar manuscrito' }).click()
    const tree = page.getByRole('complementary', { name: 'Manuscrito' })
    await expect(tree.getByLabel('Livro', { exact: true })).toHaveValue(/.+/)
    await expect(tree.getByRole('textbox', { name: 'Título da história' })).toHaveCount(1)
    await expect(tree.getByRole('textbox', { name: 'Título da história' })).toHaveValue(OZMA)
    await page.keyboard.press('Escape')

    // Fichas: só quem aparece no livro, com um jeito de ver todas.
    await openPart(page, 'Fichas')
    const list = page.getByRole('region', { name: 'Lista de fichas' }).locator('li')
    await expect(page.getByText(/^Só quem aparece em “Ozma de Oz/)).toBeVisible()
    const inBook = await list.count()
    await page.getByRole('button', { name: 'Ver todas as fichas' }).click()
    await expect.poll(() => list.count()).toBeGreaterThan(inBook)

    // Guardado: depois de recarregar, o livro continua escolhido.
    await page.reload()
    await expect(book(page).locator('option:checked')).toHaveText(OZMA)

    // Todos os livros (pela lista de cenas): o manuscrito volta a ter todas as histórias.
    await nav(page, 'Escrever').click()
    await page.getByRole('button', { name: 'Mostrar manuscrito' }).click()
    await tree.getByLabel('Livro', { exact: true }).selectOption({ label: 'Todos os livros' })
    await expect.poll(() => tree.getByRole('textbox', { name: 'Título da história' }).count()).toBeGreaterThan(2)
  })

  test('Publicar abre o volume do livro escolhido', async ({ page }) => {
    await page.goto('/app/?exemplo')
    await pick(book(page), OZMA)
    await viaMore(page, 'Publicar')
    // O volume da estante que tem essa história (o título do volume é o do livro).
    await expect(page.locator('.book-hero-info h2')).toHaveText('Ozma de Oz')
  })

  test('Estrutura, Trama, Quem sabe o quê, Linha do tempo e Mapas ficam no livro', async ({ page }) => {
    await page.goto('/app/?exemplo')

    // Linha do tempo: com todos os livros, conta as cenas; com um livro, há menos.
    await openPart(page, 'Linha do tempo')
    const scenes = page.locator('.tl-scene:not(.tl-session)')
    await expect(scenes.first()).toBeVisible()
    const allScenes = await scenes.count()
    await pick(book(page), OZMA)
    await expect.poll(() => scenes.count()).toBeLessThan(Math.max(1, allScenes))

    // Quem sabe o quê: o fim é o fim deste livro.
    await openPart(page, 'Quem sabe o quê')
    await page.getByRole('tab', { name: 'Por personagem' }).click()
    await expect(page.locator('option', { hasText: 'Ao final deste livro' })).toBeAttached()

    // Trama: a tela abre com o livro (as tramas sem cena continuam).
    await openPart(page, 'Pistas e mistérios')
    await expect(book(page).locator('option:checked')).toHaveText(OZMA)

    // Mapas: os lugares do livro em destaque, os outros apagados.
    await openPart(page, 'Mapas')
    await expect(page.getByText(/^Em destaque: os lugares de “Ozma de Oz/)).toBeVisible()
    await expect(page.locator('.pin.off-book').first()).toBeAttached()

    // Estrutura: só o mapa deste livro.
    await nav(page, 'Escrever').click()
    await page.getByRole('link', { name: 'Estrutura' }).or(page.getByRole('button', { name: 'Estrutura' })).first().click()
    await expect(page.locator('.cork-group')).toHaveCount(1)
  })

  test('Ler como livro começa no livro escolhido', async ({ page }) => {
    await page.goto('/app/?exemplo')
    await pick(book(page), OZMA)
    await page.getByRole('button', { name: 'Ler como livro' }).first().click()
    const reader = page.getByRole('dialog', { name: 'Modo leitor' })
    await expect(reader.locator('.leitor-title')).toHaveText('A menina no galinheiro')
  })

  test('num universo de um livro só, a faixa não aparece', async ({ page }) => {
    await page.goto('/app/?exemplo=alienista')
    await nav(page, 'Escrever').click()
    await expect(page.locator('.view').first()).toBeVisible()
    await expect(page.locator('[data-tour="livro-atual"]')).toHaveCount(0)
  })
})
