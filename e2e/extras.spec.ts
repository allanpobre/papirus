import { expect, test, type Page } from './fixtures.ts'
import { readFile } from 'node:fs/promises'

const editor = (page: Page) => page.getByRole('textbox', { name: 'Texto da cena' })
const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: new RegExp(`^${name}`) })
const welcome = (page: Page) => page.getByRole('region', { name: 'Boas-vindas' })

async function openSample(page: Page) {
  await page.goto('/app/')
  await page.getByRole('button', { name: 'Abrir um universo de exemplo' }).click()
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
