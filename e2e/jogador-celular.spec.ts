import { fakeRealtime } from './fakeRealtime.ts'
import { expect, test, type BrowserContext, type Page } from './fixtures.ts'

const SERVER = 'https://papirus-teste.supabase.co'
const nav = (page: Page, name: string | RegExp) => page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name })

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

/** Ostria com o servidor configurado e uma sessão ao vivo; devolve o link do grupo. */
async function mesaAoVivo(page: Page, baseURL: string) {
  await page.goto('/app/?exemplo=ostria')
  await nav(page, 'Ajustes e dados').click()
  await page.getByRole('navigation', { name: 'Categorias dos ajustes' }).getByText('Avançado').click()
  await page.getByRole('navigation', { name: 'Categorias dos ajustes' }).getByRole('button', { name: 'Servidor próprio' }).click()
  await page.getByRole('textbox', { name: 'Endereço do projeto' }).fill(SERVER)
  await page.getByRole('textbox', { name: 'Chave pública (anon key)' }).fill('eyJ.chave-de-teste')
  await page.getByRole('textbox', { name: 'Endereço público do Papirus' }).fill(baseURL + '/')
  await nav(page, 'Mesa').click()
  await page.getByRole('button', { name: 'Começar agora' }).click()
  await page.getByRole('button', { name: 'Começar a jogar' }).click()
  await page.locator('.sm-bar').getByRole('button', { name: 'Convidar jogadores' }).click()
  await page.getByRole('dialog', { name: 'Convidar jogadores' }).getByRole('button', { name: 'Criar o link do grupo' }).click()
  const link = await page.getByRole('textbox', { name: 'Link para os jogadores' }).inputValue()
  await page.keyboard.press('Escape')
  return link
}

const semRolagemDeLado = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)

