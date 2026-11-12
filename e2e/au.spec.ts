import type { Browser } from '@playwright/test'
import { createFakeSupabase, PASSWORD, SERVER } from './fakeSupabase.ts'
import { expect, test, type Page } from './fixtures.ts'

type Fake = ReturnType<typeof createFakeSupabase>

const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name, exact: true })
const row = (page: Page, name: string) => page.locator('.entity-row').filter({ has: page.locator('.entity-row-name', { hasText: name }) })

async function newPerson(browser: Browser, fake: Fake): Promise<Page> {
  const context = await browser.newContext()
  await context.addInitScript(() => localStorage.setItem('papirus:prefs', JSON.stringify({ tourDone: true })))
  await fake.attach(context)
  return context.newPage()
}

async function signIn(page: Page, email: string) {
  await page.getByRole('button', { name: 'Entrar' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Entrar no Papirus' })
  await dialog.getByRole('textbox', { name: 'Endereço do projeto' }).fill(SERVER)
  await dialog.getByRole('textbox', { name: 'Chave pública (anon key)' }).fill('eyJ.chave-de-teste')
  await dialog.getByRole('button', { name: 'Pronto' }).click()
  await dialog.getByRole('textbox', { name: 'E-mail' }).fill(email)
  await dialog.getByLabel('Senha').fill(PASSWORD)
  await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
  const mine = page.getByRole('dialog', { name: 'Sua conta' })
  await expect(mine).toContainText(email)
  await mine.getByRole('button', { name: 'Fechar' }).click()
}

async function createFichas(page: Page, names: string) {
  await nav(page, 'Mundo').click()
  await page.getByRole('button', { name: 'Criar várias de uma vez' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Criar várias fichas' })
  await dialog.getByRole('textbox', { name: 'Um nome por linha' }).fill(names)
  await dialog.getByRole('combobox', { name: 'Tipo' }).selectOption('personagem')
  await dialog.getByRole('button', { name: /^Criar \d/ }).click()
}

test('AU: o autor autoriza, a outra pessoa cria o AU com a lore, e o autor canoniza o que nasceu lá', async ({ page, browser }) => {
  test.setTimeout(150_000)
  const fake = createFakeSupabase()
  await fake.attach(page.context())

  // Ana escreve, cria o Kael e autoriza a Bia a criar um AU.
  await page.goto('/app/')
  await page.getByRole('textbox', { name: 'Nome do novo universo' }).fill('Ostria')
  await page.getByRole('button', { name: 'Criar universo' }).click()
  await page.getByRole('button', { name: 'Começar a escrever' }).click()
  await page.getByRole('textbox', { name: 'Texto da cena' }).click()
  await page.keyboard.type('Era noite em Ostria.')
  await createFichas(page, 'Kael')
  await expect(row(page, 'Kael')).toBeVisible()
  await signIn(page, 'ana@exemplo.com')
  await page.getByRole('button', { name: 'Compartilhar', exact: true }).first().click()
  const share = page.getByRole('dialog', { name: 'Compartilhar' })
  await share.getByRole('button', { name: 'Começar a compartilhar' }).click()
  await share.getByRole('textbox', { name: 'E-mail de quem convidar' }).fill('bia@exemplo.com')
  await share.getByRole('combobox', { name: 'O que pode fazer' }).selectOption('au')
  await share.getByRole('button', { name: 'Convidar' }).click()
  await expect(share.getByRole('combobox', { name: 'O que bia@exemplo.com pode fazer' })).toHaveValue('au')
  await share.getByRole('button', { name: 'Fechar' }).click()

  // Bia abre o universo da Ana e cria o AU.
  const bia = await newPerson(browser, fake)
  await bia.goto('/app/')
  await signIn(bia, 'bia@exemplo.com')
  await bia.getByRole('list', { name: 'Compartilhados com você' }).getByRole('button', { name: /^Ostria compartilhado/ }).click()
  await bia.getByRole('button', { name: 'Criar um AU' }).click({ timeout: 20_000 })
  await expect(bia.getByRole('status').filter({ hasText: 'Universo alternativo de “Ostria”' })).toBeVisible()

  // No AU: o Kael é do original; a cena é lore, só leitura.
  await nav(bia, 'Mundo').click()
  await expect(row(bia, 'Kael').getByText('Original')).toBeVisible()
  await nav(bia, 'Escrever').click()
  await expect(bia.getByText('é lore, dá para ler, não para mudar')).toBeVisible()
  await expect(bia.getByRole('textbox', { name: 'Texto da cena' })).toHaveAttribute('contenteditable', 'false')

  // Bia cria a Selma e mostra o AU à Ana.
  await createFichas(bia, 'Selma')
  await expect(row(bia, 'Selma')).toBeVisible()
  await expect(row(bia, 'Selma').getByText('Original')).toHaveCount(0)
  await bia.getByRole('button', { name: 'Mostrar ao autor' }).click()
  await expect(bia.getByText('ana já pode ver este AU')).toBeVisible({ timeout: 20_000 })

  // Ana vê o AU em Compartilhar e canoniza a Selma.
  await page.getByRole('button', { name: 'Compartilhar', exact: true }).first().click()
  await share.getByRole('button', { name: 'Ver o que nasceu lá (1)' }).click({ timeout: 20_000 })
  await share.getByRole('checkbox', { name: /Selma/ }).check()
  await share.getByRole('button', { name: 'Canonizar (1)' }).click()
  await expect(share.getByText('1 coisa virou canon')).toBeVisible()
  await share.getByRole('button', { name: 'Fechar' }).click()
  await nav(page, 'Mundo').click()
  await expect(row(page, 'Selma')).toBeVisible()

  // Bia traz as novidades: a Selma agora é do original.
  await bia.waitForTimeout(3000)
  await bia.getByRole('button', { name: 'Novidades do original' }).click()
  await expect(row(bia, 'Selma').getByText('Original')).toBeVisible({ timeout: 20_000 })
})
