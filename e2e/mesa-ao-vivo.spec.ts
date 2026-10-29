import AxeBuilder from '@axe-core/playwright'
import { fakeRealtime } from './fakeRealtime.ts'
import { runPageTour } from './pageTour.ts'
import { expect, test, type BrowserContext, type Page } from './fixtures.ts'

const SERVER = 'https://papirus-teste.supabase.co'
const nav = (page: Page, name: string | RegExp) => page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name })
const tray = (page: Page) => page.getByRole('complementary', { name: 'Últimas rolagens' })

/** Problemas de acessibilidade (WCAG A e AA) na página, num texto curto. */
async function audit(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  return violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => `${n.target.join(' ')} [${n.any[0]?.message ?? ''}]`).join(' | ')}`)
}

/** As funções do supabase/codex.sql, em memória. */
async function fakeCodex(context: BrowserContext) {
  const store = new Map<string, { data: unknown; updated_at: string }>()
  await context.route(`${SERVER}/rest/v1/rpc/*`, async (route) => {
    const fn = route.request().url().split('/rpc/')[1].split('?')[0]
    const body = route.request().postDataJSON() as Record<string, string>
    const json = (data: unknown) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(data), headers: { 'access-control-allow-origin': '*' } })
    if (fn === 'codex_put') {
      const updated_at = new Date().toISOString()
      store.set(body.codex_id, { data: body.codex_data, updated_at })
      return json(updated_at)
    }
    const row = store.get(body.codex_id)
    return json(fn === 'codex_get' && row ? [row] : [])
  })
  await context.route(`${SERVER}/realtime/v1/api/**`, (route) => route.abort())
}

/** Ostria com o servidor configurado, aberta na Mesa de RPG. */
async function ostria(page: Page, baseURL: string) {
  await page.goto('/app/?exemplo=ostria')
  await expect(page.getByRole('button', { name: 'Continuar escrevendo' })).toBeVisible()
  await nav(page, 'Ajustes e dados').click()
  await page.getByRole('navigation', { name: 'Categorias dos ajustes' }).getByRole('button', { name: /Conta/ }).click()
  await page.getByRole('textbox', { name: 'Endereço do projeto' }).fill(SERVER)
  await page.getByRole('textbox', { name: 'Chave pública (anon key)' }).fill('eyJ.chave-de-teste')
  await page.getByRole('textbox', { name: 'Endereço público do Papirus' }).fill(baseURL + '/')
  await nav(page, 'RPG').click()
}

/** Abre o "⋯" da barra da sessão e toca numa ação de lá. */
async function more(page: Page, name: string) {
  await page.getByRole('button', { name: 'Mais da sessão' }).click()
  await page.getByRole('button', { name, exact: true }).click()
}

/** Ostria com uma sessão em andamento e um combate: Brisa (20), Taren (15), Ilmar (10), Bandido (2) e Goblin (1). */
async function combat(page: Page, baseURL: string) {
  await ostria(page, baseURL)
  await page.getByRole('button', { name: 'Começar agora' }).click()
  await page.getByRole('button', { name: 'Começar a jogar' }).click()

  // Começar combate: os jogadores esperam a iniciativa (sem celular, o mestre digita o que saiu).
  const init = page.getByRole('region', { name: 'Iniciativa' })
  await init.getByRole('button', { name: 'Começar combate' }).click()
  for (const [name, value] of [
    ['Brisa', '20'],
    ['Taren', '15'],
    ['Ilmar', '10'],
  ]) {
    await init.getByRole('textbox', { name: `Iniciativa de ${name}` }).fill(value)
    await init.getByRole('textbox', { name: `Iniciativa de ${name}` }).press('Enter')
  }
  for (const [name, value] of [
    ['Bandido', '2'],
    ['Goblin', '1'],
  ]) {
    await init.getByRole('textbox', { name: 'Nome' }).fill(name)
    await init.getByRole('textbox', { name: 'Iniciativa', exact: true }).fill(value)
    await init.getByRole('button', { name: 'Adicionar', exact: true }).click()
  }
  await init.getByRole('button', { name: 'Definir turnos' }).click()
  await expect(init.getByText('Rodada 1')).toBeVisible()
  // Um toque no combatente abre a vida e a Defesa.
  await init.getByRole('button', { name: /^Goblin: / }).click()
  await init.getByRole('textbox', { name: 'PV de Goblin' }).fill('7')
  await init.getByRole('textbox', { name: 'CA de Goblin' }).fill('12')
  await init.getByRole('button', { name: /^Bandido: / }).click()
  await init.getByRole('textbox', { name: 'PV de Bandido' }).fill('11')
  await init.getByRole('textbox', { name: 'CA de Bandido' }).fill('13')
  return init
}

