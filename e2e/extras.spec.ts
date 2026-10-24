import { expect, test, type Page } from './fixtures.ts'
import { readFile } from 'node:fs/promises'

const editor = (page: Page) => page.getByRole('textbox', { name: 'Texto da cena' })
const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: new RegExp(`^${name}`) })
const welcome = (page: Page) => page.getByRole('region', { name: 'Boas-vindas' })

async function openSample(page: Page) {
  // O exemplo de fantasia (pequeno, com tudo): a base destes testes.
  await page.goto('/app/?exemplo=ostria')
  await expect(page.getByRole('navigation', { name: 'Áreas' })).toBeVisible()
}

async function newUniverse(page: Page) {
  await page.goto('/app/')
  await page.getByRole('textbox', { name: 'Nome do novo universo' }).fill('Teste')
  await page.getByRole('button', { name: 'Criar universo' }).click()
  await page.getByRole('button', { name: 'Começar a escrever' }).click()
  await expect(editor(page)).toBeFocused()
}

async function selectText(page: Page, text: string) {
  await editor(page).evaluate((el, t) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const i = (n as Text).data.indexOf(t)
      if (i < 0) continue
      const range = document.createRange()
      range.setStart(n, i)
      range.setEnd(n, i + t.length)
      getSelection()!.removeAllRanges()
      getSelection()!.addRange(range)
      return
    }
    throw new Error(`Texto não encontrado: ${t}`)
  }, text)
}

test('primeira vez: a escolha arruma o menu, e dá para mostrar tudo de novo', async ({ page }) => {
  await page.goto('/app/')
  await welcome(page).getByRole('button', { name: /Escrever histórias/ }).click()
  await expect(welcome(page)).toHaveCount(0)
  await page.getByRole('button', { name: 'Abrir um universo de exemplo' }).click()
  await expect(nav(page, 'Escrever')).toBeVisible()
  await expect(nav(page, 'RPG')).toHaveCount(0)

  await nav(page, 'Ajustes e dados').click()
  await page.getByRole('navigation', { name: 'Categorias dos ajustes' }).getByRole('button', { name: 'Menu e ajuda' }).click()
  await page.getByRole('button', { name: 'Só RPG' }).click()
  await expect(nav(page, 'Organizar')).toHaveCount(0)
  await expect(nav(page, 'RPG')).toBeVisible()
  await page.getByRole('button', { name: 'Mostrar tudo' }).click()
  await expect(nav(page, 'Organizar')).toBeVisible()
  await page.reload()
  await expect(nav(page, 'Organizar')).toBeVisible()
})

test('lembra do backup depois de uma semana, e o adiamento vale', async ({ page }) => {
  await openSample(page)
  await expect(page.getByText(/dias sem backup/)).toHaveCount(0)
  await page.clock.setFixedTime(Date.now() + 10 * 86400000)
  await page.reload()
  const banner = page.getByRole('status').filter({ hasText: 'dias sem backup' })
  await expect(banner).toBeVisible()
  await banner.getByRole('button', { name: 'Lembrar em 3 dias' }).click()
  await expect(banner).toHaveCount(0)
  await page.reload()
  await expect(page.getByText(/dias sem backup/)).toHaveCount(0)

  const download = page.waitForEvent('download')
  await page.clock.setFixedTime(Date.now() + 20 * 86400000)
  await page.reload()
  await page.getByRole('button', { name: 'Baixar backup' }).click()
  expect((await download).suggestedFilename()).toMatch(/\.json$/)
  await expect(page.getByText(/dias sem backup/)).toHaveCount(0)
})

test('comentário num trecho: aparece na margem e some ao resolver', async ({ page }) => {
  await newUniverse(page)
  await page.keyboard.type('A porta rangeu como um animal ferido.')
  await selectText(page, 'como um animal ferido')
  await page.getByRole('toolbar', { name: 'Ações da seleção' }).getByRole('button', { name: 'Comentar' }).click()
  const dialog = page.getByRole('dialog', { name: 'Comentar trecho' })
  await dialog.getByRole('textbox', { name: 'Comentário' }).fill('Clichê? Pensar em outra imagem.')
  await dialog.getByRole('button', { name: 'Comentar' }).click()

  await expect(editor(page).locator('.comment-mark')).toHaveText('como um animal ferido')
  await expect(page.getByRole('textbox', { name: 'Texto do comentário' })).toHaveValue('Clichê? Pensar em outra imagem.')
  await page.reload()
  await expect(editor(page).locator('.comment-mark')).toHaveText('como um animal ferido')
  await expect(page.getByRole('textbox', { name: 'Texto do comentário' })).toBeVisible()

  await page.getByRole('button', { name: 'Resolver' }).click()
  await expect(editor(page).locator('.comment-mark')).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Texto do comentário' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Ver 1 resolvidos' }).click()
  await expect(page.getByRole('textbox', { name: 'Texto do comentário' })).toBeVisible()
})

