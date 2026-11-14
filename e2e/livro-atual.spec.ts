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
    await expect(page.getByText(/^Quem aparece em “Ozma de Oz/)).toBeVisible()
    const inBook = await list.count()
    // Várias fichas de uma vez com o livro escolhido: elas ficam na lista (ainda não aparecem no texto).
    // No celular: o + abre "Nova ficha", e dali "Criar várias de uma vez".
    await page.getByRole('button', { name: 'Nova ficha' }).click()
    await page.getByRole('button', { name: /Criar várias de uma vez/ }).click()
    const bulk = page.getByRole('dialog', { name: 'Criar várias fichas' })
    await bulk.locator('textarea').fill('Zorba Um\nZorba Dois')
    await bulk.locator('.btn-primary').click()
    await expect(list.filter({ hasText: 'Zorba Um' })).toHaveCount(1)
    await expect(list.filter({ hasText: 'Zorba Dois' })).toHaveCount(1)
    // Saindo e voltando, continuam (ainda não estão em livro nenhum, então valem para qualquer livro).
    await nav(page, 'Início').click()
    await openPart(page, 'Fichas')
    await expect(list.filter({ hasText: 'Zorba Um' })).toHaveCount(1)
    await expect(list.filter({ hasText: 'Zorba Dois' })).toHaveCount(1)
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
    // Sem livro escolhido, as outras áreas não mostram nada sobre livro (sem faixa no alto).
    await expect(page.locator('[data-tour="livro-atual"]')).toHaveCount(0)
    // O livro se escolhe no Início; aqui aparece só um selo com ele.
    await nav(page, 'Início').click()
    await pick(book(page), OZMA)
    await openPart(page, 'Linha do tempo')
    await expect(page.locator('.book-chip')).toBeVisible()
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

  test('lugar novo, que ainda não está em cena nenhuma, não fica apagado nos Mapas', async ({ page }) => {
    await page.goto('/app/?exemplo')
    await pick(book(page), OZMA)
    await openPart(page, 'Mapas')
    // Marca um lugar novo no mapa (cria a ficha na hora): ele ainda não aparece em livro nenhum.
    await page.getByRole('button', { name: 'Marcar lugar' }).click()
    const map = (await page.locator('.atlas-image').boundingBox())!
    await page.locator('.atlas-image').click({ position: { x: map.width * 0.3, y: map.height * 0.3 } })
    await page.getByPlaceholder('Lugar…').fill('Vila Zorba')
    await page.getByRole('option', { name: /Criar “Vila Zorba”/ }).or(page.getByRole('button', { name: /Criar “Vila Zorba”/ })).first().click()
    const pin = page.locator('.pin').filter({ hasText: 'Vila Zorba' })
    await expect(pin).toBeVisible()
    await expect(pin).not.toHaveClass(/off-book/)
    // Os lugares só de outros livros continuam apagados.
    await expect(page.locator('.pin.off-book').first()).toBeAttached()
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

test.describe('palavras e meta do livro escolhido, no Início', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('com um livro escolhido, o Início mostra as palavras dele e quanto falta para a meta com prazo', async ({ page }) => {
    await page.goto('/app/?exemplo')
    const stats = page.locator('.home-stats')
    // Sem livro escolhido, nada muda: só o dia (e a semana).
    await expect(page.locator('.home-book-goal')).toHaveCount(0)

    // Escolhendo o livro 3, aparecem as palavras dele (só dele, não as do universo todo).
    await pick(book(page), OZMA)
    await expect(stats.locator('.home-book-goal')).toContainText(/Neste livro: [\d.]+ palavras/)
    const doLivro = Number((await stats.locator('.home-book-goal strong').innerText()).replace(/\./g, ''))
    expect(doLivro).toBeGreaterThan(100)
    await pick(book(page), /^Todos/)
    await expect(page.locator('.home-book-goal')).toHaveCount(0)

    // Com a meta do livro (e o prazo), diz quanto falta.
    await viaMore(page, 'Ajustes e dados')
    await page.getByRole('navigation', { name: 'Categorias dos ajustes' }).getByRole('button', { name: 'Universo', exact: true }).click()
    await page.getByRole('textbox', { name: 'Meta do livro: palavras' }).fill('50000')
    await nav(page, 'Início').click()
    await pick(book(page), OZMA)
    const meta = stats.locator('.home-book-goal')
    await expect(meta).toContainText(`faltam ${(50000 - doLivro).toLocaleString('pt-BR')} para 50.000 (até `)
  })
})

test.describe('procurar e trocar com um livro escolhido', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('"Só neste livro" é o padrão, mostra quantos achados há em cada, e "Em todos os livros" amplia', async ({ page }) => {
    await page.goto('/app/?exemplo')
    await pick(book(page), OZMA)
    await nav(page, 'Escrever').click()
    // O Ctrl+K do computador não existe no celular: abre pelo "Mais" da barra da cena (⋯) ou por Procurar e trocar.
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('papirus:trocar-no-livro', { detail: { find: 'Dorothy' } })))
    const janela = page.getByRole('dialog', { name: 'Procurar e trocar no livro' })
    await expect(janela).toBeVisible()
    const escopo = janela.getByRole('radiogroup', { name: 'Onde procurar' })
    const numeros = async () => {
      const so = await escopo.getByLabel(/^Só neste livro/).locator('xpath=..').innerText()
      const todos = await escopo.getByLabel(/^Em todos os livros/).locator('xpath=..').innerText()
      return [Number(so.match(/\((\d+)\)/)![1]), Number(todos.match(/\((\d+)\)/)![1])]
    }
    await expect(escopo.getByLabel(/^Só neste livro/)).toBeChecked()
    await expect.poll(async () => (await numeros())[1]).toBeGreaterThan(0)
    const [soNeste, emTodos] = await numeros()
    // O livro 3 do exemplo (Ozma de Oz, em trechos) tem menos "Dorothy" que o universo todo.
    expect(soNeste).toBeLessThan(emTodos)
    await expect(janela.getByText(new RegExp(`^${soNeste} achados? em`))).toBeVisible()

    // Em todos os livros: o resumo passa a contar todos.
    await escopo.getByLabel(/^Em todos os livros/).check()
    await expect(janela.getByText(new RegExp(`^${emTodos} achados? em`))).toBeVisible()
    await janela.getByRole('button', { name: 'Cancelar' }).click()
  })

  test('sem livro escolhido, a janela não pergunta o escopo', async ({ page }) => {
    await page.goto('/app/?exemplo')
    await nav(page, 'Escrever').click()
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('papirus:trocar-no-livro', { detail: { find: 'Dorothy' } })))
    await expect(page.getByRole('dialog', { name: 'Procurar e trocar no livro' })).toBeVisible()
    await expect(page.getByRole('radiogroup', { name: 'Onde procurar' })).toHaveCount(0)
  })
})

