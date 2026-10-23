import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const editor = (page: Page) => page.getByRole('textbox', { name: 'Texto da cena' })
const status = (page: Page) => page.getByRole('status').first()
const tree = (page: Page) => page.getByRole('complementary', { name: 'Manuscrito' })
const nav = (page: Page, name: string | RegExp) => page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name })

async function newUniverse(page: Page, name = 'Teste') {
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Nome do novo universo' }).fill(name)
  await page.getByRole('button', { name: 'Criar universo' }).click()
  await expect(page.getByRole('navigation', { name: 'Áreas' })).toBeVisible()
}

async function openSample(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Abrir um universo de exemplo' }).click()
  await expect(page.getByRole('navigation', { name: 'Áreas' })).toBeVisible()
}

async function startWriting(page: Page) {
  await page.getByRole('button', { name: 'Começar a escrever' }).click()
  await expect(editor(page)).toBeFocused()
}

/** Seleciona um trecho exato do texto da cena, mesmo que atravesse destaques. */
async function selectText(page: Page, text: string) {
  await editor(page).evaluate((el, t) => {
    const nodes: Text[] = []
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text)
    const full = nodes.map((n) => n.data).join('')
    const start = full.indexOf(t)
    if (start < 0) throw new Error(`Texto não encontrado: ${t}`)
    const at = (offset: number): [Text, number] => {
      let acc = 0
      for (const n of nodes) {
        if (offset <= acc + n.data.length) return [n, offset - acc]
        acc += n.data.length
      }
      throw new Error('fora do texto')
    }
    const range = document.createRange()
    range.setStart(...at(start))
    range.setEnd(...at(start + t.length))
    const sel = getSelection()!
    sel.removeAllRanges()
    sel.addRange(range)
  }, text)
}

test('escreve, salva sozinho e reabre o mesmo universo e cena', async ({ page }) => {
  await newUniverse(page, 'Cinzas')
  await startWriting(page)
  await page.keyboard.type('Era noite em ')
  await page.keyboard.press('ControlOrMeta+b')
  await page.keyboard.type('Ostria')
  await page.keyboard.press('ControlOrMeta+b')
  await page.keyboard.type('.')
  await page.keyboard.press('Enter')
  await page.keyboard.type('— Quem está aí?')
  await page.getByRole('textbox', { name: 'Título da cena' }).fill('A chegada')

  await expect(status(page)).toHaveText('Salvo')
  await page.reload()

  // Reabre direto o último universo e a última cena.
  await expect(editor(page)).toContainText('Era noite em Ostria.')
  await expect(editor(page)).toContainText('— Quem está aí?')
  await expect(editor(page).locator('strong')).toHaveText('Ostria')
  await expect(page.getByRole('textbox', { name: 'Título da cena' })).toHaveValue('A chegada')
})

test('não perde o texto ao recarregar logo depois de digitar', async ({ page }) => {
  await newUniverse(page)
  await startWriting(page)
  await page.keyboard.type('Texto urgente')
  // Recarrega antes do salvamento automático ocorrer.
  await page.reload()
  await expect(editor(page)).toContainText('Texto urgente')
})

test('separador de cena e exportação em Markdown', async ({ page }) => {
  await newUniverse(page)
  await startWriting(page)
  await page.keyboard.type('Antes.')
  await page.getByRole('button', { name: 'Separador de cena' }).click()
  await page.keyboard.type('Depois.')
  await page.getByRole('textbox', { name: 'Título da cena' }).fill('Duas partes')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar cena' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('duas-partes.md')
  expect(await readFile(await download.path(), 'utf8')).toBe('# Duas partes\n\nAntes.\n\n* * *\n\nDepois.\n')
})

test('remover uma história preserva as cenas como cenas soltas', async ({ page }) => {
  await newUniverse(page)
  await startWriting(page)
  await page.getByRole('textbox', { name: 'Título da cena' }).fill('Prólogo')
  await tree(page).getByRole('button', { name: 'Nova história' }).click()
  const story = tree(page).getByRole('region', { name: 'Nova história' })
  await story.getByRole('textbox', { name: 'Título da história' }).fill('Livro um')
  await page.getByRole('button', { name: 'Detalhes da cena' }).click()
  await page.getByRole('combobox', { name: 'História' }).selectOption({ label: 'Livro um' })
  const livro = tree(page).getByRole('region', { name: 'Livro um' })
  await expect(livro.getByRole('button', { name: /Prólogo/ })).toBeVisible()

  await livro.getByRole('button', { name: 'Remover história' }).click()
  await livro.getByRole('button', { name: 'Remover história' }).click()

  await expect(tree(page).getByRole('region', { name: 'Livro um' })).toHaveCount(0)
  await expect(tree(page).getByRole('region', { name: 'Cenas soltas' }).getByRole('button', { name: /Prólogo/ })).toBeVisible()
})