test('calendário próprio: meses nomeados nas datas das cenas', async ({ page }) => {
  await newUniverse(page)
  await page.keyboard.type('Neblina na costa.')
  await nav(page, 'Ajustes e dados').click()
  await page.getByRole('navigation', { name: 'Categorias dos ajustes' }).getByRole('button', { name: 'Universo', exact: true }).click()
  await page.getByRole('button', { name: '+ Mês' }).click()
  await page.getByRole('button', { name: '+ Mês' }).click()
  await page.getByRole('textbox', { name: 'Nome do mês 1' }).fill('Geada')
  await page.getByRole('textbox', { name: 'Nome do mês 2' }).fill('Neblina')
  await expect(page.getByText('60 dias no ano')).toBeVisible()

  await nav(page, 'Escrever').click()
  await page.getByRole('button', { name: 'Detalhes da cena' }).click()
  await page.getByRole('textbox', { name: 'Ano' }).fill('359')
  await page.getByRole('combobox', { name: 'Mês' }).selectOption({ label: 'Neblina' })
  await page.getByRole('textbox', { name: 'Dia do mês' }).fill('12')
  await expect(page.getByText(/12 de Neblina de 359/).first()).toBeVisible()
})

test('Codex mostra eventos revelados e nunca os segredos da ficha', async ({ page }) => {
  await openSample(page)
  await nav(page, 'Fichas').click()
  await page.getByRole('button', { name: /^Ostria/ }).first().click()
  const desc = page.getByRole('textbox', { name: 'Descrição' })
  await desc.fill('Cidade portuária. [segredo]O porto é dos contrabandistas.[/segredo]')
  await expect(page.getByText(/1 trecho secreto/)).toBeVisible()

  await nav(page, 'RPG').click()
  await page.getByRole('tab', { name: 'Revelações e Codex' }).click()
  await page.getByRole('combobox', { name: 'O que revelar' }).selectOption({ label: 'Evento' })
  const events = page.getByRole('combobox', { name: 'Escolher evento' })
  await events.selectOption({ label: (await events.locator('option', { hasText: 'A Queda' }).textContent())! })
  await page.getByRole('button', { name: 'Revelar', exact: true }).click()
  const preview = page.getByRole('region', { name: 'Codex como os jogadores veem' })
  await expect(preview.getByRole('heading', { name: 'Linha do tempo' })).toBeVisible()
  await expect(preview).toContainText('A Queda')
  await expect(preview).toContainText('Cidade portuária')
  await expect(preview).not.toContainText('contrabandistas')
  await expect(preview.getByRole('heading', { name: 'O grupo' })).toBeVisible()
})

