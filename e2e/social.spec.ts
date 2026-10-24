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
  await expect(dialog.getByRole('tab', { name: 'Perfil' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Salvar perfil' })).toBeVisible()
}

test('social: perfil, pedido de amizade, estante para amigos e para todo mundo', async ({ page, browser }) => {
  test.setTimeout(180_000)
  const fake = createFakeSupabase()
  await fake.attach(page.context())

  // Ana entra, põe um livro na estante para amigos e cria o perfil.
  await page.goto('/app/?exemplo=ostria')
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
  const anaSocial = page.getByRole('dialog', { name: 'Sua conta' })
  await expect(anaSocial.getByRole('textbox', { name: '@ (como te acham)' })).toHaveValue('ana')
  await createProfile(anaSocial, '@Ana Ribeiro', 'Ana Ribeiro')
  expect(fake.tables.papirus_profiles[0].handle).toBe('ana_ribeiro')
  await anaSocial.getByRole('button', { name: 'Fechar' }).click()

  // Bia cria perfil, acha a Ana: sem amizade, nada da estante aparece.
  const bia = await newPerson(browser, fake)
  await bia.goto('/app/')
  await signIn(bia, 'bia@exemplo.com')
  await bia.getByRole('button', { name: 'Conta: bia@exemplo.com' }).click()
  const biaSocial = bia.getByRole('dialog', { name: 'Sua conta' })
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
  await bia.getByRole('button', { name: 'Conta: bia@exemplo.com' }).click()
  await biaSocial.getByRole('tab', { name: 'Amigos' }).click()
  await biaSocial.getByRole('region', { name: 'Amigos' }).getByRole('button', { name: 'Estante' }).click()
  const anaShelf = bia.getByRole('list', { name: 'Estante de @ana_ribeiro' })
  await expect(anaShelf).toContainText('A Maré')
  await expect(anaShelf).toContainText('Uma cidade que esquece quando a maré sobe.')

  // Bia quer ler e comenta.
  await anaShelf.getByRole('button', { name: 'Quero ler' }).click()
  await expect(anaShelf.getByRole('button', { name: /Quero ler/ })).toHaveAttribute('aria-pressed', 'true')
  await anaShelf.getByRole('button', { name: 'Comentar' }).click()
  await anaShelf.getByRole('textbox', { name: 'Seu comentário' }).fill('Quero muito ler isso!')
  await anaShelf.getByRole('button', { name: 'Enviar' }).click()
  await expect(anaShelf.getByRole('region', { name: 'Comentários sobre A Maré' })).toContainText('Quero muito ler isso!')
  expect(fake.tables.papirus_shelf_reactions).toHaveLength(1)
  await anaProfile.getByRole('button', { name: 'Fechar' }).click()

  // Ana vê os avisos, abre o comentário no livro dela e apaga.
  await page.getByRole('button', { name: 'Ver meu perfil' }).click()
  await anaSocial.getByRole('tab', { name: /Avisos/ }).click()
  const avisos = anaSocial.getByRole('list', { name: 'Avisos' })
  await expect(avisos).toContainText('comentou em “A Maré”')
  await expect(avisos).toContainText('quer ler “A Maré”')
  await avisos.getByRole('button', { name: /comentou/ }).click()
  const myShelf = page.getByRole('list', { name: 'Estante de @ana_ribeiro' })
  const comments = myShelf.getByRole('region', { name: 'Comentários sobre A Maré' })
  await expect(comments).toContainText('Quero muito ler isso!')
  await expect(myShelf).toContainText('1 pessoa quer ler')
  await comments.getByRole('button', { name: 'Apagar comentário' }).click()
  await comments.getByRole('button', { name: 'Apagar', exact: true }).click()
  await expect(comments).toContainText('Ninguém comentou ainda.')
  expect(fake.tables.papirus_shelf_comments).toHaveLength(0)
  await page.getByRole('dialog', { name: 'Ana Ribeiro' }).getByRole('button', { name: 'Fechar' }).click()

  // Sem conta: o link do perfil só mostra o que é de todo mundo.
  const stranger = await newPerson(browser, fake, { server: { url: SERVER, anonKey: 'eyJ.chave-de-teste' } })
  await stranger.goto('/app/?perfil=ana_ribeiro')
  await expect(stranger.getByText('Não achamos esse perfil')).toBeVisible()

  await visibility.getByRole('radio', { name: 'Todo mundo' }).click()
  await expect.poll(() => fake.tables.papirus_shelf.map((r) => r.visibility)).toEqual(['publico'])
  await stranger.goto('/app/?perfil=ana_ribeiro')
  await expect(stranger.getByRole('list', { name: 'Estante de @ana_ribeiro' })).toContainText('A Maré')
  await expect(stranger.getByRole('heading', { name: 'Ana Ribeiro', level: 1 })).toBeVisible()
  await expect(stranger.getByRole('button', { name: 'Entrar para adicionar' })).toBeVisible()
  // Sem conta: vê quantos querem ler, mas para marcar precisa entrar.
  await expect(stranger.getByRole('button', { name: /Quero ler/ })).toContainText('1')
  await stranger.getByRole('button', { name: /Quero ler/ }).click()
  await expect(stranger.getByRole('dialog', { name: 'Entrar no Papirus' })).toBeVisible()

  // "Só eu" tira da estante.
  await visibility.getByRole('radio', { name: 'Só eu' }).click()
  await expect.poll(() => fake.tables.papirus_shelf.length).toBe(0)
})

test('criar conta: senha repetida e, depois, o perfil já pronto', async ({ page }) => {
  const fake = createFakeSupabase()
  await fake.attach(page.context())
  await page.goto('/app/')
  await page.getByRole('button', { name: 'Entrar' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Entrar no Papirus' })
  await dialog.getByRole('textbox', { name: 'Endereço do projeto' }).fill(SERVER)
  await dialog.getByRole('textbox', { name: 'Chave pública (anon key)' }).fill('eyJ.chave-de-teste')
  await dialog.getByRole('button', { name: 'Pronto' }).click()
  await dialog.getByRole('tab', { name: 'Criar conta' }).click()
  await expect(dialog.getByRole('listitem').filter({ hasText: 'Acesso' })).toHaveAttribute('aria-current', 'step')

  await dialog.getByRole('textbox', { name: 'E-mail' }).fill('Dani.Souza@exemplo.com')
  await dialog.getByLabel('Senha', { exact: true }).fill('segredo123')
  await dialog.getByLabel('Repita a senha').fill('segredo12')
  await expect(dialog.getByText('As duas senhas não são iguais.')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Continuar' })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Ver o que digitei' }).click()
  await expect(dialog.getByLabel('Senha', { exact: true })).toHaveAttribute('type', 'text')
  await dialog.getByLabel('Repita a senha').fill('segredo123')
  await dialog.getByRole('button', { name: 'Continuar' }).click()

  // Passo 2: o perfil.
  await expect(dialog.getByRole('listitem').filter({ hasText: 'Seu perfil' })).toHaveAttribute('aria-current', 'step')
  await expect(dialog.getByRole('textbox', { name: '@ (como te acham)' })).toHaveValue('dani.souza')
  await dialog.getByRole('textbox', { name: 'Nome', exact: true }).fill('Dani Souza')
  await dialog.getByRole('textbox', { name: 'Sobre você' }).fill('Escrevo fantasia e mestro aos sábados.')
  await dialog.getByRole('button', { name: 'Criar conta' }).click()

  // Entra direto, com o perfil criado.
  const hub = page.getByRole('dialog', { name: 'Sua conta' })
  await expect(hub).toContainText('Dani Souza')
  await expect(hub).toContainText('@dani.souza')
  expect(fake.tables.papirus_profiles.map((p) => `${p.handle}|${p.name}|${p.bio}`)).toEqual(['dani.souza|Dani Souza|Escrevo fantasia e mestro aos sábados.'])
  await hub.getByRole('button', { name: 'Fechar' }).click()
  await expect(page.getByRole('button', { name: 'Conta: dani.souza@exemplo.com' })).toContainText('@dani.souza')
})