test('combate na mesa: em quem, acerta ou erra pela CA, e o dano sai da vida do alvo', async ({ page, baseURL }) => {
  const init = await combat(page, baseURL!)
  const turn = page.getByRole('region', { name: 'Vez de Brisa' })
  await turn.getByRole('button', { name: 'Atacar com Rapieira (+5)' }).click()
  await page.getByRole('dialog', { name: 'Rapieira: em quem?' }).getByRole('button', { name: /^Goblin/ }).click()

  const quanto = page.getByRole('dialog', { name: 'Quanto saiu no dado?' })
  await expect(quanto).toContainText('Rapieira contra Goblin')
  await quanto.getByRole('spinbutton').fill('6')
  await expect(quanto.getByRole('status')).toContainText('Total 11 · Erra')
  await quanto.getByRole('spinbutton').fill('10')
  await expect(quanto.getByRole('status')).toContainText('Total 15 · Acerta')
  await quanto.getByRole('button', { name: 'Registrar' }).click()
  await expect(tray(page)).toContainText('Brisa · Rapieira contra Goblin')
  await expect(tray(page)).toContainText('CA 12')

  // Acertou: o dano vem em seguida, já mirado.
  await tray(page).getByRole('button', { name: 'Rolar dano (1d8+3)' }).click()
  await quanto.getByRole('spinbutton').fill('6')
  await expect(quanto.getByRole('status')).toContainText('Total 9')
  await quanto.getByRole('button', { name: 'Registrar' }).click()
  await tray(page).getByRole('button', { name: 'Tirar 9 PV de Goblin' }).click()
  await expect(tray(page)).toContainText('Goblin: PV -2/7 · derrotado')
  // Tirou errado? Desfazer devolve a vida; e dá para tirar de novo.
  await tray(page).getByRole('button', { name: 'Desfazer o dano em Goblin' }).click()
  await init.getByRole('button', { name: /^Goblin: / }).click()
  await expect(init.getByRole('textbox', { name: 'PV de Goblin' })).toHaveValue('7')
  await expect(page.getByRole('region', { name: 'Registro' })).toContainText('Desfeito: 9 de dano em Goblin')
  await tray(page).getByRole('button', { name: 'Tirar 9 PV de Goblin' }).click()
  await expect(tray(page)).toContainText('Goblin: PV -2/7 · derrotado')
  await expect(init.locator('.fight-row', { hasText: 'Goblin' })).toContainText('derrotado')
  await expect(page.getByRole('region', { name: 'Registro' })).toContainText('Goblin perde 9 PV (fica com -2/7) · derrotado')

  // Uma condição por uma rodada: acaba sozinha quando a rodada vira.
  await init.getByRole('button', { name: /^Ilmar: / }).click()
  await init.getByRole('combobox', { name: 'Adicionar condição a Ilmar' }).selectOption('Atordoado')
  await init.getByRole('combobox', { name: 'Quanto tempo dura Atordoado em Ilmar' }).selectOption({ label: '1 rodada' })
  await expect(init.getByRole('button', { name: 'Tirar Atordoado de Ilmar' })).toContainText('última rodada')

  // O ataque rápido de quem não tem ficha, e a vez que pula os inimigos derrotados.
  for (let i = 0; i < 3; i++) await init.getByRole('button', { name: /Próxima vez/ }).click()
  const bandido = page.getByRole('region', { name: 'Vez de Bandido' })
  await bandido.getByRole('textbox', { name: 'Bônus do ataque' }).fill('4')
  await bandido.getByRole('textbox', { name: 'Dano do ataque' }).fill('1d6+2')
  await bandido.getByRole('button', { name: 'Atacar' }).click()
  await page.getByRole('dialog', { name: 'Ataque: em quem?' }).getByRole('button', { name: /^Ilmar/ }).click()
  await quanto.getByRole('spinbutton').fill('20')
  await expect(quanto.getByRole('status')).toContainText('Crítico! Acerta')
  await quanto.getByRole('button', { name: 'Registrar' }).click()
  await expect(tray(page).getByRole('button', { name: 'Rolar dano crítico (2d6+2)' })).toBeVisible()
  await init.getByRole('button', { name: /Próxima vez/ }).click()
  await expect(init.getByText('Rodada 2')).toBeVisible()
  await expect(init.getByRole('button', { name: 'Tirar Atordoado de Ilmar' })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Registro' })).toContainText('Atordoado acabou em Ilmar.')
  await expect(page.getByRole('region', { name: 'Vez de Brisa' })).toBeVisible()
})

test('Codex ao vivo: o jogador rola pela ficha, o mestre confere e todos veem', async ({ page, context, baseURL }) => {
  // Três páginas, dois tours e a checagem de acessibilidade: leva mais que o normal.
  test.setTimeout(90_000)
  await fakeCodex(context)
  await fakeRealtime(context, SERVER)
  const init = await combat(page, baseURL!)
  await init.getByRole('button', { name: /Próxima vez/ }).click()
  await expect(page.getByRole('region', { name: 'Vez de Taren' })).toBeVisible()

  // O convite, direto da barra do modo sessão.
  await page.locator('.sm-bar').getByRole('button', { name: 'Convidar jogadores' }).click()
  await page.getByRole('dialog', { name: 'Convidar jogadores' }).getByRole('button', { name: 'Criar o link da mesa' }).click()
  const link = await page.getByRole('textbox', { name: 'Link para os jogadores' }).inputValue()
  await page.keyboard.press('Escape')

  // Taren no celular: escolhe quem é e vê que é a vez dele.
  const taren = await context.newPage()
  await taren.goto(link)
  await expect(taren.locator('.codex-order')).toContainText('Taren')
  await taren.getByRole('region', { name: 'Quem é você na mesa?' }).getByRole('button', { name: 'Taren' }).click()
  await expect(taren.getByRole('status').filter({ hasText: 'Sua vez, Taren!' })).toBeVisible()
  await expect(taren.locator('.player-live')).toHaveText(/ao vivo/)
  // O (?) do Codex explica o que o jogador vê e como rola.
  const ajuda = await runPageTour(taren, 'Codex')
  expect(ajuda.filter((s) => s.spot).map((s) => s.title)).toEqual(expect.arrayContaining(['Ao vivo', 'Combate', 'O grupo', 'Rolar']))

  // Ilmar, em outra aba (o mesmo aparelho lembra quem é: aqui ele troca), só acompanha.
  const ilmar = await context.newPage()
  await ilmar.goto(link)
  await ilmar.getByRole('button', { name: 'Rolar como Taren' }).click()
  await ilmar.getByRole('button', { name: 'Não sou Taren' }).click()
  await ilmar.getByRole('region', { name: 'Quem é você na mesa?' }).getByRole('button', { name: 'Ilmar' }).click()
  await expect(ilmar.getByRole('button', { name: 'Rolar como Ilmar' })).toBeVisible()
  await expect(ilmar.locator('.player-live')).toHaveText(/ao vivo/)

  await taren.getByRole('button', { name: 'Rolar como Taren' }).click()
  const rolar = await runPageTour(taren, 'Rolar')
  expect(rolar.every((s) => s.spot)).toBe(true)
  await taren.getByRole('dialog', { name: 'Rolar como Taren' }).getByRole('button', { name: 'Atacar com Espada longa' }).click()
  await taren.getByRole('dialog', { name: 'Espada longa: em quem?' }).getByRole('button', { name: /^Bandido/ }).click()
  const quanto = taren.getByRole('dialog', { name: 'Quanto saiu no dado?' })
  await quanto.getByRole('spinbutton').fill('14')
  await expect(quanto.getByRole('status')).toContainText('Total 19')
  await quanto.getByRole('button', { name: 'Registrar' }).click()
  const feed = taren.getByRole('list', { name: 'Rolagens da mesa' })
  await expect(feed).toContainText('Você · Espada longa contra Bandido')

  // O mestre recebe, confere com a CA (que o jogador não vê) e devolve o veredito.
  await expect(tray(page)).toContainText('Taren · Espada longa contra Bandido')
  await expect(tray(page)).toContainText('Acerta')
  await expect(tray(page)).toContainText('pelo Codex')
  await expect(page.getByRole('region', { name: 'Registro' })).toContainText('Taren — Espada longa contra Bandido (CA 13): 19 (Acerta) · 1d20+5 [14] · dado físico · pelo Codex')
  await expect(feed).toContainText('Acerta')
  await expect(feed.getByLabel('conferido pelo mestre')).toBeVisible()
  await expect(ilmar.getByRole('list', { name: 'Rolagens da mesa' })).toContainText('Taren · Espada longa contra Bandido')

  // O dano também vem do celular; o mestre decide tirar da vida.
  await taren.getByRole('button', { name: 'Rolar dano' }).click()
  await quanto.getByRole('spinbutton').fill('5')
  await expect(quanto.getByRole('status')).toContainText('Total 8')
  await quanto.getByRole('button', { name: 'Registrar' }).click()
  await tray(page).getByRole('button', { name: 'Tirar 8 PV de Bandido' }).click()
  await expect(init.getByRole('textbox', { name: 'PV de Bandido' })).toHaveValue('3/11')

  // Mesa e celular, com combate e rolagens na tela, sem problemas de acessibilidade (claro e escuro).
  for (const scheme of ['light', 'dark'] as const) {
    for (const p of [page, taren]) await p.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
    await page.waitForTimeout(300)
    expect(await audit(page)).toEqual([])
    expect(await audit(taren)).toEqual([])
  }
})

test('sessão ao vivo: convidar, ver quem está na mesa, a abertura e o fim, no computador e no celular', async ({ page, context, baseURL }) => {
  test.setTimeout(90_000)
  await fakeCodex(context)
  await fakeRealtime(context, SERVER)
  await ostria(page, baseURL!)

  // Ninguém na mesa ainda: o convite fica à vista no alto.
  const presence = page.locator('.mesa-presence')
  await presence.getByRole('button', { name: 'Convidar jogadores' }).click()
  const convite = page.getByRole('dialog', { name: 'Convidar jogadores' })
  await convite.getByRole('button', { name: 'Criar o link da mesa' }).click()
  await expect(convite.getByRole('button', { name: 'Copiar o link' })).toBeFocused()
  await expect(convite.getByRole('img', { name: 'QR code do link para os jogadores' })).toBeVisible()
  await expect(convite).toContainText('Ninguém entrou ainda')
  const ajuda = await runPageTour(page, 'Convidar jogadores')
  expect(ajuda.filter((x) => x.spot).map((x) => x.title)).toEqual(['O código', 'O link', 'Na mesa agora'])
  const link = await convite.getByRole('textbox', { name: 'Link para os jogadores' }).inputValue()

  // Taren abre o link no celular: aparece na hora para o mestre, e ele vê o mestre.
  const taren = await context.newPage()
  await taren.setViewportSize({ width: 390, height: 800 })
  await taren.goto(link)
  await taren.getByRole('region', { name: 'Quem é você na mesa?' }).getByRole('button', { name: 'Taren' }).click()
  await expect(convite.getByRole('list', { name: 'Na mesa agora' })).toContainText('Taren')
  const naMesa = taren.getByRole('region', { name: 'Na mesa agora' })
  await expect(naMesa).toContainText('Mestre')
  await expect(naMesa).toContainText('Taren (você)')
  await page.keyboard.press('Escape')
  await expect(convite).toHaveCount(0)
  await expect(presence).toContainText('Taren')
  await expect(presence.getByRole('button', { name: 'Convidar', exact: true })).toBeVisible()

  // Começar: a sessão abre na tela inteira, com o que houve na última vez e quem chegou.
  await page.getByRole('button', { name: 'Começar agora' }).click()
  const abertura = page.getByRole('dialog', { name: 'A Torre' })
  await expect(abertura).toContainText('Mesa de sexta · Sessão 2')
  await expect(abertura).toContainText('Na última sessão · Sessão 1 — Neblina no porto')
  await expect(abertura.getByRole('list', { name: 'Na mesa agora' })).toContainText('Taren')
  await expect(abertura.getByRole('button', { name: 'Começar a jogar' })).toBeFocused()
  // No celular, o aviso de que começou.
  await expect(taren.getByRole('status').filter({ hasText: 'A sessão começou' })).toContainText('Sessão 2 — A Torre')
  await expect(taren.locator('.player-session')).toHaveText(/Sessão 2/)
  await expect(naMesa).toContainText('Sessão 2 · A Torre')
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
    await page.waitForTimeout(200)
    expect(await audit(page)).toEqual([])
  }
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })

  await abertura.getByRole('button', { name: 'Começar a jogar' }).click()
  await expect(abertura).toHaveCount(0)
  // O app vira a mesa: o modo sessão, com o nome e o tempo de jogo no alto.
  await expect(page.locator('.sm-bar')).toContainText('Mesa de sexta · Sessão 2')
  await expect(page.locator('.sm-name')).toHaveText('A Torre')
  await expect(page.getByLabel('Tempo de jogo: 0 h 0 min')).toBeVisible()
  await page.getByRole('textbox', { name: 'Anotar no registro' }).fill('Ilsa apareceu na janela da Torre.')
  await page.getByRole('button', { name: 'Anotar' }).click()
  await expect(page.getByRole('region', { name: 'Registro' })).toContainText('A sessão começou.')

  // Encerrar: o resumo para o mestre, o aviso no celular e o registro em Ideias.
  await more(page, 'Encerrar sessão')
  await page.getByRole('group', { name: 'Encerrar a sessão?' }).getByRole('button', { name: 'Encerrar' }).click()
  const fim = page.getByRole('dialog', { name: 'Fim da sessão' })
  await expect(fim).toContainText('Notas1')
  await expect(fim).toContainText('Durou< 1 min')
  await expect(taren.getByRole('status').filter({ hasText: 'A sessão terminou' })).toBeVisible()
  await expect(taren.locator('.player-session')).toHaveCount(0)
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
    await taren.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
    await page.waitForTimeout(200)
    expect(await audit(page)).toEqual([])
    expect(await audit(taren)).toEqual([])
  }
  // Taren fecha o Codex: sai da mesa para o mestre.
  await taren.close({ runBeforeUnload: true })
  await expect(presence).not.toContainText('Taren')
  await expect(presence.getByRole('button', { name: 'Convidar jogadores' })).toBeAttached()
  await fim.getByRole('button', { name: 'Revisar em Ideias' }).click()
  await expect(page.getByText(/Ilsa apareceu na janela da Torre\./).first()).toBeVisible()
})

