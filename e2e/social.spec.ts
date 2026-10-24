import type { Browser } from '@playwright/test'
import { createFakeSupabase, PASSWORD, SERVER } from './fakeSupabase.ts'
import { expect, test, type Page } from './fixtures.ts'

type Fake = ReturnType<typeof createFakeSupabase>

async function newPerson(browser: Browser, fake: Fake, prefs: object = {}): Promise<Page> {
  const context = await browser.newContext()
  await context.addInitScript((p) => localStorage.setItem('papirus:prefs', JSON.stringify({ tourDone: true, ...p })), prefs)
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

async function createProfile(dialog: ReturnType<Page['getByRole']>, handle: string, name: string) {
  await dialog.getByRole('textbox', { name: '@ (como te acham)' }).fill(handle)
  await dialog.getByRole('textbox', { name: 'Nome' }).fill(name)
  await dialog.getByRole('button', { name: 'Criar perfil' }).click()
  await expect(dialog.getByRole('tab', { name: 'Meu perfil' })).toBeVisible()
}

test('social: perfil, pedido de amizade, estante para amigos e para todo mundo', async ({ page, browser }) => {
  test.setTimeout(120_000)
  const fake = createFakeSupabase()
  await fake.attach(page.context())

  // Ana entra, põe um livro na estante para amigos e cria o perfil.
  await page.goto('/app/?exemplo')
  await signIn(page, 'ana@exemplo.com')
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Livro', exact: true }).click()
  await page.getByRole('button', { name: 'Novo livro' }).click()
  await page.getByRole('textbox', { name: 'Título' }).fill('A Maré')
  await page.getByRole('button', { name: 'Criar livro' }).click()
  const visibility = page.getByRole('radiogroup', { name: 'Quem vê “A Maré” no seu perfil' })
  await expect(visibility.getByRole('radio', { name: 'Só eu' })).toHaveAttribute('aria-checked', 'true')
  await visibility.getByRole('radio', { name: 'Amigos' }).click()
  await page.getByRole('textbox', { name: 'Sinopse (contracapa)' }).fill('Uma cidade que esquece quando a maré sobe.')
  await expect.poll(() => fake.tables.papirus_shelf.map((r) => `${r.title}|${r.visibility}|${r.blurb}`)).toEqual(['A Maré|amigos|Uma cidade que esquece quando a maré sobe.'])
  // Só a vitrine: o texto do livro não vai para a estante.
  expect(Object.keys(fake.tables.papirus_shelf[0])).not.toContain('text')

  await page.getByRole('button', { name: 'Ver meu perfil' }).click()
  const anaSocial = page.getByRole('dialog', { name: 'Perfil e amigos' })
  await expect(anaSocial.getByRole('textbox', { name: '@ (como te acham)' })).toHaveValue('ana')
  await createProfile(anaSocial, '@Ana Ribeiro', 'Ana Ribeiro')
  expect(fake.tables.papirus_profiles[0].handle).toBe('ana_ribeiro')
  await anaSocial.getByRole('button', { name: 'Fechar' }).click()

  // Bia cria perfil, acha a Ana: sem amizade, nada da estante aparece.
  const bia = await newPerson(browser, fake)
  await bia.goto('/app/')
  await signIn(bia, 'bia@exemplo.com')
  await bia.getByRole('button', { name: 'Perfil e amigos' }).click()
  const biaSocial = bia.getByRole('dialog', { name: 'Perfil e amigos' })
  await biaSocial.getByRole('textbox', { name: '@ (como te acham)' }).fill('ana_ribeiro')
  await biaSocial.getByRole('button', { name: 'Criar perfil' }).click()
  await expect(biaSocial.getByRole('alert')).toContainText('Esse @ já é de outra pessoa')
  await createProfile(biaSocial, 'bia', 'Bia')
  await biaSocial.getByRole('tab', { name: 'Amigos' }).click()
  await biaSocial.getByRole('textbox', { name: '@ da pessoa' }).fill('@ana_ribeiro')
  await biaSocial.getByRole('button', { name: 'Procurar' }).click()
  const anaProfile = bia.getByRole('dialog', { name: 'Ana Ribeiro' })
  await expect(anaProfile).toContainText('Nada aberto para você')
  await anaProfile.getByRole('button', { name: 'Adicionar amigo' }).click()
  await expect(anaProfile.getByRole('button', { name: 'Cancelar pedido' })).toBeVisible()
  await anaProfile.getByRole('button', { name: 'Fechar' }).click()

  // Ana aceita.
  await page.getByRole('button', { name: 'Ver meu perfil' }).click()
  await anaSocial.getByRole('tab', { name: /Amigos/ }).click()
  await expect(anaSocial.getByRole('region', { name: 'Pedidos para você' })).toContainText('@bia')
  await anaSocial.getByRole('button', { name: 'Aceitar' }).click()
  await expect(anaSocial.getByRole('region', { name: 'Amigos' })).toContainText('@bia')
  await anaSocial.getByRole('button', { name: 'Fechar' }).click()

  // Agora Bia vê o livro na estante da Ana, com a sinopse.
  await bia.getByRole('button', { name: 'Perfil e amigos' }).click()
  await biaSocial.getByRole('tab', { name: 'Amigos' }).click()
  await biaSocial.getByRole('region', { name: 'Amigos' }).getByRole('button', { name: 'Estante' }).click()
  const anaShelf = bia.getByRole('list', { name: 'Estante de @ana_ribeiro' })
  await expect(anaShelf).toContainText('A Maré')
  await expect(anaShelf).toContainText('Uma cidade que esquece quando a maré sobe.')
  await anaProfile.getByRole('button', { name: 'Fechar' }).click()

  // Sem conta: o link do perfil só mostra o que é de todo mundo.
  const stranger = await newPerson(browser, fake, { server: { url: SERVER, anonKey: 'eyJ.chave-de-teste' } })
  await stranger.goto('/app/?perfil=ana_ribeiro')
  await expect(stranger.getByRole('dialog', { name: 'Perfil e amigos' })).toContainText('Não achei @ana_ribeiro')

  await visibility.getByRole('radio', { name: 'Todo mundo' }).click()
  await expect.poll(() => fake.tables.papirus_shelf.map((r) => r.visibility)).toEqual(['publico'])
  await stranger.goto('/app/?perfil=ana_ribeiro')
  await expect(stranger.getByRole('list', { name: 'Estante de @ana_ribeiro' })).toContainText('A Maré')
  await expect(stranger.getByRole('button', { name: 'Entrar para adicionar' })).toBeVisible()

  // "Só eu" tira da estante.
  await visibility.getByRole('radio', { name: 'Só eu' }).click()
  await expect.poll(() => fake.tables.papirus_shelf.length).toBe(0)
})
