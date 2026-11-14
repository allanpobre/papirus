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
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Publicar', exact: true }).click()
  await page.getByRole('button', { name: 'Novo livro' }).click()
  await page.getByRole('textbox', { name: 'Título' }).fill('A Maré')
  await page.getByRole('button', { name: 'Criar livro' }).click()
  // Com capa: ela sobe para a pasta de imagens e o texto da estante leva só a referência.
  await page.locator('[data-tour="livro-acoes"]').getByRole('button', { name: 'Diagramar', exact: true }).click()
  const designer = page.getByRole('dialog', { name: 'Diagramar o livro' })
  await designer.getByLabel('Imagem da capa').setInputFiles({
    name: 'capa.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAIAAAA2iEnWAAAAEklEQVR4nGNgYGD4z8DAwMAAAA8AAf8k0R0AAAAASUVORK5CYII=', 'base64'),
  })
  await expect(designer.getByRole('img', { name: 'Capa escolhida' })).toBeVisible()
  await designer.getByRole('button', { name: 'Fechar' }).click()
  await page.getByRole('radiogroup', { name: 'Quem vê “A Maré” no seu perfil' }).getByRole('radio', { name: 'Amigos' }).click()
  await page.getByText(/Deixar ler o livro ali mesmo/).click()
  await expect(page.getByRole('switch', { name: /Deixar ler o livro ali mesmo/ })).toBeChecked()
  await expect.poll(() => fake.tables.papirus_shelf_text.length, { timeout: 15_000 }).toBe(1)
  const coverOf = () => String((fake.tables.papirus_shelf_text[0].data as { universe: { books: { cover: string | null }[] } }).universe.books[0].cover)
  await expect.poll(coverOf, { timeout: 15_000 }).toMatch(/^img:[0-9a-f]{32}$/)
  expect(fake.images.has(coverOf().slice(4))).toBe(true)
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
  // O livro como a Ana diagramou: folhear e ver as páginas, por cima da leitura.
  await reading.getByRole('button', { name: 'Folhear' }).click()
  const flip = bia.getByRole('dialog', { name: 'Folhear A Maré' })
  await expect(flip.locator('.book-flip-status')).toContainText('como na diagramação', { timeout: 30_000 })
  // A capa da Ana, baixada na hora.
  await expect(bia.frameLocator('.book-flip-frame').locator('.cover img').first()).toHaveAttribute('src', /^data:image\//)
  await flip.getByRole('button', { name: 'Fechar' }).click()
  await expect(flip).toHaveCount(0)
  await reading.getByRole('button', { name: 'Páginas' }).click()
  const pages = bia.getByRole('dialog', { name: 'Páginas de A Maré' })
  await expect(pages.locator('.book-flip-status')).toContainText('como na diagramação', { timeout: 30_000 })
  await expect(bia.frameLocator('.book-flip-frame').locator('.pagedjs_page').first()).toBeVisible()
  await pages.getByRole('button', { name: 'Fechar' }).click()
  await expect(reading).toBeVisible()
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

test('estante com dois volumes: publicar, atualizar e tirar da estante age só no volume escolhido', async ({ page }) => {
  test.setTimeout(120_000)
  const fake = createFakeSupabase()
  await page.context().addInitScript(() => localStorage.getItem('papirus:prefs') || localStorage.setItem('papirus:prefs', JSON.stringify({ tourDone: true })))
  await fake.attach(page.context())
  await page.goto('/app/?exemplo=ostria')
  await expect(page.getByRole('button', { name: 'Continuar escrevendo' })).toBeVisible()
  await signIn(page, PEOPLE.ana.email)
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Publicar', exact: true }).click()

  // Dois volumes: o primeiro e o segundo.
  await page.getByRole('button', { name: 'Novo livro' }).click()
  await page.getByRole('textbox', { name: 'Título' }).fill('Volume 1')
  await page.getByRole('button', { name: 'Criar livro' }).click()
  await page.getByRole('button', { name: 'Novo livro' }).click()
  await page.getByRole('textbox', { name: 'Título' }).fill('Volume 2')
  await page.getByRole('button', { name: 'Criar livro' }).click()
  const estante = page.getByRole('listbox', { name: 'Estante' })
  await expect(estante.getByRole('option')).toHaveCount(2)

  const linhas = () => fake.tables.papirus_shelf.map((r) => String(r.title)).sort()
  // O volume escolhido (o novo, "Volume 2") vai para os amigos: só ele chega à estante do servidor.
  await expect(page.getByRole('radiogroup', { name: 'Quem vê “Volume 2” no seu perfil' })).toBeVisible()
  await page.getByRole('radiogroup', { name: 'Quem vê “Volume 2” no seu perfil' }).getByRole('radio', { name: 'Amigos' }).click()
  await expect.poll(linhas, { timeout: 15_000 }).toEqual(['Volume 2'])

  // O outro volume continua só do dono, até ser escolhido e publicado.
  await estante.getByRole('option', { name: /Volume 1/ }).click()
  const grupoOutro = page.getByRole('radiogroup', { name: 'Quem vê “Volume 1” no seu perfil' })
  await expect(grupoOutro.getByRole('radio', { name: 'Só eu' })).toHaveAttribute('aria-checked', 'true')
  await grupoOutro.getByRole('radio', { name: 'Todo mundo' }).click()
  await expect.poll(() => linhas().length, { timeout: 15_000 }).toBe(2)
  expect(linhas()).toEqual(['Volume 1', 'Volume 2'])

  // Tirar o "Volume 2" da estante (Só eu) apaga só ele; o outro fica.
  await estante.getByRole('option', { name: /Volume 2/ }).click()
  await page.getByRole('radiogroup', { name: 'Quem vê “Volume 2” no seu perfil' }).getByRole('radio', { name: 'Só eu' }).click()
  await expect.poll(linhas, { timeout: 15_000 }).toEqual(['Volume 1'])
})
