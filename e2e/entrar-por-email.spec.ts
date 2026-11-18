import { createFakeSupabase, PASSWORD, PEOPLE, SERVER } from './fakeSupabase.ts'
import { expect, test, type Page } from './fixtures.ts'

type Fake = ReturnType<typeof createFakeSupabase>

/** Abre "Entrar" e liga o servidor de teste (o e-mail fica escrito). */
async function openEntrar(page: Page, email: string) {
  await page.goto('/app/')
  await page.getByRole('button', { name: 'Entrar' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Entrar no Papirus' })
  const endereco = dialog.getByRole('textbox', { name: 'Endereço do projeto' })
  const emailBox = dialog.getByRole('textbox', { name: 'E-mail' })
  await endereco.or(emailBox).first().waitFor()
  // Neste aparelho o servidor já pode estar ligado (uma aba que já usou o app): aí vai direto ao e-mail.
  if (await endereco.count()) {
    await endereco.fill(SERVER)
    await dialog.getByRole('textbox', { name: 'Chave pública (anon key)' }).fill('eyJ.chave-de-teste')
    await dialog.getByRole('button', { name: 'Pronto' }).click()
  }
  await emailBox.fill(email)
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

/*
 * O Papirus instalado no celular. O link do e-mail pode abrir no navegador em vez de no app: o app diz o que fazer.
 * "Instalado" é simulado com display-mode: standalone; "Android" e "iPhone" pelo userAgent. No Android o app instalado
 * usa o mesmo armazenamento do navegador (mesmo contexto aqui); no iPhone o do app é separado (outro contexto).
 */
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const AVISO_APP = 'Se o link abrir no navegador em vez deste app, tudo bem: volte pelo ícone do Papirus e, se a conta não aparecer aqui, entre de novo.'

type Browser = import('@playwright/test').Browser

async function celular(browser: Browser, fake: Fake, userAgent: string, comServidor = false) {
  const context = await browser.newContext({ userAgent, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  await context.addInitScript(
    (conhece: boolean) => localStorage.getItem('papirus:prefs') || localStorage.setItem('papirus:prefs', JSON.stringify(conhece ? { tourDone: true, server: { url: 'https://papirus-teste.supabase.co', anonKey: 'eyJ.chave-de-teste' } } : { tourDone: true })),
    comServidor,
  )
  await fake.attach(context)
  return context
}

/** Esta página roda como app instalado (a janela do ícone), e não como aba do navegador. */
async function comoAppInstalado(page: Page) {
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window)
    window.matchMedia = (q: string) => (q.includes('display-mode') && q.includes('standalone') ? ({ matches: true, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false } as MediaQueryList) : original(q))
  })
}

async function pedirLinkSemSenha(page: Page, email: string) {
  const dialog = await openEntrar(page, email)
  await dialog.getByRole('button', { name: 'Entrar sem senha (link por e-mail)' }).click()
  await dialog.getByRole('button', { name: 'Mandar o link' }).click()
  await expect(dialog.getByRole('status')).toContainText('Abra-o no aparelho em que quer entrar')
  return dialog
}

test('app instalado: ao pedir o link do e-mail, o recado de que ele pode abrir no navegador (nos três e-mails)', async ({ browser }) => {
  const fake = createFakeSupabase()
  const context = await celular(browser, fake, ANDROID)
  const page = await context.newPage()
  await comoAppInstalado(page)

  // Entrar sem senha.
  const dialog = await pedirLinkSemSenha(page, PEOPLE.bia.email)
  await expect(dialog.getByRole('status')).toContainText(AVISO_APP)
  // Esqueci a senha.
  await dialog.getByRole('button', { name: 'Entrar com senha' }).click()
  await dialog.getByRole('button', { name: 'Esqueci a senha' }).click()
  await expect(dialog.getByRole('status')).toContainText('o Papirus pede a senha nova')
  await expect(dialog.getByRole('status')).toContainText(AVISO_APP)
  // Confirmar a conta nova (o servidor pede o e-mail antes de entrar).
  fake.setConfirmarEmail(true)
  await dialog.getByRole('tab', { name: 'Criar conta' }).click()
  await dialog.getByRole('textbox', { name: 'E-mail' }).fill('dani@exemplo.com')
  await dialog.getByLabel('Senha', { exact: true }).fill('segredo123')
  await dialog.getByLabel('Repita a senha').fill('segredo123')
  await dialog.getByRole('button', { name: 'Continuar' }).click()
  await dialog.getByRole('button', { name: 'Criar conta' }).click()
  await expect(dialog).toContainText('Confira seu e-mail')
  await expect(dialog).toContainText('Abra-o neste aparelho para confirmar a conta.')
  await expect(dialog).toContainText(AVISO_APP)
  expect(fake.mail.map((m) => m.kind)).toEqual(['magiclink', 'recovery', 'signup'])

  // Fora do app instalado (aba do navegador), o recado não aparece.
  const aba = await context.newPage()
  const d2 = await pedirLinkSemSenha(aba, PEOPLE.bia.email)
  await expect(d2.getByRole('status')).not.toContainText('ícone do Papirus')
  await context.close()
})

test('app instalado já aberto: o link só troca o #, entra na hora, sem recarregar, e o endereço fica limpo', async ({ browser }) => {
  const fake = createFakeSupabase()
  const context = await celular(browser, fake, ANDROID)
  const page = await context.newPage()
  await comoAppInstalado(page)
  const dialog = await pedirLinkSemSenha(page, PEOPLE.bia.email)
  await dialog.getByRole('button', { name: 'Fechar' }).click()
  await page.evaluate(() => ((window as unknown as { __ficou: boolean }).__ficou = true))
  // O Android entrega o link ao app que já está aberto: muda só o # (isso dispara o hashchange).
  const hash = new URL(fake.linkFor(fake.mail[0])).hash
  await page.evaluate((h) => (location.hash = h), hash)
  await expect(page.getByRole('status').filter({ hasText: `Você entrou como ${PEOPLE.bia.email}` })).toBeVisible()
  await expect(page.getByRole('button', { name: `Conta: ${PEOPLE.bia.email}` }).first()).toBeVisible()
  expect(page.url()).not.toContain('access_token')
  expect(await page.evaluate(() => (window as unknown as { __ficou?: boolean }).__ficou)).toBe(true)
  // Dentro do app instalado, o recado do navegador não faz sentido.
  await expect(page.getByRole('status').filter({ hasText: 'Usa o Papirus pelo ícone' })).toHaveCount(0)
  await context.close()
})

test('Android: o link abre no navegador, entra, avisa onde continuar, e o app instalado (mesmo armazenamento) já fica com a conta', async ({ browser }) => {
  const fake = createFakeSupabase()
  const context = await celular(browser, fake, ANDROID)
  // O app instalado, aberto, esperando o link.
  const app = await context.newPage()
  await comoAppInstalado(app)
  await pedirLinkSemSenha(app, PEOPLE.bia.email)
  // O link abre numa aba do navegador.
  const aba = await context.newPage()
  await aba.goto(fake.linkFor(fake.mail[0]))
  const aviso = aba.getByRole('status').filter({ hasText: `Você entrou como ${PEOPLE.bia.email}` })
  await expect(aviso).toContainText('Usa o Papirus pelo ícone na tela inicial? Abra por lá: se a conta não aparecer, entre de novo.')
  expect(aba.url()).not.toContain('access_token')
  // O app instalado, sem recarregar, já mostra a conta.
  await expect(app.getByRole('button', { name: `Conta: ${PEOPLE.bia.email}` }).first()).toBeVisible()
  await context.close()
})

test('iPhone: o app da tela inicial tem armazenamento próprio, então segue sem conta, e o recado diz o que fazer', async ({ browser }) => {
  const fake = createFakeSupabase()
  const appCtx = await celular(browser, fake, IPHONE)
  const app = await appCtx.newPage()
  await comoAppInstalado(app)
  const dialog = await pedirLinkSemSenha(app, PEOPLE.bia.email)
  await expect(dialog.getByRole('status')).toContainText(AVISO_APP)

  // O link abriu no Safari (outro armazenamento).
  const safariCtx = await celular(browser, fake, IPHONE, true)
  const safari = await safariCtx.newPage()
  await safari.goto(fake.linkFor(fake.mail[0]))
  await expect(safari.getByRole('status').filter({ hasText: `Você entrou como ${PEOPLE.bia.email}` })).toContainText('Usa o Papirus pelo ícone na tela inicial?')

  // O app: sem conta, com o recado ainda na tela; entrar de novo funciona.
  await app.waitForTimeout(800)
  await expect(app.getByRole('button', { name: `Conta: ${PEOPLE.bia.email}` })).toHaveCount(0)
  await expect(dialog.getByRole('status')).toContainText('entre de novo')
  await dialog.getByRole('button', { name: 'Entrar com senha' }).click()
  await dialog.getByLabel('Senha').fill(PASSWORD)
  await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(app.getByRole('dialog', { name: 'Sua conta' })).toContainText(PEOPLE.bia.email)
  await appCtx.close()
  await safariCtx.close()
})

test('trocar a senha no navegador do celular: o recado diz para entrar com a senha nova pelo ícone; no computador, nada', async ({ browser, page }) => {
  const fake = createFakeSupabase()
  const context = await celular(browser, fake, ANDROID)
  const m = await context.newPage()
  const dialog = await openEntrar(m, PEOPLE.ana.email)
  await dialog.getByRole('button', { name: 'Esqueci a senha' }).click()
  await expect(dialog.getByRole('status')).toContainText('o Papirus pede a senha nova')
  await m.goto(fake.linkFor(fake.mail[0]))
  const nova = m.getByRole('dialog', { name: 'Escolha a senha nova' })
  await nova.getByLabel('Senha nova', { exact: true }).fill('outra456')
  await nova.getByLabel('Repita a senha nova').fill('outra456')
  await nova.getByRole('button', { name: /Salvar a senha nova/ }).click()
  const aviso = m.getByRole('status').filter({ hasText: 'Senha nova salva' })
  await expect(aviso).toContainText('Usa o Papirus pelo ícone na tela inicial? Abra por lá e entre com a senha nova.')
  await context.close()

  // No computador (sem celular), só o aviso de sempre.
  await setup(page, fake)
  const d2 = await openEntrar(page, PEOPLE.ana.email)
  await d2.getByRole('button', { name: 'Esqueci a senha' }).click()
  await page.goto(fake.linkFor(fake.mail[1]))
  const n2 = page.getByRole('dialog', { name: 'Escolha a senha nova' })
  await n2.getByLabel('Senha nova', { exact: true }).fill('terceira789')
  await n2.getByLabel('Repita a senha nova').fill('terceira789')
  await n2.getByRole('button', { name: /Salvar a senha nova/ }).click()
  const a2 = page.getByRole('status').filter({ hasText: 'Senha nova salva' })
  await expect(a2).toBeVisible()
  await expect(a2).not.toContainText('ícone')
})

test('link já usado: explica que o programa de e-mail pode ter aberto antes; outros erros não repetem isso', async ({ page }) => {
  const fake = createFakeSupabase()
  await setup(page, fake)
  await page.goto('/app/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired')
  const problem = page.getByRole('dialog', { name: 'O link não funcionou' })
  await expect(problem).toContainText('venceu ou já foi usado')
  await expect(problem).toContainText('o seu programa de e-mail abriu o link antes (para checar se é seguro). Peça outro e abra logo, no aparelho em que quer entrar.')
  await problem.getByRole('button', { name: 'Entendi' }).click()
  await page.goto('/app/#error=server_error&error_code=unexpected_failure&error_description=Algo+deu+errado')
  const outro = page.getByRole('dialog', { name: 'O link não funcionou' })
  await expect(outro).toContainText('O link do e-mail não funcionou (Algo deu errado)')
  await expect(outro).not.toContainText('programa de e-mail')
})
