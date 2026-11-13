import { createFakeSupabase, PASSWORD, PEOPLE, SERVER } from './fakeSupabase.ts'
import { expect, test, type Page } from './fixtures.ts'

type Fake = ReturnType<typeof createFakeSupabase>

/** Abre "Entrar" e liga o servidor de teste (o e-mail fica escrito). */
async function openEntrar(page: Page, email: string) {
  await page.goto('/app/')
  await page.getByRole('button', { name: 'Entrar' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Entrar no Papirus' })
  await dialog.getByRole('textbox', { name: 'Endereço do projeto' }).fill(SERVER)
  await dialog.getByRole('textbox', { name: 'Chave pública (anon key)' }).fill('eyJ.chave-de-teste')
  await dialog.getByRole('button', { name: 'Pronto' }).click()
  await dialog.getByRole('textbox', { name: 'E-mail' }).fill(email)
  return dialog
}

async function setup(page: Page, fake: Fake) {
  await page.context().addInitScript(() => localStorage.getItem('papirus:prefs') || localStorage.setItem('papirus:prefs', JSON.stringify({ tourDone: true })))
  await fake.attach(page.context())
}

test('Esqueci a senha: o link do e-mail pede a senha nova, e ela passa a valer', async ({ page, browser }) => {
  const fake = createFakeSupabase()
  await setup(page, fake)
  const dialog = await openEntrar(page, PEOPLE.ana.email)
  await dialog.getByRole('button', { name: 'Esqueci a senha' }).click()
  await expect(dialog.getByRole('status')).toContainText('o Papirus pede a senha nova')
  expect(fake.mail.map((m) => `${m.kind}|${m.email}|${new URL(m.redirectTo).pathname}`)).toEqual([`recovery|${PEOPLE.ana.email}|/app/`])

  // Abre o link do e-mail com o app já aberto (só muda o #, como no app instalado do Android).
  await page.goto(fake.linkFor(fake.mail[0]))
  const nova = page.getByRole('dialog', { name: 'Escolha a senha nova' })
  await expect(nova).toBeVisible()
  expect(page.url()).not.toContain('access_token')
  await nova.getByLabel('Senha nova', { exact: true }).fill('outra456')
  await nova.getByLabel('Repita a senha nova').fill('outra4')
  await expect(nova.getByRole('button', { name: /Salvar a senha nova/ })).toBeDisabled()
  await nova.getByLabel('Repita a senha nova').fill('outra456')
  await nova.getByRole('button', { name: /Salvar a senha nova/ }).click()
  await expect(nova).toBeHidden()
  await expect(page.getByRole('status').filter({ hasText: 'Senha nova salva' })).toBeVisible()
  await expect(page.getByRole('button', { name: `Conta: ${PEOPLE.ana.email}` }).first()).toBeVisible()

  // Noutro aparelho: a antiga não entra mais; a nova entra.
  const other = await browser.newContext()
  await other.addInitScript(() => localStorage.setItem('papirus:prefs', JSON.stringify({ tourDone: true })))
  await fake.attach(other)
  const page2 = await other.newPage()
  const d2 = await openEntrar(page2, PEOPLE.ana.email)
  await d2.getByLabel('Senha').fill(PASSWORD)
  await d2.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(d2.getByRole('alert')).toContainText('não conferem')
  await d2.getByLabel('Senha').fill('outra456')
  await d2.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page2.getByRole('dialog', { name: 'Sua conta' })).toContainText(PEOPLE.ana.email)
})

test('Entrar sem senha: só para quem tem conta, o link entra e avisa; link vencido explica', async ({ page }) => {
  const fake = createFakeSupabase()
  await setup(page, fake)
  const dialog = await openEntrar(page, 'ninguem@exemplo.com')
  await dialog.getByRole('button', { name: 'Entrar sem senha (link por e-mail)' }).click()
  await dialog.getByRole('button', { name: 'Mandar o link' }).click()
  await expect(dialog.getByRole('alert')).toContainText('Não há conta com este e-mail')
  await dialog.getByRole('textbox', { name: 'E-mail' }).fill(PEOPLE.bia.email)
  await dialog.getByRole('button', { name: 'Mandar o link' }).click()
  await expect(dialog.getByRole('status')).toContainText('Abra-o no aparelho em que quer entrar')
  expect(fake.mail.map((m) => `${m.kind}|${m.email}`)).toEqual([`magiclink|${PEOPLE.bia.email}`])

  // Agora numa aba nova (o app abre do zero com o link).
  await page.goto('about:blank')
  await page.goto(fake.linkFor(fake.mail[0]))
  await expect(page.getByRole('status').filter({ hasText: `Você entrou como ${PEOPLE.bia.email}` })).toBeVisible()
  await expect(page.getByRole('button', { name: `Conta: ${PEOPLE.bia.email}` }).first()).toBeVisible()
  expect(page.url()).not.toContain('access_token')

  // Link que venceu ou já foi usado (vindo pela apresentação, como quando o servidor manda para o endereço principal).
  await page.goto('/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired')
  const problem = page.getByRole('dialog', { name: 'O link não funcionou' })
  await expect(problem).toContainText('venceu ou já foi usado')
  expect(page.url()).not.toContain('otp_expired')
  await problem.getByRole('button', { name: 'Entendi' }).click()
  await expect(problem).toBeHidden()
  // Quem já estava dentro continua dentro.
  await expect(page.getByRole('button', { name: `Conta: ${PEOPLE.bia.email}` }).first()).toBeVisible()
})
