import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const editor = (page: Page) => page.getByRole('textbox', { name: 'Texto da cena' })
const status = (page: Page) => page.getByRole('status')

test('escreve uma cena, salva sozinho e mantém o texto após recarregar', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Começar a escrever' }).click()

  // O editor já recebe o foco: dá para digitar direto.
  await expect(editor(page)).toBeFocused()
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

  await page.getByRole('button', { name: 'A chegada' }).click()
  await expect(editor(page)).toContainText('Era noite em Ostria.')
  await expect(editor(page)).toContainText('— Quem está aí?')
  await expect(editor(page).locator('strong')).toHaveText('Ostria')
})

test('separador de cena e exportação em Markdown', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Começar a escrever' }).click()
  await page.getByRole('textbox', { name: 'Título da cena' }).fill('Duas partes')

  await editor(page).click()
  await page.keyboard.type('Antes.')
  await page.getByRole('button', { name: '* * *' }).click()
  await page.keyboard.type('Depois.')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar cena' }).click()
  const download = await downloadPromise

  expect(download.suggestedFilename()).toBe('duas-partes.md')
  const content = await readFile(await download.path(), 'utf8')
  expect(content).toBe('# Duas partes\n\nAntes.\n\n* * *\n\nDepois.\n')
})

test('remover uma história preserva as cenas como cenas soltas', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '+ História' }).click()
  await page.getByRole('textbox', { name: 'Título da história' }).fill('Livro um')

  const story = page.getByRole('region', { name: 'Livro um' })
  await story.getByRole('button', { name: '+ Cena' }).click()
  await page.getByRole('textbox', { name: 'Título da cena' }).fill('Prólogo')
  await expect(story.getByRole('button', { name: 'Prólogo' })).toBeVisible()

  await story.getByRole('button', { name: 'Remover' }).click()
  await story.getByRole('button', { name: 'Remover história' }).click()

  await expect(page.getByRole('region', { name: 'Livro um' })).toHaveCount(0)
  await expect(
    page.getByRole('region', { name: 'Cenas soltas' }).getByRole('button', { name: 'Prólogo' }),
  ).toBeVisible()
})

test('apagar uma cena pede confirmação e respeita o cancelamento (botão ou Esc)', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Começar a escrever' }).click()
  await page.getByRole('textbox', { name: 'Título da cena' }).fill('Importante')

  await page.getByRole('button', { name: 'Apagar', exact: true }).click()
  await page.getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.getByRole('button', { name: 'Importante' })).toBeVisible()

  await page.getByRole('button', { name: 'Apagar', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Importante' })).toBeVisible()

  await page.getByRole('button', { name: 'Apagar', exact: true }).click()
  await page.getByRole('button', { name: 'Apagar cena' }).click()
  await expect(page.getByRole('button', { name: 'Importante' })).toHaveCount(0)
})

test('não perde o texto ao recarregar logo depois de digitar', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Começar a escrever' }).click()
  await page.keyboard.type('Texto urgente')
  // Recarrega antes do salvamento automático ocorrer.
  await page.reload()

  await page.getByRole('button', { name: 'Nova cena' }).click()
  await expect(editor(page)).toContainText('Texto urgente')
})
