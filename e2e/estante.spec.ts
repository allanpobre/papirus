import type { Browser } from '@playwright/test'
import { createFakeSupabase, PASSWORD, PEOPLE, SERVER } from './fakeSupabase.ts'
import { expect, test, type Page } from './fixtures.ts'

type Fake = ReturnType<typeof createFakeSupabase>

async function newPerson(browser: Browser, fake: Fake): Promise<Page> {
  const context = await browser.newContext()
  await context.addInitScript(() => localStorage.getItem('papirus:prefs') || localStorage.setItem('papirus:prefs', JSON.stringify({ tourDone: true })))
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

test('estante: ler ali mesmo, reagir a um capítulo, e capítulo novo chega aos amigos', async ({ page, browser }) => {
  test.setTimeout(150_000)
  const fake = createFakeSupabase()
  // Ana e Bia já são amigas, com perfil.
  const now = new Date().toISOString()
  fake.tables.papirus_profiles.push(
    { user_id: PEOPLE.ana.id, handle: 'ana', name: 'Ana', bio: '', avatar: null },
    { user_id: PEOPLE.bia.id, handle: 'bia', name: 'Bia', bio: '', avatar: null },
  )
  fake.tables.papirus_friendships.push({ requester: PEOPLE.bia.id, addressee: PEOPLE.ana.id, status: 'aceita', created_at: now })
  await page.context().addInitScript(() => localStorage.getItem('papirus:prefs') || localStorage.setItem('papirus:prefs', JSON.stringify({ tourDone: true })))
  await fake.attach(page.context())

  // Ana põe "A Maré" na estante para amigos, e deixa ler ali.
  await page.goto('/app/?exemplo=ostria')
  // Espera o exemplo abrir (antes disso, a tela é a lista de universos, que também tem "Entrar").
  await expect(page.getByRole('button', { name: 'Continuar escrevendo' })).toBeVisible()
  await signIn(page, PEOPLE.ana.email)
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Livro', exact: true }).click()
  await page.getByRole('button', { name: 'Novo livro' }).click()
  await page.getByRole('textbox', { name: 'Título' }).fill('A Maré')
  await page.getByRole('button', { name: 'Criar livro' }).click()
  await page.getByRole('radiogroup', { name: 'Quem vê “A Maré” no seu perfil' }).getByRole('radio', { name: 'Amigos' }).click()
  await page.getByText(/Deixar ler o livro ali mesmo/).click()
  await expect(page.getByRole('switch', { name: /Deixar ler o livro ali mesmo/ })).toBeChecked()
  await expect.poll(() => fake.tables.papirus_shelf_text.length, { timeout: 15_000 }).toBe(1)
  // O texto vai sem segredos e sem a mesa de RPG.
  const sent = JSON.stringify(fake.tables.papirus_shelf_text[0].data)
  expect(sent).not.toContain('"sessions":[{')
  const chaptersBefore = Number(fake.tables.papirus_shelf[0].chapters)

  // Bia abre a estante da Ana e lê ali mesmo.
  const bia = await newPerson(browser, fake)
  await bia.goto('/app/')
  await signIn(bia, PEOPLE.bia.email)
  await bia.goto('/app/?perfil=ana')
  const shelf = bia.getByRole('list', { name: 'Estante de @ana' })
  await expect(shelf).toContainText('A Maré')
  await shelf.getByRole('button', { name: 'Ler', exact: true }).click()
  const reading = bia.getByRole('dialog', { name: 'Lendo A Maré' })
  await expect(reading.getByRole('group', { name: 'Reagir a este capítulo' })).toBeVisible()
  await reading.getByRole('button', { name: 'Amei' }).click()
  await expect(reading.getByRole('button', { name: 'Amei (1)' })).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => fake.tables.papirus_chapter_reactions.map((r) => r.emoji)).toEqual(['❤️'])
  // Trocar de ideia: tocar de novo tira.
  await reading.getByRole('button', { name: 'Amei (1)' }).click()
  await expect.poll(() => fake.tables.papirus_chapter_reactions.length).toBe(0)
  await reading.getByRole('button', { name: 'Demais' }).click()
  await expect.poll(() => fake.tables.papirus_chapter_reactions.map((r) => r.emoji)).toEqual(['🔥'])
  // Comentário só para a Ana, num trecho; e um comentário público sobre o livro.
  await reading.locator('.leitor-text p').first().click({ clickCount: 3 })
  await reading.getByRole('button', { name: 'Comentar o trecho' }).click()
  const sheet = reading.getByRole('dialog', { name: 'Comentar para quem escreveu' })
  await expect(sheet.getByRole('textbox', { name: 'Seu nome' })).toHaveCount(0)
  await sheet.getByRole('textbox', { name: 'Seu comentário' }).fill('Esse começo me pegou.')
  await sheet.getByRole('button', { name: 'Enviar para quem escreveu' }).click()
  await expect(sheet).toContainText('Enviado')
  await sheet.getByRole('button', { name: 'Fechar' }).click()
  expect(fake.tables.papirus_feedback.map((f) => `${f.author_name}|${f.via}`)).toEqual(['Bia|estante'])
  await reading.getByRole('button', { name: 'Comentar o livro' }).click()
  await reading.getByRole('textbox', { name: 'Comentário sobre o livro' }).fill('Estou amando!')
  await reading.getByRole('button', { name: 'Enviar', exact: true }).click()
  await expect(reading.getByRole('region', { name: 'Comentários sobre A Maré' })).toContainText('Estou amando!')
  await reading.getByRole('button', { name: 'Voltar à estante' }).click()

  // Ana vê a reação nas novidades e no resumo do livro.
  await page.reload()
  await expect(page.getByRole('region', { name: 'Reações dos leitores' })).toContainText('🔥 1')
  await page.getByRole('button', { name: 'Ver meu perfil' }).click()
  const anaSocial = page.getByRole('dialog', { name: 'Sua conta' })
  await anaSocial.getByRole('tab', { name: /Novidades/ }).click()
  await expect(anaSocial.getByRole('list', { name: 'Novidades' })).toContainText('reagiu 🔥 a um capítulo de “A Maré”')
  await anaSocial.getByRole('button', { name: 'Fechar' }).click()

  // Ana escreve uma cena nova: os amigos ficam sabendo do capítulo novo.
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Escrever', exact: true }).click()
  // O comentário da Bia aparece na margem da primeira cena.
  await expect(page.getByRole('complementary', { name: 'Margem viva' }).locator('.beta-readers')).toContainText('Esse começo me pegou.')
  await page.getByRole('complementary', { name: 'Manuscrito' }).getByRole('button', { name: 'Nova cena', exact: true }).first().click()
  await page.getByRole('textbox', { name: 'Texto da cena' }).click()
  await page.keyboard.type('A maré voltou mais cedo naquela noite.')
  await expect.poll(() => fake.tables.papirus_activity.map((a) => `${a.kind}:${a.n}`), { timeout: 20_000 }).toContain('capitulos:1')
  expect(Number(fake.tables.papirus_shelf[0].chapters)).toBe(chaptersBefore + 1)

  await bia.getByRole('button', { name: /Conta|Ver meu perfil/ }).first().click()
  const biaSocial = bia.getByRole('dialog', { name: 'Sua conta' })
  await biaSocial.getByRole('tab', { name: /Novidades/ }).click()
  await expect(biaSocial.getByRole('list', { name: 'Novidades' })).toContainText('publicou 1 capítulo novo de “A Maré”')
})