test('apagar uma cena pede confirmação e pode ser desfeito', async ({ page }) => {
  await newUniverse(page)
  await startWriting(page)
  await page.keyboard.type('Algo importante')
  await page.getByRole('textbox', { name: 'Título da cena' }).fill('Importante')

  await page.getByRole('button', { name: 'Apagar cena' }).click()
  await page.getByRole('button', { name: 'Cancelar' }).click()
  await expect(tree(page).getByRole('button', { name: /Importante/ })).toBeVisible()

  await page.getByRole('button', { name: 'Apagar cena' }).click()
  await page.getByRole('group', { name: 'Apagar esta cena?' }).getByRole('button', { name: 'Apagar cena' }).click()
  await expect(tree(page).getByRole('button', { name: /Importante/ })).toHaveCount(0)

  await page.getByRole('button', { name: 'Desfazer' }).click()
  await tree(page).getByRole('button', { name: /Importante/ }).click()
  await expect(editor(page)).toContainText('Algo importante')
})

test('cria ficha a partir de uma seleção e a vê na margem e nas Fichas', async ({ page }) => {
  await newUniverse(page)
  await startWriting(page)
  await page.keyboard.type('Kael chegou ao porto antes do amanhecer.')
  await selectText(page, 'Kael')
  await page.getByRole('toolbar', { name: 'Ações da seleção' }).getByRole('button', { name: 'Ficha' }).click()
  await expect(page.getByRole('dialog', { name: 'Nova ficha' })).toBeVisible()
  await page.getByRole('button', { name: 'Criar em rascunho' }).click()

  await expect(editor(page).locator('.mention')).toHaveText('Kael')
  const margin = page.getByRole('complementary', { name: 'Margem viva' })
  await expect(margin.getByRole('button', { name: 'Kael', exact: true }).first()).toBeVisible()

  await nav(page, 'Fichas').click()
  await page.getByRole('button', { name: /^Kael/ }).click()
  const ficha = page.getByRole('region', { name: 'Ficha' })
  await expect(ficha.getByRole('textbox', { name: 'Nome', exact: true })).toHaveValue('Kael')
  await expect(ficha.getByRole('button', { name: 'Nova cena' })).toBeVisible()
})

