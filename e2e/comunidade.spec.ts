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

const community = (page: Page) => page.getByRole('region', { name: 'Comunidade' })
const tab = (page: Page, name: string) => community(page).getByRole('tab', { name: new RegExp(`^${name}`) })

async function openCommunity(page: Page) {
  await page.getByRole('navigation', { name: 'Setores' }).getByRole('button', { name: /Comunidade/ }).click()
  await expect(community(page)).toBeVisible()
}

function seedProfiles(fake: Fake) {
  fake.tables.papirus_profiles.push(
    { user_id: PEOPLE.ana.id, handle: 'ana', name: 'Ana', bio: '', avatar: null },
    { user_id: PEOPLE.bia.id, handle: 'bia', name: 'Bia', bio: '', avatar: null },
  )
}

test('Comunidade: seguir, continuar lendo, capítulo novo, até onde leram, denunciar e bloquear', async ({ page, browser }) => {
  test.setTimeout(180_000)
  const fake = createFakeSupabase()
  seedProfiles(fake)
  await page.context().addInitScript(() => localStorage.getItem('papirus:prefs') || localStorage.setItem('papirus:prefs', JSON.stringify({ tourDone: true })))
  await fake.attach(page.context())

  // Ana põe "A Maré" na estante para todo mundo, para ler ali mesmo.
  await page.goto('/app/?exemplo=ostria')
  await expect(page.getByRole('button', { name: 'Continuar escrevendo' })).toBeVisible()
  await signIn(page, PEOPLE.ana.email)
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Publicar', exact: true }).click()
  await page.getByRole('button', { name: 'Novo livro' }).click()
  await page.getByRole('textbox', { name: 'Título' }).fill('A Maré')
  await page.getByRole('button', { name: 'Criar livro' }).click()
  await page.getByRole('radiogroup', { name: 'Quem vê “A Maré” no seu perfil' }).getByRole('radio', { name: 'Todo mundo' }).click()
  await page.getByText(/Deixar ler o livro ali mesmo/).click()
  await expect.poll(() => fake.tables.papirus_shelf_text.length, { timeout: 15_000 }).toBe(1)
  // Um comentário da Ana no próprio livro (para a Bia ter o que denunciar).
  const book = fake.tables.papirus_shelf[0]
  fake.tables.papirus_shelf_comments.push({ id: crypto.randomUUID(), owner: PEOPLE.ana.id, book_id: book.id, author: PEOPLE.ana.id, body: 'Obrigada por ler!', created_at: new Date().toISOString() })

  // Bia, sem ser amiga, acha a Ana em Pessoas e segue.
  const bia = await newPerson(browser, fake)
  await bia.goto('/app/')
  await signIn(bia, PEOPLE.bia.email)
  await openCommunity(bia)
  await tab(bia, 'Pessoas').click()
  await community(bia).getByRole('textbox', { name: '@ da pessoa' }).fill('ana')
  await community(bia).getByRole('button', { name: 'Procurar' }).click()
  await community(bia).getByRole('button', { name: 'Seguir', exact: true }).click()
  await expect.poll(() => fake.tables.papirus_follows.length).toBe(1)
  await expect(community(bia).getByRole('button', { name: 'Deixar de seguir' })).toBeVisible()

  // Lê o livro: o lugar fica guardado no servidor; e denuncia o comentário.
  await community(bia).getByRole('list', { name: 'Estante de @ana' }).getByRole('button', { name: 'Ler', exact: true }).click()
  const reading = bia.getByRole('dialog', { name: 'Lendo A Maré' })
  await reading.getByRole('button', { name: /Próxima cena/ }).click()
  await expect.poll(() => fake.tables.papirus_reading.map((r) => r.chapter_index), { timeout: 10_000 }).toEqual([1])
  await reading.getByRole('button', { name: /comentário sobre o livro/ }).click()
  await reading.getByRole('button', { name: 'Denunciar comentário' }).click()
  await reading.getByRole('combobox', { name: 'Motivo da denúncia' }).selectOption('Spam ou propaganda')
  await reading.getByRole('button', { name: 'Denunciar', exact: true }).click()
  await expect(reading.getByText('Denúncia enviada')).toBeVisible()
  expect(fake.tables.papirus_reports.map((r) => `${r.reason}|${r.body}`)).toEqual(['Spam ou propaganda|Obrigada por ler!'])
  await reading.getByRole('button', { name: 'Voltar à estante' }).click()

  // Em "Lendo": onde parou; e, quando sai capítulo novo, o aviso.
  await bia.getByRole('button', { name: 'Voltar' }).first().click()
  await tab(bia, 'Lendo').click()
  await expect(community(bia).getByRole('list', { name: 'Continuar lendo' })).toContainText('parou no capítulo 2')
  book.chapters = Number(book.chapters) + 1
  await bia.reload()
  await tab(bia, 'Lendo').click()
  await expect(community(bia).getByRole('list', { name: 'Continuar lendo' })).toContainText('1 capítulo novo')

  // Ana vê até onde leram (sem saber quem) e, depois, bloqueia a Bia.
  await page.getByTitle('Trocar de universo').first().click()
  await openCommunity(page)
  await tab(page, 'Seus livros').click()
  await expect(community(page).getByRole('region', { name: 'Leitura de A Maré' })).toContainText('1 pessoa começou a ler')
  await tab(page, 'Pessoas').click()
  await community(page).getByRole('button', { name: /^Bia/ }).first().click()
  await community(page).getByRole('button', { name: 'Bloquear', exact: true }).click()
  await page.getByRole('button', { name: 'Bloquear', exact: true }).last().click()
  await expect.poll(() => fake.tables.papirus_blocks.length).toBe(1)
  expect(fake.tables.papirus_follows).toHaveLength(0)
})