test('Na mesa: começa a sessão, anota, rola e ajusta recursos', async ({ page }) => {
  await openSample(page)
  await nav(page, 'RPG').click()
  await page.getByRole('tab', { name: 'Na mesa' }).click()
  const start = page.getByRole('button', { name: /^Começar/ })
  if (await start.count()) await start.click()
  await page.getByRole('textbox', { name: 'Anotar no registro' }).fill('O grupo entrou na torre.')
  await page.getByRole('button', { name: 'Anotar' }).click()
  await expect(page.getByRole('region', { name: 'Registro' })).toContainText('O grupo entrou na torre.')
  await page.getByRole('region', { name: 'Dados' }).getByRole('button', { name: 'd20', exact: true }).click()
  await expect(page.getByRole('complementary', { name: 'Últimas rolagens' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Registro' }).locator('.log-roll')).not.toHaveCount(0)

  const minus = page.getByRole('button', { name: /^Brisa: menos 1/ }).first()
  if (await minus.count()) {
    const label = page.getByRole('region', { name: 'Grupo' }).locator('.pc-card').first().locator('.pc-res-label .tabular').first()
    const before = await label.textContent()
    await minus.click()
    await expect(label).not.toHaveText(before!)
  }
})

test('importa um livro em Markdown e exporta como Word e EPUB', async ({ page }) => {
  await newUniverse(page)
  await nav(page, 'Ajustes e dados').click()
  await page.getByRole('navigation', { name: 'Categorias dos ajustes' }).getByRole('button', { name: 'Livros' }).click()
  await page.getByLabel('Arquivo do livro').setInputFiles({
    name: 'sal.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# O Sal\n\n## Chegada\n\nKael desceu do *barco*.\n\n## Partida\n\nE foi embora.\n'),
  })
  await expect(page.getByText('“O Sal” importado em 2 cenas.')).toBeVisible()

  await page.getByRole('combobox', { name: 'História' }).selectOption({ label: 'O Sal' })
  const docx = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Word (.docx)' }).click()
  const d = await docx
  expect(d.suggestedFilename()).toBe('o-sal.docx')
  expect((await readFile(await d.path())).subarray(0, 2).toString()).toBe('PK')
  const epub = page.waitForEvent('download')
  await page.getByRole('button', { name: 'EPUB' }).click()
  expect((await epub).suggestedFilename()).toBe('o-sal.epub')

  await nav(page, 'Escrever').click()
  const tree = page.getByRole('complementary', { name: 'Manuscrito' })
  await tree.getByRole('region', { name: 'O Sal' }).getByRole('button', { name: /Chegada/ }).click()
  await expect(editor(page)).toContainText('Kael desceu do barco.')
  await expect(editor(page).locator('em')).toHaveText('barco')
})

test('relação com várias fichas: "criado por" duas pessoas numa linha só', async ({ page }) => {
  await openSample(page)
  await nav(page, 'Fichas').click()
  await page.getByRole('button', { name: /^Lâmina de vidro negro/ }).first().click()
  await page.getByRole('combobox', { name: 'Nova relação' }).fill('criado por')
  const com = page.getByRole('combobox', { name: 'Com' })
  await com.fill('Kael')
  await page.getByRole('option', { name: /^Kael/ }).first().click()
  await com.fill('Mira')
  await page.getByRole('option', { name: /^Mira/ }).first().click()
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click()

  const row = page.locator('.relation-row').filter({ has: page.locator('input[value="criado por"]') })
  await expect(row).toHaveCount(1)
  await expect(row.locator('.chip-entity')).toHaveText(['Kael', 'Mira'])
  const more = row.getByRole('combobox', { name: 'Mais alguém: criado por' })
  await more.fill('Ilsa')
  await page.getByRole('option', { name: /^Ilsa/ }).first().click()
  await expect(row.locator('.chip-entity')).toHaveText(['Kael', 'Mira', 'Ilsa'])
  await row.getByRole('button', { name: 'Tirar Mira desta relação' }).click()
  await expect(row.locator('.chip-entity')).toHaveText(['Kael', 'Ilsa'])
})

test('no celular, o menu "Mais" leva a todas as áreas e a página não rola de lado', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openSample(page)
  await page.getByRole('button', { name: 'Mais' }).click()
  await page.getByRole('group', { name: 'Todas as áreas' }).getByRole('button', { name: 'Conhecimento' }).click()
  await expect(page.getByRole('heading', { name: 'Conhecimento' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.getByRole('button', { name: 'Mais' }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('group', { name: 'Todas as áreas' })).toHaveCount(0)
})

test('a barra da seleção some quando a janela do fato abre, e dá para marcar mentira', async ({ page }) => {
  await newUniverse(page)
  await page.keyboard.type('Gean disse que era filho de Marcos.')
  await selectText(page, 'filho de Marcos')
  const bubble = page.getByRole('toolbar', { name: 'Ações da seleção' })
  await bubble.getByRole('button', { name: 'Fato' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(bubble).toBeHidden()
  await dialog.getByRole('radio', { name: 'Mentira ou engano' }).click()
  await expect(dialog.getByText('Quem conta a mentira?')).toBeVisible()
  await expect(dialog.getByRole('combobox', { name: 'Canon' })).toHaveValue('falso')
})

test('ajustes por categoria: busca, cor de destaque e tema rápido', async ({ page }) => {
  await openSample(page)
  await nav(page, 'Ajustes e dados').click()
  // Abre em Aparência, com a cor de destaque.
  await page.getByRole('radio', { name: 'Azul' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'azul')
  // A busca leva à categoria certa.
  await page.getByRole('searchbox', { name: 'Procurar nos ajustes' }).fill('backup')
  await expect(page.getByRole('heading', { name: 'Seus dados' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Aparência' })).toHaveCount(0)
  await page.getByRole('searchbox', { name: 'Procurar nos ajustes' }).fill('xyzzy')
  await expect(page.getByText('Nada encontrado para “xyzzy”.')).toBeVisible()
  // Tema na hora, pelo menu lateral; a cor continua depois de recarregar.
  const toggle = page.getByRole('button', { name: /Usar tema (claro|escuro)/ })
  const before = await page.locator('html').getAttribute('data-theme')
  await toggle.click()
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', before ?? 'nenhum')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'azul')
})

test('relação indireta e com tempo: "envenenou, a mando de", só num período, no grafo', async ({ page }) => {
  await openSample(page)
  await nav(page, 'Fichas').click()
  await page.getByRole('button', { name: /^Kael/ }).first().click()
  await page.getByRole('combobox', { name: 'Nova relação' }).fill('envenenou')
  await page.getByRole('combobox', { name: 'Com', exact: true }).fill('Vaelor')
  await page.getByRole('option', { name: /^Vaelor/ }).first().click()
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click()

  const row = page.locator('.relation-row').filter({ has: page.locator('input[value="envenenou"]') })
  await row.locator('summary').click()
  await row.getByRole('combobox', { name: 'Quem está por trás' }).fill('Mira')
  await page.getByRole('option', { name: /^Mira/ }).first().click()
  await row.getByRole('radio', { name: 'Num período' }).click()
  await row.getByRole('textbox', { name: 'De (ano)' }).fill('360')
  await expect(row.locator('summary')).toHaveText('a mando de Mira · a partir de 360 DC')

  // Na ficha de Mira, aparece como envolvida.
  await page.getByRole('button', { name: /^Mira/ }).first().click()
  await expect(page.locator('.relation-involved')).toContainText('a mando de: Kael envenenou Vaelor')

  // No grafo: a linha tracejada de quem está por trás; no ponto da história (359), a relação ainda não vale.
  await nav(page, 'Relações').click()
  await expect(page.locator('.edge-via')).toHaveCount(3)
  await page.locator('.node', { hasText: 'Kael' }).click()
  await expect(page.getByRole('complementary', { name: 'Ficha selecionada' })).toContainText('Kael envenenou Vaelor, a mando de Mira · a partir de 360 DC')
  await page.getByRole('radio', { name: 'Num ponto da história' }).click()
  await expect(page.getByRole('complementary', { name: 'Ficha selecionada' })).toContainText('(não vale nesta cena)')
  const envenenou = page.locator('.edge.off')
  await expect(envenenou).not.toHaveCount(0)
  await page.getByRole('button', { name: 'Tocar a história' }).click()
  await expect(page.getByText(/^2\/9/)).toBeVisible({ timeout: 4000 })
})

test('arrastar e dar zoom no grafo não seleciona texto nem rola a página', async ({ page }) => {
  await openSample(page)
  await nav(page, 'Relações').click()
  const graph = page.locator('.graph')
  await expect(page.locator('.node').first()).toBeVisible()
  const box = (await graph.boundingBox())!
  // Arrasta do grafo até a dica de baixo e o título de cima.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + 20, box.y + box.height + 40, { steps: 8 })
  await page.mouse.move(box.x + 20, box.y - 80, { steps: 8 })
  await page.mouse.up()
  expect(await page.evaluate(() => getSelection()?.toString() ?? '')).toBe('')
  // O arrasto leva o mapa para longe: enquadra de novo antes do duplo clique.
  await page.getByRole('button', { name: 'Enquadrar' }).click()
  await page.locator('.node', { hasText: 'Kael' }).dblclick({ force: true })
  expect(await page.evaluate(() => getSelection()?.toString() ?? '')).toBe('')
  await nav(page, 'Relações').click()
  const stage = page.locator('.stage')
  const before = await stage.evaluate((el) => el.scrollTop)
  await page.locator('.graph').hover()
  await page.mouse.wheel(0, 600)
  await page.waitForTimeout(200)
  expect(await stage.evaluate((el) => el.scrollTop)).toBe(before)
})

test('arrastar o grafo por cima de nomes e de texto selecionado não inicia o "arrastar e soltar"', async ({ page }) => {
  await openSample(page)
  await nav(page, 'Relações').click()
  await expect(page.locator('.node').first()).toBeVisible()
  await page.waitForTimeout(1200)
  await page.evaluate(() => {
    const w = window as unknown as { drags: number }
    w.drags = 0
    window.addEventListener('dragstart', (e) => !e.defaultPrevented && w.drags++)
  })
  const label = (await page.locator('.node-label').first().boundingBox())!
  const hint = (await page.locator('.graph-hint').boundingBox())!
  for (const [x, y] of [
    [label.x + 5, label.y + 5],
    [hint.x + 30, hint.y + 5],
  ]) {
    await page.mouse.dblclick(x, y)
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + 220, y - 160, { steps: 10 })
    await page.mouse.up()
  }
  expect(await page.evaluate(() => (window as unknown as { drags: number }).drags)).toBe(0)
})

test('modelo de universo: fantasia já traz o Livro I e campos sugeridos nas fichas', async ({ page }) => {
  await page.goto('/app/')
  await page.getByRole('textbox', { name: 'Nome do novo universo' }).fill('Eldra')
  await page.getByRole('radiogroup', { name: 'Começar como' }).getByRole('radio', { name: 'Fantasia' }).click()
  await page.getByRole('button', { name: 'Criar universo' }).click()
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Fichas' }).click()
  await page.getByRole('textbox', { name: 'Nome da nova ficha' }).fill('Kael')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('textbox', { name: 'Campo' }).first()).toHaveValue('Idade')
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Escrever' }).click()
  await expect(page.locator('.write-tree')).toContainText('Capítulo 1')
})