test('a revisão encontra nomes novos e cria fichas sem interromper a escrita', async ({ page }) => {
  await newUniverse(page)
  await startWriting(page)
  await page.keyboard.type('Ontem Lyra subiu a Torre de Marfim. Depois, Lyra desceu.')
  const margin = page.getByRole('complementary', { name: 'Margem viva' })
  await expect(margin.getByText('2 nomes novos')).toBeVisible()

  await margin.getByRole('button', { name: /Revisar/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Revisão' })
  const torre = dialog.getByRole('listitem').filter({ has: page.getByText('Torre de Marfim', { exact: true }) })
  await torre.getByRole('combobox').selectOption('lugar')
  await torre.getByRole('button', { name: 'Criar ficha' }).click()
  await dialog.getByRole('listitem').filter({ has: page.getByText('Lyra', { exact: true }) }).getByRole('button', { name: 'Ignorar' }).click()
  await expect(dialog.getByText('Nenhum nome novo por aqui.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Fechar' }).click()

  // O nome reconhecido passa a ser destacado no texto.
  await expect(editor(page).locator('.detected')).toHaveText('Torre de Marfim')
})

test('captura um fato a partir de uma fala, como afirmação de personagem', async ({ page }) => {
  await newUniverse(page)
  await nav(page, 'Fichas').click()
  await page.getByRole('textbox', { name: 'Nome da nova ficha' }).fill('Vaelor')
  await page.getByRole('button', { name: 'Criar ficha' }).click()
  await nav(page, 'Escrever').click()
  await startWriting(page)
  await page.keyboard.type('— Vaelor tem olhos cinzentos — disse a menina.')
  await selectText(page, 'Vaelor tem olhos cinzentos')
  await page.getByRole('toolbar', { name: 'Ações da seleção' }).getByRole('button', { name: 'Fato' }).click()

  const dialog = page.getByRole('dialog', { name: 'Capturar fato' })
  await expect(dialog.getByRole('button', { name: 'Vaelor' })).toBeVisible()
  await expect(dialog.getByRole('combobox', { name: 'Canon' })).toHaveValue('rumor')
  await dialog.getByRole('combobox', { name: 'Relação' }).fill('tem olhos')
  await dialog.getByRole('textbox', { name: 'Valor em texto' }).fill('cinzentos')
  await dialog.getByRole('button', { name: 'Registrar' }).click()

  await nav(page, 'Conhecimento').click()
  const row = page.getByRole('row').filter({ hasText: 'Vaelor tem olhos cinzentos' })
  await expect(row).toContainText('Rumor')
  await expect(row).toContainText('“Vaelor tem olhos cinzentos”')
})

test('busca global encontra uma ficha pelo apelido, sem acento', async ({ page }) => {
  await openSample(page)
  await page.keyboard.press('ControlOrMeta+k')
  await page.getByRole('combobox', { name: 'Buscar no universo' }).fill('homem palido')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('textbox', { name: 'Nome', exact: true })).toHaveValue('Vaelor')
})

test('RPG: revelar uma ficha a um grupo coloca no Codex dos jogadores', async ({ page }) => {
  await openSample(page)
  await nav(page, 'RPG').click()
  await page.getByRole('tab', { name: 'Revelações e Codex' }).click()

  const codex = page.getByRole('region', { name: 'Codex como os jogadores veem' })
  await expect(codex.getByRole('heading', { name: 'Ostria' })).toBeVisible()
  await expect(codex.getByRole('heading', { name: 'Mira' })).toHaveCount(0)

  await page.getByRole('combobox', { name: 'Revelar ficha' }).fill('Mira')
  await page.getByRole('option', { name: /Mira/ }).click()
  await page.getByRole('button', { name: 'Revelar', exact: true }).click()
  await expect(codex.getByRole('heading', { name: 'Mira' })).toBeVisible()
  await expect(codex).toContainText('Irmã de Kael')
})

test('RPG: registro de sessão vai para a Inbox ao encerrar', async ({ page }) => {
  await openSample(page)
  await nav(page, 'RPG').click()
  await page.getByRole('tab', { name: 'Sessões' }).click()
  await page.getByRole('textbox', { name: 'Nova nota' }).fill('Os jogadores entraram na Torre.')
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Encerrar sessão' }).click()
  await page.getByRole('button', { name: 'Abrir Inbox' }).click()
  await expect(page.getByRole('textbox', { name: 'Texto do item' }).first()).toHaveValue(/Os jogadores entraram na Torre\./)
})

test('dados: rola expressões e recusa as inválidas', async ({ page }) => {
  await openSample(page)
  await nav(page, 'RPG').click()
  await page.getByRole('tab', { name: 'Dados e iniciativa' }).click()
  await page.getByRole('textbox', { name: 'Rolagem' }).fill('2d6+100')
  await page.getByRole('button', { name: 'Rolar' }).click()
  const total = Number(await page.locator('.dice-total').textContent())
  expect(total).toBeGreaterThanOrEqual(102)
  expect(total).toBeLessThanOrEqual(112)
  await page.getByRole('textbox', { name: 'Rolagem' }).fill('banana')
  await page.getByRole('button', { name: 'Rolar' }).click()
  await expect(page.getByRole('alert')).toContainText('Não entendi')
})

test('snapshot: restaura o estado anterior e guarda o atual', async ({ page }) => {
  await newUniverse(page)
  await startWriting(page)
  await page.keyboard.type('Versão um.')
  await nav(page, 'Ajustes e dados').click()
  await page.getByRole('textbox', { name: 'Nome do snapshot' }).fill('Primeira versão')
  await page.getByRole('button', { name: 'Criar', exact: true }).click()
  await expect(page.getByText('Snapshot criado')).toBeVisible()

  await nav(page, 'Escrever').click()
  await editor(page).click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type('Versão dois.')
  await nav(page, 'Ajustes e dados').click()
  const snap = page.getByRole('listitem').filter({ hasText: 'Primeira versão' })
  await snap.getByRole('button', { name: 'Restaurar' }).click()
  await snap.getByRole('group').getByRole('button', { name: 'Restaurar' }).click()

  await nav(page, 'Escrever').click()
  await expect(editor(page)).toContainText('Versão um.')
  await nav(page, 'Ajustes e dados').click()
  await expect(page.getByText('Antes de restaurar o snapshot')).toBeVisible()
})

test('Inbox: captura rápida de qualquer lugar e vira cena solta', async ({ page }) => {
  await newUniverse(page)
  await page.keyboard.press('ControlOrMeta+Shift+I')
  await page.getByRole('textbox', { name: 'Ideia' }).fill('Um navio sem nome no casco.')
  await page.getByRole('button', { name: 'Guardar na Inbox' }).click()
  await nav(page, /^Inbox/).click()
  await page.getByRole('button', { name: 'Virar cena' }).click()
  await page.getByRole('button', { name: 'Abrir', exact: true }).click()
  await expect(editor(page)).toContainText('Um navio sem nome no casco.')
})

test('adota um save da primeira versão do Papirus sem perder o texto', async ({ page }) => {
  // Cópia de emergência no formato 1, como gravada pela versão anterior.
  await page.addInitScript(() => {
    if (sessionStorage.getItem('semeado')) return
    sessionStorage.setItem('semeado', '1')
    localStorage.setItem(
      'papirus:emergency',
      JSON.stringify({
        schemaVersion: 1,
        revision: 3,
        universe: {
          id: 'antigo',
          name: 'Meu universo',
          stories: [],
          scenes: [
            {
              id: 'c1',
              title: 'Texto antigo',
              storyId: null,
              order: 0,
              doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Escrito na versão 1.' }] }] },
              text: 'Escrito na versão 1.',
              createdAt: '2026-10-22T00:00:00.000Z',
              updatedAt: '2026-10-22T00:00:00.000Z',
            },
          ],
          createdAt: '2026-10-22T00:00:00.000Z',
          updatedAt: '2026-10-22T00:00:00.000Z',
        },
      }),
    )
  })
  await page.goto('/')
  await page.getByRole('button', { name: /^Meu universo/ }).click()
  await expect(editor(page)).toContainText('Escrito na versão 1.')
})
