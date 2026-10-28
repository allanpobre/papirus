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

/** Ostria com uma sessão em andamento e um combate: Brisa (20), Taren (15), Ilmar (10), Bandido (2) e Goblin (1). */
async function combat(page: Page, baseURL: string) {
  await page.goto('/app/?exemplo=ostria')
  await expect(page.getByRole('button', { name: 'Continuar escrevendo' })).toBeVisible()
  await nav(page, 'Ajustes e dados').click()
  await page.getByRole('navigation', { name: 'Categorias dos ajustes' }).getByRole('button', { name: /Conta/ }).click()
  await page.getByRole('textbox', { name: 'Endereço do projeto' }).fill(SERVER)
  await page.getByRole('textbox', { name: 'Chave pública (anon key)' }).fill('eyJ.chave-de-teste')
  await page.getByRole('textbox', { name: 'Endereço público do Papirus' }).fill(baseURL + '/')
  await nav(page, 'RPG').click()
  await page.getByRole('tab', { name: 'Na mesa' }).click()
  await page.getByRole('button', { name: /^Começar/ }).click()

  const init = page.getByRole('region', { name: 'Iniciativa' })
  await init.getByRole('button', { name: 'Adicionar os jogadores da mesa' }).click()
  for (const [name, value] of [
    ['Bandido', '2'],
    ['Goblin', '1'],
  ]) {
    await init.getByRole('textbox', { name: 'Nome' }).fill(name)
    await init.getByRole('textbox', { name: 'Iniciativa', exact: true }).fill(value)
    await init.getByRole('button', { name: 'Adicionar', exact: true }).click()
  }
  for (const [name, value] of [
    ['Brisa', '20'],
    ['Taren', '15'],
    ['Ilmar', '10'],
  ])
    await init.getByRole('textbox', { name: `Iniciativa de ${name}` }).fill(value)
  await init.getByRole('textbox', { name: 'PV de Goblin' }).fill('7')
  await init.getByRole('textbox', { name: 'CA de Goblin' }).fill('12')
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
  await expect(init.locator('.init-row', { hasText: 'Goblin' })).toContainText('derrotado')
  await expect(page.getByRole('region', { name: 'Registro' })).toContainText('Goblin perde 9 PV (fica com -2/7) · derrotado')

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
  await expect(page.getByRole('region', { name: 'Vez de Brisa' })).toBeVisible()
})

test('Codex ao vivo: o jogador rola pela ficha, o mestre confere e todos veem', async ({ page, context, baseURL }) => {
  await fakeCodex(context)
  await fakeRealtime(context, SERVER)
  const init = await combat(page, baseURL!)
  await init.getByRole('button', { name: /Próxima vez/ }).click()
  await expect(page.getByRole('region', { name: 'Vez de Taren' })).toBeVisible()

  await page.getByRole('tab', { name: 'Revelações e Codex' }).click()
  await page.getByRole('button', { name: 'Compartilhar ao vivo' }).click()
  const link = await page.getByRole('textbox', { name: 'Link para os jogadores' }).inputValue()
  await page.getByRole('tab', { name: 'Na mesa' }).click()

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
