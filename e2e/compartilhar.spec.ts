import type { Browser } from '@playwright/test'
import { createFakeSupabase, PASSWORD, SERVER } from './fakeSupabase.ts'
import { runPageTour } from './pageTour.ts'
import { expect, test, type Page } from './fixtures.ts'

type Fake = ReturnType<typeof createFakeSupabase>

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

test('compartilhar: convidar para editar, as mudanças chegam, o link só lê e o acesso pode ser tirado', async ({ page, browser }) => {
  test.setTimeout(120_000)
  const fake = createFakeSupabase()
  await fake.attach(page.context())

  // Ana escreve e entra na conta.
  await page.goto('/app/')
  await page.getByRole('textbox', { name: 'Nome do novo universo' }).fill('Ostria')
  await page.getByRole('button', { name: 'Criar universo' }).click()
  await page.getByRole('button', { name: 'Começar a escrever' }).click()
  await page.getByRole('textbox', { name: 'Texto da cena' }).click()
  await page.keyboard.type('Era noite em Ostria.')
  await expect(page.getByRole('status').first()).toHaveText('Salvo')
  await signIn(page, 'ana@exemplo.com')

  // Compartilha: Bia pode editar, e um link de leitura.
  await page.getByRole('button', { name: 'Compartilhar', exact: true }).first().click()
  const share = page.getByRole('dialog', { name: 'Compartilhar' })
  await share.getByRole('button', { name: 'Começar a compartilhar' }).click()
  await share.getByRole('textbox', { name: 'E-mail de quem convidar' }).fill('Bia@Exemplo.com')
  await share.getByRole('combobox', { name: 'O que pode fazer' }).selectOption('editar')
  await share.getByRole('button', { name: 'Convidar' }).click()
  await expect(share.getByRole('status')).toContainText('Avise bia@exemplo.com')
  await expect(share.getByRole('combobox', { name: 'O que bia@exemplo.com pode fazer' })).toHaveValue('editar')
  await share.getByRole('button', { name: 'Criar link de leitura' }).click()
  const bookLink = await share.getByRole('textbox', { name: 'Link de leitura' }).inputValue()
  expect(bookLink).toContain('modo=livro')
  await share.getByRole('radio', { name: 'Universo inteiro' }).click()
  const link = await share.getByRole('textbox', { name: 'Link de leitura' }).inputValue()
  expect(link).toContain('?ler=')
  expect(link).not.toContain('modo=livro')
  // O (?) da janela explica cada parte.
  const ajuda = await runPageTour(page, 'Compartilhar')
  expect(ajuda.filter((s) => s.spot).map((s) => s.title)).toEqual(['Convidar', 'Quem tem acesso', 'Link de leitura', 'Segredos'])
  await share.getByRole('button', { name: 'Fechar' }).click()
  expect(fake.tables.papirus_members).toHaveLength(1)

  // Bia entra e acha o universo em "Compartilhados com você".
  const bia = await newPerson(browser, fake)
  await bia.goto('/app/')
  await signIn(bia, 'bia@exemplo.com')
  const shared = bia.getByRole('list', { name: 'Compartilhados com você' })
  await expect(shared).toContainText('compartilhado por ana · pode editar')
  await shared.getByRole('button', { name: /^Ostria compartilhado/ }).click()
  await expect(bia.getByRole('status').filter({ hasText: 'Universo de ana' })).toBeVisible()
  await bia.getByRole('button', { name: 'Escrever' }).click()
  const biaText = bia.getByRole('textbox', { name: 'Texto da cena' })
  await expect(biaText).toContainText('Era noite em Ostria.')
  await biaText.click()
  await bia.keyboard.press('Control+End')
  await bia.keyboard.type(' Bia chegou.')

  // O texto da Bia aparece na tela da Ana, sem recarregar.
  await expect(page.getByRole('textbox', { name: 'Texto da cena' })).toContainText('Bia chegou.', { timeout: 40_000 })

  // Pelo link, sem conta: lê, mas não escreve.
  const reader = await newPerson(browser, fake)
  const local = new URL(link)
  await reader.goto(`/app/${local.search}`)
  await expect(reader.getByRole('status').filter({ hasText: 'pelo link' })).toBeVisible()
  await reader.getByRole('button', { name: 'Escrever' }).click()
  const readerText = reader.getByRole('textbox', { name: 'Texto da cena' })
  await expect(readerText).toContainText('Bia chegou.')
  await expect(readerText).toHaveAttribute('contenteditable', 'false')
  await reader.getByRole('button', { name: 'Nova cena' }).first().click()
  await expect(reader.getByText('Você está lendo pelo link: aqui nada pode ser mudado.')).toBeVisible()

  // Como livro: o modo leitor, sem a área de trabalho.
  const bookReader = await newPerson(browser, fake)
  await bookReader.goto(`/app/${new URL(bookLink).search}`)
  await expect(bookReader.getByRole('heading', { name: 'Nova cena' })).toBeVisible()
  await expect(bookReader.getByText('Bia chegou.')).toBeVisible()
  await expect(bookReader.getByRole('navigation', { name: 'Áreas' })).toHaveCount(0)

  // Ana tira o acesso de edição: a Bia fica sabendo.
  await page.getByRole('button', { name: 'Compartilhar', exact: true }).first().click()
  await share.getByRole('button', { name: 'Tirar o acesso de bia@exemplo.com' }).click()
  await expect(share.getByText('Ninguém convidado ainda.')).toBeVisible()
  await expect(bia.getByText('Seu acesso a este universo foi tirado.')).toBeVisible({ timeout: 20_000 })

  // Desligar o link: quem abrir depois não lê mais.
  await share.getByRole('button', { name: 'Desligar o link' }).click()
  await expect(share.getByRole('button', { name: 'Criar link de leitura' })).toBeVisible()
  const late = await newPerson(browser, fake)
  await late.goto(`/app/${local.search}`)
  await expect(late.getByRole('alert')).toContainText('Este link de leitura foi desligado ou trocado.')
})