test('improvisar na mesa: quem não veio, anunciar e revelar na hora, e o celular mostra tudo', async ({ page, context, baseURL }) => {
  test.setTimeout(120_000)
  await fakeCodex(context)
  await fakeRealtime(context, SERVER)
  await ostria(page, baseURL!)
  await page.locator('.mesa-presence').getByRole('button', { name: 'Convidar jogadores' }).click()
  const convite = page.getByRole('dialog', { name: 'Convidar jogadores' })
  await convite.getByRole('button', { name: 'Criar o link da mesa' }).click()
  const link = await convite.getByRole('textbox', { name: 'Link para os jogadores' }).inputValue()
  await page.keyboard.press('Escape')

  // No celular, cada personagem aparece com quem joga com ele.
  const brisa = await context.newPage()
  await brisa.setViewportSize({ width: 390, height: 800 })
  await brisa.goto(link)
  const quem = brisa.getByRole('region', { name: 'Quem é você na mesa?' })
  await expect(quem.getByRole('button', { name: /Taren/ })).toContainText('Bruno')
  await quem.getByRole('button', { name: /Brisa/ }).click()

  // Bruno e Carla não vieram: Taren fica de fora e o mestre conduz Ilmar.
  await page.getByRole('button', { name: 'Começar agora' }).click()
  const abertura = page.getByRole('dialog', { name: 'A Torre' })
  await expect(abertura.locator('.attendance-row', { hasText: 'Brisa' })).toContainText('no Codex agora')
  await abertura.getByRole('radiogroup', { name: 'Taren nesta sessão' }).getByRole('radio', { name: 'Fica de fora' }).click()
  await abertura.getByRole('radiogroup', { name: 'Ilmar nesta sessão' }).getByRole('radio', { name: 'Mestre conduz' }).click()
  await abertura.getByRole('button', { name: 'Começar a jogar' }).click()
  await brisa.getByRole('status').filter({ hasText: 'A sessão começou' }).click()

  const grupo = page.getByRole('region', { name: 'Grupo' })
  await expect(grupo.locator('.pc-out')).toContainText('Taren')
  await expect(grupo.locator('.pc-card', { hasText: 'Ilmar' })).toContainText('mestre conduz')
  const init = page.getByRole('region', { name: 'Iniciativa' })
  await init.getByRole('button', { name: 'Começar combate' }).click()
  await expect(init.locator('.fight-row')).toHaveCount(2)
  await expect(init).not.toContainText('Taren')
  // Ilmar o mestre conduz (já rolado); Brisa rola no celular, e só então os turnos se definem.
  await expect(init.locator('.fight-row', { hasText: 'Brisa' })).toContainText('rolando no celular')
  await expect(init.getByRole('button', { name: 'Definir turnos' })).toBeDisabled()
  // No celular, o pedido abre no meio da tela com o botão de rolar; "Depois" guarda no alto do Codex.
  const chamada = brisa.getByRole('dialog', { name: 'Combate: role a iniciativa' })
  await expect(chamada).toContainText('Combate!')
  await expect(chamada.getByRole('button', { name: 'Rolar Iniciativa (+3)' })).toBeFocused()
  await chamada.getByRole('button', { name: 'Depois' }).click()
  await expect(chamada).toHaveCount(0)
  const guardado = brisa.getByRole('region', { name: 'Combate: role a iniciativa' })
  await guardado.getByRole('button', { name: /^Rolar Iniciativa/ }).click()
  const dado = brisa.getByRole('dialog', { name: 'Quanto saiu no dado?' })
  await dado.getByRole('spinbutton').fill('12')
  await dado.getByRole('button', { name: 'Registrar' }).click()
  await expect(guardado).toHaveCount(0)
  await expect(init.getByRole('button', { name: /^Brisa: iniciativa 15/ })).toBeVisible()
  await init.getByRole('button', { name: 'Definir turnos' }).click()
  await expect(brisa.locator('.codex-order')).toContainText('Brisa')
  await expect(page.getByRole('region', { name: 'Registro' })).toContainText('Taren fica de fora desta sessão (Bruno não veio).')
  await expect(brisa.locator('.codex-pc', { hasText: 'Taren' })).toContainText('Fora desta sessão')
  await expect(brisa.locator('.codex-pc', { hasText: 'Ilmar' })).toContainText('Com o mestre nesta sessão')

  // Um inimigo aparece, criado na hora: aviso na tela de todos, nome no Codex, lugar na iniciativa.
  await page.getByRole('button', { name: 'Anunciar', exact: true }).click()
  const anunciar = page.getByRole('dialog', { name: 'Anunciar para a mesa' })
  await anunciar.getByRole('button', { name: 'Um inimigo aparece!' }).click()
  await expect(anunciar.getByRole('radio', { name: 'Perigo' })).toHaveAttribute('aria-checked', 'true')
  await anunciar.getByRole('combobox', { name: 'Quem aparece (opcional)' }).fill('Vulto da Torre')
  await page.getByRole('option', { name: /Criar “Vulto da Torre”/ }).click()
  await expect(anunciar.getByRole('switch', { name: 'Entra no combate (iniciativa)' })).toBeChecked()
  const ajuda = await runPageTour(page, 'Anunciar para a mesa')
  expect(ajuda.every((x) => x.spot)).toBe(true)
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
    await page.waitForTimeout(200)
    expect(await audit(page)).toEqual([])
  }
  await anunciar.getByRole('button', { name: 'Anunciar', exact: true }).click()
  await expect(anunciar).toHaveCount(0)

  const aviso = brisa.getByRole('alert').filter({ hasText: 'Um inimigo aparece!' })
  await expect(aviso).toContainText('Perigo!')
  for (const scheme of ['light', 'dark'] as const) {
    await brisa.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
    await brisa.waitForTimeout(200)
    expect(await audit(brisa)).toEqual([])
  }
  await aviso.click()
  const revelou = brisa.getByRole('status').filter({ hasText: 'O mestre revelou' })
  await expect(revelou).toContainText('Vulto da Torre')
  await revelou.click()
  await expect(brisa.locator('.player-notice')).toContainText('Um inimigo aparece!')
  await expect(brisa.locator('.codex-order')).toContainText('Vulto da Torre')
  await expect(init.locator('.fight-row')).toHaveCount(3)
  await expect(page.getByRole('region', { name: 'Registro' })).toContainText('Aviso à mesa: Um inimigo aparece!')

  // Um segredo, com um toque, direto da mesa.
  const segredos = page.getByRole('region', { name: 'Segredos' })
  await segredos.getByRole('button', { name: 'Revelar o fato: Vaelor sobreviveu à Queda' }).click()
  await expect(segredos.getByRole('list', { name: 'Revelado nesta sessão' })).toContainText('Vaelor sobreviveu à Queda')
  await expect(brisa.getByRole('status').filter({ hasText: 'O mestre revelou' })).toContainText('Vaelor sobreviveu à Queda')
  await expect(brisa.getByText('Vaelor sobreviveu à Queda').last()).toBeAttached()
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
    await page.waitForTimeout(200)
    expect(await audit(page)).toEqual([])
  }
})