test('o celular do jogador a 360 px: a ficha, o Codex, os avisos do mestre e voltar depois que o celular dormiu', async ({ page, context, baseURL }) => {
  test.setTimeout(150_000)
  await fakeCodex(context)
  const realtime = await fakeRealtime(context, SERVER)
  const link = await mesaAoVivo(page, baseURL!)

  const taren = await context.newPage()
  await taren.setViewportSize({ width: 360, height: 740 })
  await taren.goto(link)
  await taren.getByRole('region', { name: 'Qual é o seu personagem?' }).getByRole('button', { name: 'Taren' }).click()
  const estado = taren.locator('.player-live')
  await expect(estado).toHaveText(/ao vivo/)
  expect(await semRolagemDeLado(taren)).toBe(true)

  // A barra de baixo: três partes, cada uma um alvo de toque inteiro (≥ 44 px).
  const partes = taren.getByRole('navigation').last()
  for (const nome of ['Eu', 'Palco', 'Codex']) {
    const b = (await partes.getByRole('button', { name: nome }).boundingBox())!
    expect(b.height, nome).toBeGreaterThanOrEqual(44)
    expect(b.width, nome).toBeGreaterThanOrEqual(44)
  }

  // A ficha ("Eu"): cabe na tela e o botão de rolar fica à mão.
  await partes.getByRole('button', { name: 'Eu' }).click()
  await expect(taren.getByRole('button', { name: 'Rolar como Taren' })).toBeVisible()
  expect(await semRolagemDeLado(taren)).toBe(true)
  const rolar = (await taren.getByRole('button', { name: 'Rolar como Taren' }).boundingBox())!
  expect(rolar.height).toBeGreaterThanOrEqual(44)
  expect(rolar.y + rolar.height).toBeLessThanOrEqual(740)

  // O Codex: rola até o fim, sem rolagem de lado, e cada parte abre.
  await partes.getByRole('button', { name: 'Codex' }).click()
  await taren.evaluate(() => scrollTo(0, document.documentElement.scrollHeight))
  expect(await semRolagemDeLado(taren)).toBe(true)

  // Um aviso do mestre chega na hora, na tela inteira (ou toque para fechar).
  await page.getByRole('button', { name: 'Anunciar', exact: true }).click()
  const anunciar = page.getByRole('dialog', { name: 'Anunciar para o grupo' })
  await anunciar.getByRole('button', { name: 'Um inimigo aparece!' }).click()
  await anunciar.getByRole('button', { name: 'Anunciar', exact: true }).click()
  const aviso = taren.getByRole('alert').filter({ hasText: 'Um inimigo aparece!' })
  await expect(aviso).toBeVisible()
  const ab = (await aviso.boundingBox())!
  expect(ab.x).toBeGreaterThanOrEqual(0)
  expect(ab.x + ab.width).toBeLessThanOrEqual(360)
  await aviso.click()
  await expect(aviso).toHaveCount(0)

  // O celular dorme: a conexão cai e o aparelho fica sem rede. O jogador vê "Reconectando…" (e não um erro).
  realtime.refuse(true)
  realtime.drop()
  await expect(estado).toHaveText(/Reconectando…/, { timeout: 30_000 })
  await expect(estado).not.toHaveText(/ao vivo/)

  // Enquanto dorme, o mestre anuncia outra coisa: não chega pelo canal.
  await page.getByRole('button', { name: 'Anunciar', exact: true }).click()
  await anunciar.getByRole('button', { name: 'Uma sombra passa pela janela.' }).click()
  await anunciar.getByRole('button', { name: 'Anunciar', exact: true }).click()
  await expect(anunciar).toHaveCount(0)

  // O celular acorda (a rede volta): reconecta sozinho, volta a "ao vivo" e o aviso que perdeu aparece.
  realtime.refuse(false)
  await taren.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(estado).toHaveText(/ao vivo/, { timeout: 30_000 })
  // (Um aviso de mistério abre como "status"; o de perigo, como "alert". O recado fica também na parte de cima do Codex.)
  await expect(taren.locator('.player-notice')).toContainText('Uma sombra passa pela janela.', { timeout: 30_000 })
  await expect(taren.getByRole('status').filter({ hasText: 'Uma sombra passa pela janela.' }).first()).toBeVisible()
  expect(await semRolagemDeLado(taren)).toBe(true)

  // E depois de acordar, o canal serve de novo: o mestre anuncia e chega na hora.
  await taren.getByRole('status').filter({ hasText: 'Uma sombra passa pela janela.' }).first().click()
  await page.getByRole('button', { name: 'Anunciar', exact: true }).click()
  await anunciar.getByRole('button', { name: 'Emboscada!' }).click()
  await anunciar.getByRole('button', { name: 'Anunciar', exact: true }).click()
  await expect(taren.getByRole('alert').filter({ hasText: 'Emboscada!' })).toBeVisible({ timeout: 15_000 })
})

test('sem internet, o celular do jogador diz "sem internet" e volta sozinho quando a rede volta', async ({ page, context, baseURL }) => {
  test.setTimeout(120_000)
  await fakeCodex(context)
  const realtime = await fakeRealtime(context, SERVER)
  const link = await mesaAoVivo(page, baseURL!)
  const taren = await context.newPage()
  await taren.setViewportSize({ width: 360, height: 740 })
  await taren.goto(link)
  await taren.getByRole('region', { name: 'Qual é o seu personagem?' }).getByRole('button', { name: 'Taren' }).click()
  const estado = taren.locator('.player-live')
  await expect(estado).toHaveText(/ao vivo/)

  // A rede se vai: o aparelho avisa (offline), o canal cai. Fica "sem internet", e não "Reconectando…" à toa.
  const rede = (on: boolean) =>
    taren.evaluate((online) => {
      Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online })
      dispatchEvent(new Event(online ? 'online' : 'offline'))
    }, on)
  realtime.refuse(true)
  realtime.drop()
  await rede(false)
  await expect(estado).toHaveText(/sem internet/, { timeout: 30_000 })
  expect(await taren.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)

  // A rede volta: o aparelho reconecta sozinho, sem o jogador recarregar a página.
  realtime.refuse(false)
  await rede(true)
  await expect(estado).toHaveText(/ao vivo/, { timeout: 30_000 })
})
