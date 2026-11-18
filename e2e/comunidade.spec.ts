import type { Browser } from '@playwright/test'
import { createFakeSupabase, PASSWORD, PEOPLE, SERVER } from './fakeSupabase.ts'
import { expect, test, type Page } from './fixtures.ts'

type Fake = ReturnType<typeof createFakeSupabase>

async function newPerson(browser: Browser, fake: Fake, celular = false): Promise<Page> {
  const context = await browser.newContext(celular ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } : {})
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

/*
 * Vazios e casos chatos, no celular (390 px): cada tela sem nada diz o que fazer, quem foi bloqueado entende o que
 * aconteceu, e um servidor sem o script supabase/comunidade.sql só não mostra as partes novas.
 */
test.describe('Comunidade no celular: vazios e casos chatos', () => {
  test.setTimeout(150_000)

  const semRolagemLateral = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)

  /** A Ana põe "A Maré" na estante (com texto, para ler ali mesmo) e comenta. */
  async function livroDaAna(page: Page, fake: Fake) {
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
    fake.tables.papirus_shelf_comments.push({ id: crypto.randomUUID(), owner: PEOPLE.ana.id, book_id: fake.tables.papirus_shelf[0].id, author: PEOPLE.ana.id, body: 'Obrigada por ler!', created_at: new Date().toISOString() })
  }

  test('sem amigos, sem novidades, sem leitura: cada vazio diz o que fazer, e nada passa da tela', async ({ browser }) => {
    const fake = createFakeSupabase()
    seedProfiles(fake)
    const ana = await newPerson(browser, fake, true)
    await ana.goto('/app/')
    await signIn(ana, PEOPLE.ana.email)
    await openCommunity(ana)

    await expect(community(ana)).toContainText('Nada de novo nos últimos 30 dias')
    const vazios: [string, RegExp][] = [
      ['Lendo', /Nada ainda\. Quando você ler um livro da estante de alguém/],
      ['Seus livros', /Nenhum livro na estante\. Em Publicar/],
      ['Desafios', /Nenhum desafio ainda\. Crie um e chame os amigos/],
    ]
    for (const [nome, texto] of vazios) {
      await tab(ana, nome).click()
      await expect(community(ana), nome).toContainText(texto)
      expect(await semRolagemLateral(ana), nome).toBe(true)
    }

    await tab(ana, 'Pessoas').click()
    await expect(community(ana)).toContainText('Você ainda não tem amigos por aqui. Procure o @ de alguém acima, ou mande o link do seu perfil')
    await expect(community(ana)).toContainText('Você não segue ninguém. No perfil de alguém, “Seguir” traz os capítulos novos')
    await expect(community(ana)).toContainText('Ninguém segue você ainda.')
    // Ninguém bloqueado: a lista nem aparece.
    await expect(community(ana).getByRole('heading', { name: /Bloqueados/ })).toHaveCount(0)
    // Procurar um @ que não existe explica o que fazer.
    await community(ana).getByRole('textbox', { name: '@ da pessoa' }).fill('zeca')
    await community(ana).getByRole('button', { name: 'Procurar' }).click()
    await expect(community(ana).getByRole('alert')).toContainText('Não achei ninguém com @zeca. Confira se o @ está certo.')
    expect(await semRolagemLateral(ana)).toBe(true)
    // As seis abas cabem no celular (a faixa rola de lado, sem esconder nenhuma).
    for (const nome of ['Novidades', 'Lendo', 'Pessoas', 'Seus livros', 'Desafios', 'Perfil']) await expect(tab(ana, nome)).toBeVisible()
  })

  test('pessoa bloqueada: quem bloqueou vê o aviso e o desbloquear; quem foi bloqueada não consegue seguir nem pedir amizade', async ({ browser }) => {
    const fake = createFakeSupabase()
    seedProfiles(fake)
    fake.tables.papirus_open_worlds.push({ owner: PEOPLE.ana.id, universe_id: 'u-ostria', name: 'Ostria', blurb: 'Um mar de fé.', created_at: new Date().toISOString() })
    const ana = await newPerson(browser, fake, true)
    await ana.goto('/app/')
    await signIn(ana, PEOPLE.ana.email)
    await openCommunity(ana)
    await tab(ana, 'Pessoas').click()
    await community(ana).getByRole('textbox', { name: '@ da pessoa' }).fill('bia')
    await community(ana).getByRole('button', { name: 'Procurar' }).click()
    await expect(community(ana).getByRole('button', { name: 'Adicionar amigo' })).toBeVisible()
    await expect(community(ana).getByRole('button', { name: 'Seguir', exact: true })).toBeVisible()
    await community(ana).getByRole('button', { name: 'Bloquear', exact: true }).click()
    await ana.getByRole('button', { name: 'Bloquear', exact: true }).last().click()
    await expect.poll(() => fake.tables.papirus_blocks.length).toBe(1)

    // A tela muda: o aviso, o desbloquear, e nada de seguir ou adicionar.
    const aviso = community(ana).getByRole('status').filter({ hasText: 'Você bloqueou Bia' })
    await expect(aviso).toContainText('não pode comentar nos seus livros, reagir, pedir amizade, seguir você nem pedir AU')
    await expect(community(ana).getByRole('button', { name: 'Desbloquear' })).toBeVisible()
    await expect(community(ana).getByRole('button', { name: 'Adicionar amigo' })).toHaveCount(0)
    await expect(community(ana).getByRole('button', { name: 'Seguir', exact: true })).toHaveCount(0)
    await expect(community(ana).getByText('Bloqueada', { exact: true })).toBeVisible()
    await expect(community(ana)).toContainText('Desbloqueie para ver o que ela abre para você.')
    expect(await semRolagemLateral(ana)).toBe(true)
    // E aparece na lista de bloqueados.
    await community(ana).getByRole('button', { name: 'Voltar' }).click()
    await expect(community(ana).getByRole('heading', { name: 'Bloqueados (1)' })).toBeVisible()

    // A Bia, bloqueada: o servidor recusa, com um aviso sem acusar ninguém, e nada muda; o mundo aberto da Ana some para ela.
    const bia = await newPerson(browser, fake, true)
    await bia.goto('/app/')
    await signIn(bia, PEOPLE.bia.email)
    await openCommunity(bia)
    await tab(bia, 'Pessoas').click()
    await community(bia).getByRole('textbox', { name: '@ da pessoa' }).fill('ana')
    await community(bia).getByRole('button', { name: 'Procurar' }).click()
    const recusa = community(bia).getByRole('alert').filter({ hasText: 'Não dá: a pessoa não aceita isso agora.' })
    await community(bia).getByRole('button', { name: 'Seguir', exact: true }).click()
    await expect(recusa.first()).toBeVisible()
    await community(bia).getByRole('button', { name: 'Adicionar amigo' }).click()
    // Os dois jeitos de pedir dão o mesmo aviso (nada de "sem permissão", que não diz o que fazer).
    await expect(recusa).toHaveCount(2)
    await expect(community(bia).getByRole('alert').filter({ hasText: 'permissão' })).toHaveCount(0)
    expect(fake.tables.papirus_follows).toHaveLength(0)
    expect(fake.tables.papirus_friendships).toHaveLength(0)
    await expect(community(bia).getByRole('region', { name: 'Mundos abertos a AU' })).toHaveCount(0)

    // A Ana desbloqueia: o seguir e o adicionar voltam.
    await community(ana).getByRole('button', { name: /^Bia/ }).first().click()
    await community(ana).getByRole('button', { name: 'Desbloquear' }).click()
    await expect.poll(() => fake.tables.papirus_blocks.length).toBe(0)
    await expect(community(ana).getByRole('button', { name: 'Adicionar amigo' })).toBeVisible()
    await expect(community(ana).getByRole('button', { name: 'Seguir', exact: true })).toBeVisible()
  })

  test('denunciar comentário: dá para cancelar, e sem o script no servidor o aviso é claro', async ({ page, browser }) => {
    const fake = createFakeSupabase()
    seedProfiles(fake)
    await page.context().addInitScript(() => localStorage.getItem('papirus:prefs') || localStorage.setItem('papirus:prefs', JSON.stringify({ tourDone: true })))
    await fake.attach(page.context())
    await livroDaAna(page, fake)

    const bia = await newPerson(browser, fake, true)
    await bia.goto('/app/')
    await signIn(bia, PEOPLE.bia.email)
    await openCommunity(bia)
    await tab(bia, 'Pessoas').click()
    await community(bia).getByRole('textbox', { name: '@ da pessoa' }).fill('ana')
    await community(bia).getByRole('button', { name: 'Procurar' }).click()
    await community(bia).getByRole('list', { name: 'Estante de @ana' }).getByRole('button', { name: 'Ler', exact: true }).click()
    const leitura = bia.getByRole('dialog', { name: 'Lendo A Maré' })
    await leitura.getByRole('button', { name: /comentário sobre o livro/ }).click()
    // Abrir e cancelar não manda nada.
    await leitura.getByRole('button', { name: 'Denunciar comentário' }).click()
    await expect(leitura.getByRole('combobox', { name: 'Motivo da denúncia' })).toBeVisible()
    await leitura.getByRole('button', { name: 'Cancelar' }).click()
    await expect(leitura.getByRole('combobox', { name: 'Motivo da denúncia' })).toHaveCount(0)
    expect(fake.tables.papirus_reports).toHaveLength(0)
    // O botão de denunciar tem tamanho de dedo.
    const lado = await leitura.getByRole('button', { name: 'Denunciar comentário' }).evaluate((e) => Math.round(e.getBoundingClientRect().height))
    expect(lado).toBeGreaterThanOrEqual(40)

    // Servidor sem o script da Comunidade: avisa em linguagem simples, e não diz "enviada".
    fake.setSemComunidade(true)
    await leitura.getByRole('button', { name: 'Denunciar comentário' }).click()
    await leitura.getByRole('button', { name: 'Denunciar', exact: true }).click()
    await expect(leitura.getByRole('alert')).toContainText('Denunciar ainda não está ligado neste servidor')
    await expect(leitura.getByText('Denúncia enviada')).toHaveCount(0)
    // O servidor volta: agora vai, e o aviso de erro some.
    fake.setSemComunidade(false)
    await leitura.getByRole('button', { name: 'Denunciar', exact: true }).click()
    await expect(leitura.getByText('Denúncia enviada')).toBeVisible()
    await expect(leitura.getByRole('alert')).toHaveCount(0)
    expect(fake.tables.papirus_reports).toHaveLength(1)
  })

  test('pedido de AU recusado: a pessoa vê que não foi aceito, nas Novidades e no perfil, sem poder insistir', async ({ page, browser }) => {
    const fake = createFakeSupabase()
    seedProfiles(fake)
    await fake.attach(page.context())
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
    await expect.poll(() => fake.tables.papirus_open_worlds.length).toBe(1)
    await share.getByRole('button', { name: 'Fechar' }).click()

    const bia = await newPerson(browser, fake, true)
    await bia.goto('/app/')
    await signIn(bia, PEOPLE.bia.email)
    await openCommunity(bia)
    await tab(bia, 'Pessoas').click()
    await community(bia).getByRole('textbox', { name: '@ da pessoa' }).fill('ana')
    await community(bia).getByRole('button', { name: 'Procurar' }).click()
    const mundos = community(bia).getByRole('region', { name: 'Mundos abertos a AU' })
    await mundos.getByRole('button', { name: 'Pedir para criar um AU' }).click()
    await mundos.getByRole('button', { name: 'Enviar pedido' }).click()
    await expect(mundos).toContainText('Pedido enviado: o autor ainda não respondeu')

    // A Ana recusa.
    await page.getByRole('button', { name: 'Compartilhar', exact: true }).first().click()
    await share.getByRole('list', { name: 'Pedidos esperando resposta' }).getByRole('button', { name: 'Recusar' }).click()
    await expect.poll(() => fake.tables.papirus_au_requests.map((r) => r.status)).toEqual(['recusado'])
    await expect(share.getByRole('list', { name: 'Pedidos esperando resposta' })).toHaveCount(0)

    // A Bia: nas Novidades e no perfil, sem botão para pedir de novo.
    await bia.reload()
    await openCommunity(bia)
    await expect(community(bia).getByRole('list', { name: 'Novidades' })).toContainText('não aceitou seu pedido de AU de “Ostria”')
    await tab(bia, 'Pessoas').click()
    await community(bia).getByRole('textbox', { name: '@ da pessoa' }).fill('ana')
    await community(bia).getByRole('button', { name: 'Procurar' }).click()
    const depois = community(bia).getByRole('region', { name: 'Mundos abertos a AU' })
    await expect(depois).toContainText('O autor não aceitou este pedido')
    await expect(depois.getByRole('button', { name: 'Pedir para criar um AU' })).toHaveCount(0)
    expect(await semRolagemLateral(bia)).toBe(true)
  })

  test('servidor sem o script comunidade.sql: as partes novas só não aparecem, e o resto funciona', async ({ browser }) => {
    const fake = createFakeSupabase()
    seedProfiles(fake)
    fake.setSemComunidade(true)
    const bia = await newPerson(browser, fake, true)
    await bia.goto('/app/')
    await signIn(bia, PEOPLE.bia.email)
    await openCommunity(bia)
    await expect(community(bia).getByRole('alert')).toHaveCount(0)
    await expect(community(bia)).toContainText('Nada de novo nos últimos 30 dias')

    await tab(bia, 'Lendo').click()
    await expect(community(bia)).toContainText('Para guardar onde você parou em cada livro, quem cuida do servidor precisa rodar o script')
    await tab(bia, 'Seus livros').click()
    await expect(community(bia)).toContainText('Nenhum livro na estante')

    // Pessoas: o básico (amigos) funciona; seguir, seguidores e bloqueados não aparecem.
    await tab(bia, 'Pessoas').click()
    await expect(community(bia)).toContainText('Você ainda não tem amigos por aqui')
    await expect(community(bia).getByRole('heading', { name: /^Seguindo/i })).toHaveCount(0)
    await expect(community(bia).getByRole('heading', { name: /^Seguidores/i })).toHaveCount(0)
    await community(bia).getByRole('textbox', { name: '@ da pessoa' }).fill('ana')
    await community(bia).getByRole('button', { name: 'Procurar' }).click()
    await expect(community(bia).getByRole('button', { name: 'Adicionar amigo' })).toBeVisible()
    await expect(community(bia).getByRole('button', { name: 'Seguir', exact: true })).toHaveCount(0)
    await expect(community(bia).getByRole('button', { name: 'Bloquear', exact: true })).toHaveCount(0)
    await expect(community(bia).getByRole('region', { name: 'Mundos abertos a AU' })).toHaveCount(0)
    await expect(community(bia).getByRole('alert')).toHaveCount(0)
    await community(bia).getByRole('button', { name: 'Adicionar amigo' }).click()
    await expect.poll(() => fake.tables.papirus_friendships.length).toBe(1)
    expect(await semRolagemLateral(bia)).toBe(true)
  })
})