test('modo sessão: o app vira a mesa, sai e volta de qualquer lugar, e no celular uma parte por vez', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/app/?exemplo=ostria')
  await expect(page.getByRole('button', { name: 'Continuar escrevendo' })).toBeVisible()
  await nav(page, 'RPG').click()
  await page.getByRole('button', { name: 'Começar agora' }).click()
  await page.getByRole('button', { name: 'Começar a jogar' }).click()

  // Sem o menu da escrita: só a mesa, com a sessão no alto.
  const areas = page.getByRole('navigation', { name: 'Áreas' })
  await expect(areas).toBeHidden()
  await expect(page.getByRole('tab', { name: 'Painel do mestre' })).toHaveCount(0)
  await expect(page.locator('.sm-name')).toHaveText('A Torre')
  await expect(page.getByRole('timer', { name: /Tempo de jogo/ })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Preparação da sessão' })).toHaveValue(/Luz na janela da Torre/)
  for (const region of ['Iniciativa', 'Grupo', 'Segredos', 'Dados', 'Registro']) await expect(page.getByRole('region', { name: region })).toBeVisible()

  // A ficha completa de um personagem, sem sair da mesa.
  await page.getByRole('button', { name: 'Ficha de Brisa' }).click()
  const ficha = page.getByRole('dialog', { name: 'Ficha de Brisa' })
  await expect(ficha).toContainText('Rapieira')
  await page.keyboard.press('Escape')
  await expect(ficha).toHaveCount(0)

  const ajuda = await runPageTour(page, 'Modo sessão')
  // No computador, cada passo destaca a sua parte (as abas de baixo são só do celular).
  expect(ajuda.every((x) => x.spot)).toBe(true)
  expect(ajuda.map((x) => x.title)).not.toContain('As partes')
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
    await page.waitForTimeout(200)
    expect(await audit(page)).toEqual([])
  }

  // Sair: o app volta, a sessão continua; de qualquer área, um toque volta para ela.
  await more(page, 'Sair do modo sessão')
  await expect(areas).toBeVisible()
  await expect(page.getByRole('button', { name: 'Voltar para a sessão' })).toBeVisible()
  await nav(page, 'Fichas').click()
  await page.getByRole('button', { name: /Sessão 2 ao vivo · Voltar/ }).click()
  await expect(page.locator('.session-mode-view')).toBeVisible()
  await expect(areas).toBeHidden()
  await page.reload()
  await expect(page.locator('.session-mode-view')).toBeVisible()

  // No celular: uma parte por vez, com as abas embaixo.
  await page.setViewportSize({ width: 390, height: 800 })
  const partes = page.getByRole('navigation', { name: 'Partes da sessão' })
  await partes.getByRole('button', { name: 'Segredos' }).click()
  await expect(page.getByRole('region', { name: 'Segredos' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Grupo' })).toHaveCount(0)
  await partes.getByRole('button', { name: 'Grupo' }).click()
  await expect(page.getByRole('region', { name: 'Grupo' })).toBeVisible()
  await expect(partes.getByRole('button', { name: 'Grupo' })).toHaveAttribute('aria-current', 'page')
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
    await page.waitForTimeout(200)
    expect(await audit(page)).toEqual([])
  }

  // Encerrar: o resumo, e o app volta ao normal, sem a pílula.
  await more(page, 'Encerrar sessão')
  await page.getByRole('group', { name: 'Encerrar a sessão?' }).getByRole('button', { name: 'Encerrar' }).click()
  await page.getByRole('dialog', { name: 'Fim da sessão' }).getByRole('button', { name: 'Fechar' }).click()
  await expect(page.locator('.session-mode-view')).toHaveCount(0)
  await expect(areas).toBeVisible()
  await expect(page.getByRole('button', { name: /ao vivo · Voltar/ })).toHaveCount(0)
})

test('o mestre pede um teste, põe inimigos prontos no combate e publica o diário; o celular acompanha tudo', async ({ page, context, baseURL }) => {
  test.setTimeout(120_000)
  await fakeCodex(context)
  await fakeRealtime(context, SERVER)
  await ostria(page, baseURL!)
  await page.locator('.mesa-presence').getByRole('button', { name: 'Convidar jogadores' }).click()
  const convite = page.getByRole('dialog', { name: 'Convidar jogadores' })
  await convite.getByRole('button', { name: 'Criar o link da mesa' }).click()
  const link = await convite.getByRole('textbox', { name: 'Link para os jogadores' }).inputValue()
  await page.keyboard.press('Escape')
  const brisa = await context.newPage()
  await brisa.setViewportSize({ width: 390, height: 800 })
  await brisa.goto(link)
  await brisa.getByRole('region', { name: 'Quem é você na mesa?' }).getByRole('button', { name: /Brisa/ }).click()
  await page.getByRole('button', { name: 'Começar agora' }).click()
  await page.getByRole('button', { name: 'Começar a jogar' }).click()
  await brisa.getByRole('status').filter({ hasText: 'A sessão começou' }).click()

  // Bestiário: três goblins entram numerados, com os ataques prontos na vez deles.
  const init = page.getByRole('region', { name: 'Iniciativa' })
  await init.getByRole('button', { name: 'Começar combate' }).click()
  await init.getByRole('combobox', { name: 'Inimigo pronto' }).selectOption({ label: 'Goblin das falésias' })
  await init.getByRole('textbox', { name: 'Quantos' }).fill('3')
  await init.getByRole('button', { name: 'Pôr no combate' }).click()
  await expect(init.locator('.fight-row', { hasText: 'Goblin das falésias' })).toHaveCount(3)
  // Brisa rola no celular; por Taren e Ilmar (sem celular), o mestre rola.
  await brisa.getByRole('dialog', { name: 'Combate: role a iniciativa' }).getByRole('button', { name: /^Rolar Iniciativa/ }).click()
  const dado = brisa.getByRole('dialog', { name: 'Quanto saiu no dado?' })
  await dado.getByRole('spinbutton').fill('10')
  await dado.getByRole('button', { name: 'Registrar' }).click()
  for (const pc of ['Taren', 'Ilmar']) await init.getByRole('button', { name: `Rolar por ${pc}` }).click()
  await init.getByRole('button', { name: 'Definir turnos' }).click()
  // Até a vez de um goblin.
  for (let i = 0; i < 6 && !(await page.getByRole('region', { name: /^Vez de Goblin das falésias/ }).count()); i++) await init.getByRole('button', { name: /Próxima vez/ }).click()
  await init.getByRole('button', { name: /^Goblin das falésias 2: / }).click()
  for (const n of [1, 2, 3]) await expect(init).toContainText(`Goblin das falésias ${n}`)
  await expect(init.getByRole('textbox', { name: 'PV de Goblin das falésias 2' })).toHaveValue('7/7')
  const vez = page.getByRole('region', { name: /^Vez de Goblin das falésias/ })
  await expect(vez.getByRole('button', { name: 'Atacar com Cimitarra (+4)' })).toBeVisible()
  await expect(brisa.locator('.codex-order')).toContainText('Goblin das falésias 3')

  // Pedir teste: Percepção, CD 15. O celular mostra o pedido; o resultado volta para o mestre.
  await page.getByRole('button', { name: 'Pedir teste' }).click()
  const pedir = page.getByRole('dialog', { name: 'Pedir teste' })
  await pedir.getByRole('combobox', { name: 'O que rolar' }).selectOption({ label: 'Percepção' })
  await pedir.getByRole('textbox', { name: 'Dificuldade (só você vê)' }).fill('15')
  const ajuda = await runPageTour(page, 'Pedir teste')
  expect(ajuda.every((x) => x.spot)).toBe(true)
  await pedir.getByRole('button', { name: 'Pedir', exact: true }).click()
  const testes = page.getByRole('region', { name: 'Testes pedidos' })
  await expect(testes).toContainText('Percepção · CD 15')
  await expect(testes).toContainText('0 de 3')

  const pedido = brisa.getByRole('dialog', { name: 'Teste pedido: Percepção' })
  await expect(pedido).toContainText('O mestre pede um teste')
  await pedido.getByRole('button', { name: /^Rolar Percepção/ }).click()
  const quanto = brisa.getByRole('dialog', { name: 'Quanto saiu no dado?' })
  await quanto.getByRole('spinbutton').fill('16')
  await quanto.getByRole('button', { name: 'Registrar' }).click()
  await expect(pedido).toHaveCount(0)
  await expect(testes.locator('.request-row', { hasText: 'Brisa' })).toContainText('passou')
  await expect(brisa.getByRole('list', { name: 'Rolagens da mesa' })).toContainText('Passou')
  await testes.getByRole('button', { name: 'Rolar por Taren' }).click()
  await expect(testes).toContainText('2 de 3')
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
    await page.waitForTimeout(200)
    expect(await audit(page)).toEqual([])
  }
  await testes.getByRole('button', { name: 'Encerrar' }).click()
  await expect(testes).toHaveCount(0)

  // O diário: o mestre começa pelas notas, revisa e publica; o Codex dos jogadores mostra.
  await page.getByRole('textbox', { name: 'Anotar no registro' }).fill('Os goblins fugiram pelas falésias.')
  await page.getByRole('button', { name: 'Anotar' }).click()
  await more(page, 'Encerrar sessão')
  await page.getByRole('group', { name: 'Encerrar a sessão?' }).getByRole('button', { name: 'Encerrar' }).click()
  const fim = page.getByRole('dialog', { name: 'Fim da sessão' })
  await fim.getByRole('button', { name: 'Escrever o diário para os jogadores' }).click()
  await fim.getByRole('button', { name: 'Começar pelas notas do registro' }).click()
  const resumo = fim.getByRole('textbox', { name: 'Resumo para os jogadores' })
  await expect(resumo).toHaveValue('Os goblins fugiram pelas falésias.')
  await resumo.fill('Os goblins fugiram pelas falésias. Ilsa observava da Torre.')
  await fim.getByText('Publicar no diário do Codex').click()
  await expect(fim.getByRole('switch', { name: 'Publicar no diário do Codex' })).toBeChecked()
  await fim.getByRole('button', { name: 'Fechar' }).click()
  const diario = brisa.locator('.codex-journal')
  await expect(diario).toContainText('Sessão 2 — A Torre')
  await expect(diario).toContainText('Ilsa observava da Torre.')
  for (const scheme of ['light', 'dark'] as const) {
    await brisa.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
    await brisa.waitForTimeout(200)
    expect(await audit(brisa)).toEqual([])
  }

  // O bestiário fica em Dados e tabelas, para criar e acertar os inimigos.
  await page.getByRole('tab', { name: 'Dados e tabelas' }).click()
  const bestiario = page.getByRole('region', { name: 'Inimigos prontos' })
  await expect(bestiario).toContainText('Goblin das falésias')
  await bestiario.getByRole('button', { name: /Capanga do porto/ }).click()
  await expect(bestiario.getByRole('textbox', { name: 'Dano de Porrete' })).toHaveValue('1d6+1')
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
    await page.waitForTimeout(200)
    expect(await audit(page)).toEqual([])
  }
})