test('Comunidade: o autor abre o mundo a pedidos de AU, a pessoa pede pelo perfil e o autor aceita', async ({ page, browser }) => {
  test.setTimeout(150_000)
  const fake = createFakeSupabase()
  seedProfiles(fake)
  await fake.attach(page.context())

  // Ana cria um universo, entra e abre o mundo a pedidos.
  await page.goto('/app/')
  await page.getByRole('textbox', { name: 'Nome do novo universo' }).fill('Ostria')
  await page.getByRole('button', { name: 'Criar universo' }).click()
  await page.getByRole('button', { name: 'Começar a escrever' }).click()
  await page.getByRole('textbox', { name: 'Texto da cena' }).click()
  await page.keyboard.type('Era noite em Ostria.')
  await signIn(page, PEOPLE.ana.email)
  await page.getByRole('button', { name: 'Compartilhar', exact: true }).first().click()
  const share = page.getByRole('dialog', { name: 'Compartilhar' })
  await share.getByRole('button', { name: 'Começar a compartilhar' }).click()
  await share.getByText('Aceitar pedidos de AU pelo meu perfil').click()
  await expect.poll(() => fake.tables.papirus_open_worlds.map((w) => w.name)).toEqual(['Ostria'])
  await share.getByRole('button', { name: 'Fechar' }).click()

  // Bia acha a Ana e pede.
  const bia = await newPerson(browser, fake)
  await bia.goto('/app/')
  await signIn(bia, PEOPLE.bia.email)
  await openCommunity(bia)
  await tab(bia, 'Pessoas').click()
  await community(bia).getByRole('textbox', { name: '@ da pessoa' }).fill('ana')
  await community(bia).getByRole('button', { name: 'Procurar' }).click()
  const worlds = community(bia).getByRole('region', { name: 'Mundos abertos a AU' })
  await expect(worlds).toContainText('Ostria')
  await worlds.getByRole('button', { name: 'Pedir para criar um AU' }).click()
  await worlds.getByRole('textbox', { name: 'Recado para o autor' }).fill('Quero contar a história da Fé da Maré.')
  await worlds.getByRole('button', { name: 'Enviar pedido' }).click()
  await expect(worlds).toContainText('Pedido enviado')
  expect(fake.tables.papirus_au_requests.map((r) => `${r.requester_email}|${r.status}`)).toEqual([`${PEOPLE.bia.email}|pendente`])

  // Ana aceita no Compartilhar: a Bia vira "Pode ver e criar um AU".
  await page.getByRole('button', { name: 'Compartilhar', exact: true }).first().click()
  const pedidos = share.getByRole('list', { name: 'Pedidos esperando resposta' })
  await expect(pedidos).toContainText('Bia')
  await pedidos.getByRole('button', { name: 'Aceitar' }).click()
  await expect(share.getByRole('combobox', { name: `O que ${PEOPLE.bia.email} pode fazer` })).toHaveValue('au')
  expect(fake.tables.papirus_au_requests.map((r) => r.status)).toEqual(['aceito'])

  // A Bia fica sabendo nas Novidades.
  await bia.reload()
  await openCommunity(bia)
  await expect(community(bia).getByRole('list', { name: 'Novidades' })).toContainText('aceitou seu pedido de AU de “Ostria”')
})
