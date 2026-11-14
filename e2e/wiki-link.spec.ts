import type { Browser } from '@playwright/test'
import { createFakeSupabase, PASSWORD, SERVER } from './fakeSupabase.ts'
import { expect, test, type Page } from './fixtures.ts'

type Fake = ReturnType<typeof createFakeSupabase>

async function newPerson(browser: Browser, fake: Fake, mobile = false): Promise<Page> {
  const context = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 } } : {})
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

test('wiki com link: o dono pega o link na página Wiki, e quem abre vê a wiki sem conta e sem segredos', async ({ page, browser }) => {
  test.setTimeout(120_000)
  const fake = createFakeSupabase()
  await fake.attach(page.context())

  // Ana abre o mundo de Ostria (tem fichas secretas) e entra na conta.
  await page.goto('/app/?exemplo=ostria')
  await expect(page.getByRole('heading', { name: /As Cinzas de Ostria/ }).first()).toBeVisible()
  await signIn(page, 'ana@exemplo.com')

  // Na página Wiki: "Pegar o link da wiki" abre o Compartilhar já no jeito "Wiki do mundo".
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Mundo/ }).first().click()
  await page.getByRole('button', { name: 'Wiki', exact: true }).click()
  await page.getByRole('button', { name: 'Pegar o link da wiki' }).click()
  const share = page.getByRole('dialog', { name: 'Compartilhar' })
  await share.getByRole('button', { name: 'Começar a compartilhar' }).click()
  await share.getByRole('button', { name: 'Criar link de leitura' }).click()
  await expect(share.getByRole('radio', { name: 'Wiki do mundo' })).toHaveAttribute('aria-checked', 'true')
  const link = await share.getByRole('textbox', { name: 'Link de leitura' }).inputValue()
  expect(link).toContain('modo=wiki')
  await share.getByRole('button', { name: 'Fechar' }).click()

  // Sem conta, no celular: só a wiki, sem a área de trabalho.
  const reader = await newPerson(browser, fake, true)
  await reader.goto(`/app/${new URL(link).search}`)
  await expect(reader.getByText(/Wiki de/).first()).toBeVisible()
  await expect(reader.getByRole('navigation', { name: 'Áreas' })).toHaveCount(0)
  const wiki = reader.frameLocator('iframe.wiki-link-frame')
  // O que é estabelecido aparece; o que é secreto, não.
  await expect(wiki.getByText('A antiga casa real de Ostria.').first()).toBeAttached()
  await expect(wiki.getByText('Ninguém em Ostria sabe que ele sobreviveu')).toHaveCount(0)
  await expect(wiki.getByText('Último príncipe da Casa de Vaelor')).toHaveCount(0)
  await expect(reader.getByRole('button', { name: 'Baixar' })).toBeEnabled()
  // No celular, a wiki ocupa a tela inteira (sem rolagem de lado, sem faixa vazia) e a busca e o Índice estão à mão.
  expect(await reader.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const quadro = (await reader.locator('iframe.wiki-link-frame').boundingBox())!
  expect(quadro.width).toBeGreaterThanOrEqual(388)
  expect(quadro.height).toBeGreaterThan(600)
  await expect(wiki.locator('#busca')).toBeVisible()
  await expect(wiki.locator('#menu')).toBeVisible()

  // Desligado o link, a wiki para de abrir.
  await page.getByRole('button', { name: 'Compartilhar', exact: true }).first().click()
  await share.getByRole('button', { name: 'Desligar o link' }).click()
  await expect(share.getByRole('button', { name: 'Criar link de leitura' })).toBeVisible()
  const late = await newPerson(browser, fake, true)
  await late.goto(`/app/${new URL(link).search}`)
  await expect(late.getByText('Este link de leitura foi desligado ou trocado.', { exact: false })).toBeVisible()
})

test('wiki com link só até uma cena: o dono escolhe no Compartilhar e quem abre não vê o que vem depois', async ({ page, browser }) => {
  test.setTimeout(150_000)
  const fake = createFakeSupabase()
  await fake.attach(page.context())
  await page.goto('/app/?exemplo=ostria')
  await expect(page.getByRole('heading', { name: /As Cinzas de Ostria/ }).first()).toBeVisible()
  await signIn(page, 'ana@exemplo.com')

  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Mundo/ }).first().click()
  await page.getByRole('button', { name: 'Wiki', exact: true }).click()
  await page.getByRole('button', { name: 'Pegar o link da wiki' }).click()
  const share = page.getByRole('dialog', { name: 'Compartilhar' })
  await share.getByRole('button', { name: 'Começar a compartilhar' }).click()
  await share.getByRole('button', { name: 'Criar link de leitura' }).click()
  const link = await share.getByRole('textbox', { name: 'Link de leitura' }).inputValue()

  // Sem escolha, a wiki do link traz a história toda (menos os segredos): Cassian aparece (só depois da primeira cena).
  const reader = await newPerson(browser, fake, true)
  await reader.goto(`/app/${new URL(link).search}`)
  const wiki = reader.frameLocator('iframe.wiki-link-frame')
  await expect(wiki.locator('h2', { hasText: /^Cassian$/ })).toBeAttached()

  // O dono limita o link à primeira cena.
  const upto = share.getByRole('combobox', { name: 'Até onde vai a wiki do link' })
  await expect(upto).toHaveValue('')
  await upto.selectOption({ label: 'Só o que o leitor sabe até “A chegada” (1)' })
  await share.getByRole('button', { name: 'Fechar' }).click()
  // A prévia do dono mostra o mesmo, com um aviso.
  await expect(page.getByRole('status').filter({ hasText: 'A prévia vai só até “A chegada”' })).toBeVisible()

  // A cópia de leitura do link muda na hora (sem esperar o próximo envio da nuvem).
  await expect.poll(() => JSON.stringify(fake.tables.papirus_shares[0]?.data ?? {}).includes('upToScene'), { timeout: 15_000 }).toBe(true)
  // Quem abre o link (de novo, quando a mudança já chegou à nuvem) não vê o que vem depois da cena escolhida.
  await expect
    .poll(
      async () => {
        await reader.reload()
        await expect(reader.getByText(/Wiki de/).first()).toBeVisible()
        await expect(reader.locator('iframe.wiki-link-frame')).toBeVisible()
        return reader.frameLocator('iframe.wiki-link-frame').locator('h2', { hasText: /^Cassian$/ }).count()
      },
      { timeout: 60_000, intervals: [1500] },
    )
    .toBe(0)
  const limited = reader.frameLocator('iframe.wiki-link-frame')
  await expect(limited.locator('h2', { hasText: /^Kael$/ })).toBeAttached()
  await expect(limited.getByText('Tem os mesmos olhos cinzentos do retrato')).toHaveCount(0)
  await expect(limited.getByText(/até “A chegada”/).first()).toBeAttached()

  // Voltar a "história toda" traz tudo de volta no link.
  await page.getByRole('button', { name: 'Compartilhar', exact: true }).first().click()
  await share.getByRole('radio', { name: 'Wiki do mundo' }).click()
  await share.getByRole('combobox', { name: 'Até onde vai a wiki do link' }).selectOption('')
  await share.getByRole('button', { name: 'Fechar' }).click()
  await expect
    .poll(
      async () => {
        await reader.reload()
        await expect(reader.locator('iframe.wiki-link-frame')).toBeVisible()
        return reader.frameLocator('iframe.wiki-link-frame').locator('h2', { hasText: /^Cassian$/ }).count()
      },
      { timeout: 60_000, intervals: [1500] },
    )
    .toBe(1)
})
