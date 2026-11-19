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
  // E escreve uma história nova no AU, com uma cena (a história é dela: não é lore).
  await nav(bia, 'Escrever').click()
  const arvore = bia.getByRole('complementary', { name: 'Manuscrito' })
  if (await bia.getByRole('button', { name: 'Mostrar manuscrito' }).count()) await bia.getByRole('button', { name: 'Mostrar manuscrito' }).click()
  await arvore.getByRole('button', { name: 'Nova história' }).click()
  await arvore.getByRole('region', { name: 'Nova história' }).getByRole('textbox', { name: 'Título da história' }).fill('A Selma em Ostria')
  await arvore.getByRole('region', { name: 'A Selma em Ostria' }).getByRole('button', { name: 'Nova cena' }).click()
  await bia.getByRole('textbox', { name: 'Título da cena' }).fill('Chegada da Selma')
  await bia.getByRole('textbox', { name: 'Texto da cena' }).click()
  await bia.keyboard.type('Selma desembarcou no porto de Ostria.')
  await bia.waitForTimeout(1200)
  await bia.getByRole('button', { name: 'Mostrar ao autor' }).click()
  await expect(bia.getByText('ana já pode ver este AU')).toBeVisible({ timeout: 20_000 })

  // Ana vê o AU em Compartilhar: a ficha Selma e a história nova. Primeiro, a história.
  await page.getByRole('button', { name: 'Compartilhar', exact: true }).first().click()
  await share.getByRole('button', { name: 'Ver o que nasceu lá (2)' }).click({ timeout: 20_000 })
  const historia = share.getByRole('checkbox', { name: /A Selma em Ostria/ })
  await expect(historia).toBeVisible()
  await expect(share.getByText('Vira uma história nova no seu mundo, com a cena dela e as fichas que elas usam.')).toBeVisible()
  await historia.check()
  await share.getByRole('button', { name: 'Canonizar (1)' }).click()
  await expect(share.getByText('Pronto: 1 coisa virou canon (uma história com a cena; estão em Escrever).')).toBeVisible()
  // O aviso embaixo da tela tem o desfazer: devolve o universo a como estava, e a história volta a ser novidade.
  await page.getByRole('button', { name: 'Desfazer' }).click()
  await expect(share.getByRole('button', { name: 'Ver o que nasceu lá (2)' })).toBeVisible({ timeout: 20_000 })
  // A lista pode ter ficado aberta (o botão abre e fecha).
  if (!(await share.getByRole('checkbox', { name: /A Selma em Ostria/ }).count())) await share.getByRole('button', { name: 'Ver o que nasceu lá (2)' }).click()
  await share.getByRole('checkbox', { name: /A Selma em Ostria/ }).check()
  await share.getByRole('checkbox', { name: /^Ficha Selma/ }).check()
  await share.getByRole('button', { name: 'Canonizar (2)' }).click()
  await expect(share.getByText('2 coisas viraram canon (uma história com a cena; estão em Escrever)')).toBeVisible()
  await share.getByRole('button', { name: 'Fechar' }).click()
  await nav(page, 'Mundo').click()
  await expect(row(page, 'Selma')).toBeVisible()
  // A história e a cena chegaram ao mundo da Ana, e lá são dela (não é lore: dá para escrever).
  await nav(page, 'Escrever').click()
  const arvoreAna = page.getByRole('complementary', { name: 'Manuscrito' })
  if (await page.getByRole('button', { name: 'Mostrar manuscrito' }).count()) await page.getByRole('button', { name: 'Mostrar manuscrito' }).click()
  await expect(arvoreAna.getByRole('region', { name: 'A Selma em Ostria' })).toContainText('Chegada da Selma')
  await arvoreAna.getByRole('button', { name: /^Chegada da Selma/ }).click()
  await expect(page.getByRole('textbox', { name: 'Texto da cena' })).toContainText('Selma desembarcou no porto de Ostria.')
  await expect(page.getByRole('textbox', { name: 'Texto da cena' })).toHaveAttribute('contenteditable', 'true')

  // Bia traz as novidades: a Selma agora é do original.
  await bia.waitForTimeout(3000)
  await bia.getByRole('button', { name: 'Novidades do original' }).click()
  await nav(bia, 'Mundo').click()
  await expect(row(bia, 'Selma').getByText('Original')).toBeVisible({ timeout: 20_000 })
  // A história que a Ana canonizou agora é do original: no AU, vira lore (só leitura), e continua uma só.
  await nav(bia, 'Escrever').click()
  const arvoreBia = bia.getByRole('complementary', { name: 'Manuscrito' })
  if (await bia.getByRole('button', { name: 'Mostrar manuscrito' }).count()) await bia.getByRole('button', { name: 'Mostrar manuscrito' }).click()
  await expect(arvoreBia.getByRole('region', { name: 'A Selma em Ostria' })).toHaveCount(1)
  await arvoreBia.getByRole('button', { name: /^Chegada da Selma/ }).click()
  await expect(bia.getByText('é lore, dá para ler, não para mudar')).toBeVisible()
})