test.describe('bilhete e sprint com um livro escolhido', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('o bilhete de uma cena de outro livro leva a essa cena e o livro escolhido passa a ser o dela', async ({ page }) => {
    await page.goto('/app/?exemplo')
    // No livro 3: um bilhete na cena em que se parou.
    await pick(book(page), OZMA)
    const proximo = page.getByRole('region', { name: 'O próximo passo' })
    await proximo.getByRole('button', { name: 'Deixar um bilhete para amanhã' }).click()
    await proximo.getByRole('textbox', { name: 'Bilhete para amanhã' }).fill('Ozma descobre quem a escondeu.')
    await page.keyboard.press('Enter')
    await expect(proximo.getByRole('note', { name: 'Bilhete para amanhã' })).toContainText('Ozma descobre quem a escondeu.')

    // Trocando para o livro 1, o bilhete continua à vista, com o nome da cena dele; um toque leva até ela.
    await pick(book(page), /^O Mágico de Oz/)
    const bilhete = page.getByRole('note', { name: 'Bilhete para amanhã' })
    await expect(bilhete).toContainText('Ozma descobre quem a escondeu.')
    await bilhete.getByRole('button', { name: /^\(em “/ }).click()
    // Chegou na cena certa (do livro 3) e o livro escolhido virou o dela.
    await page.getByRole('button', { name: 'Mostrar manuscrito' }).click()
    const lista = page.getByRole('complementary', { name: 'Manuscrito' })
    await expect(lista.getByLabel('Livro', { exact: true }).locator('option:checked')).toHaveText(OZMA)
    await expect(page.getByRole('note', { name: 'Bilhete para amanhã' })).toContainText('Ozma descobre quem a escondeu.')
  })

  test('o sprint conta só as palavras do livro em que começou, mesmo que se escreva em outro', async ({ page }) => {
    await page.goto('/app/?exemplo')
    await pick(book(page), OZMA)
    await page.getByRole('button', { name: '15 minutos' }).click()
    const editor = page.getByRole('textbox', { name: 'Texto da cena' })
    await editor.click()
    await page.keyboard.press('Control+End')
    await page.keyboard.type(' um dois três quatro cinco.')
    const relogio = page.getByRole('timer')
    await expect(relogio).toContainText('+5', { timeout: 10_000 })

    // Troca para o livro 1 pela lista de cenas e escreve lá: o sprint continua contando o livro 3.
    await page.getByRole('button', { name: 'Mostrar manuscrito' }).click()
    const lista = page.getByRole('complementary', { name: 'Manuscrito' })
    await pick(lista.getByLabel('Livro', { exact: true }), /^O Mágico de Oz/)
    await lista.locator('.tree-scene, [data-scene], li button').filter({ hasText: /./ }).first().click()
    await page.keyboard.press('Escape')
    await editor.click()
    await page.keyboard.press('Control+End')
    await page.keyboard.type(' seis sete oito nove dez onze doze.')
    await page.waitForTimeout(1800)
    await expect(relogio).toContainText('+5')
    await expect(relogio).not.toContainText('+12')
  })
})
