import { expect, test, type BrowserContext, type Page } from './fixtures.ts'

// Auditoria 26, pacote 4: a Mesa do Rafa. O sistema antes do botão, a preparação em branco, “Nesta sessão”,
// a rolagem de um toque, o nome do sistema inteiro e o Codex no celular; e o ensaio com quatro jogadores.

async function novaCampanha(page: Page) {
  await page.goto('/app/')
  await page.getByRole('navigation', { name: 'Setores' }).getByRole('button', { name: 'Campanhas' }).click()
}

test.describe('no computador', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('o sistema vem antes do botão, a preparação nasce em branco, e a sessão tem “Nesta sessão” e rolagem de um toque', async ({ page }) => {
    await novaCampanha(page)
    const sistemas = page.getByRole('radiogroup', { name: 'Sistema' })
    const nome = page.getByRole('textbox', { name: 'Nome da campanha' })
    expect((await sistemas.boundingBox())!.y).toBeLessThan((await nome.boundingBox())!.y)
    await sistemas.getByRole('radio', { name: /D&D 5e/ }).click()
    await nome.fill('Sombras de Varn')
    await page.getByRole('button', { name: 'Criar campanha' }).click()
    await expect(page.getByText(/D&D 5e/).first()).toBeVisible()

    // O NPC (que já nasce no Mundo) entra em “Nesta sessão”.
    await page.getByRole('tab', { name: 'Personagens' }).click()
    await page.getByRole('radio', { name: 'NPC do mestre' }).click()
    await page.locator('#nova-ficha-jogo').fill('Corvo Velho')
    await page.getByRole('button', { name: 'Criar personagem' }).click()
    await page.getByRole('tab', { name: 'Preparar' }).click()
    await page.getByRole('tab', { name: 'Sessões' }).click()
    await page.getByRole('button', { name: /Sessão 1/ }).first().click()

    // A preparação vem em branco, com a pergunta só como dica.
    const prep = page.getByRole('textbox', { name: 'Preparação' })
    await expect(prep).toHaveValue('')
    await expect(prep).toHaveAttribute('placeholder', /Onde a história começa/)

    const cast = page.getByRole('region', { name: 'Nesta sessão' })
    await cast.getByRole('combobox').fill('Corvo')
    await page.getByRole('option', { name: /Corvo Velho/ }).first().click()
    await expect(cast.getByRole('button', { name: 'Corvo Velho', exact: true })).toBeVisible()

    // Rolagem de um toque: quem rolou e como foi.
    const rapida = page.getByRole('group', { name: 'Anotar rolagem' })
    await rapida.getByRole('combobox', { name: 'Quem rolou' }).selectOption('Corvo Velho')
    await rapida.getByRole('button', { name: 'Acertou' }).click()
    await expect(page.locator('.log li.log-roll').last()).toContainText('Corvo Velho: acertou')

    // O Painel mostra quem está na próxima sessão.
    await page.getByRole('tab', { name: 'Painel' }).click()
    await expect(page.getByText('Nesta sessão:').locator('..')).toContainText('Corvo Velho')
  })
})

test.describe('no celular', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('o nome do sistema cabe na tela e o “×” do Codex fica na linha do nome', async ({ page }) => {
    await page.goto('/app/?exemplo')
    await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^(Mais|Menu)/ }).click()
    await page.getByRole('group', { name: 'Mesa de RPG' }).getByRole('button', { name: /^Mesa/ }).click()
    await page.getByRole('tab', { name: 'Regras' }).click()
    const nome = page.locator('#system-name')
    const caixa = (await nome.boundingBox())!
    expect(caixa.x).toBeGreaterThanOrEqual(0)
    expect(caixa.x + caixa.width).toBeLessThanOrEqual(390)
    expect(caixa.width).toBeGreaterThan(300)

    await page.getByRole('tab', { name: 'Codex' }).click()
    const linha = page.locator('.reveal-row').first()
    const rotulo = (await linha.locator('.reveal-label').boundingBox())!
    const x = (await linha.getByRole('button', { name: /^Esconder/ }).boundingBox())!
    // O “×” começa na altura da primeira linha do nome (e não numa linha só dele, embaixo).
    expect(Math.abs(x.y - rotulo.y)).toBeLessThan(14)
    expect(x.y).toBeLessThan(rotulo.y + rotulo.height)
  })
})

// O ensaio do link dos jogadores (item 17): quatro celulares abrem o Codex ao mesmo tempo e todos recebem a revelação.
const SERVER = 'https://papirus-teste.supabase.co'
async function fakeCodex(context: BrowserContext) {
  const store = new Map<string, { key: string; data: unknown; updated_at: string }>()
  await context.route(`${SERVER}/rest/v1/rpc/*`, async (route) => {
    const fn = route.request().url().split('/rpc/')[1].split('?')[0]
    const body = route.request().postDataJSON() as Record<string, string>
    const json = (status: number, data: unknown) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data), headers: { 'access-control-allow-origin': '*' } })
    if (fn === 'codex_put') {
      const updated_at = new Date().toISOString()
      store.set(body.codex_id, { key: body.codex_key, data: body.codex_data, updated_at })
      return json(200, updated_at)
    }
    if (fn === 'codex_get') {
      const row = store.get(body.codex_id)
      return json(200, row ? [{ data: row.data, updated_at: row.updated_at }] : [])
    }
    return json(200, null)
  })
  await context.route(`${SERVER}/realtime/**`, (route) => route.abort())
  return store
}

test('ensaio: quatro jogadores abrem o link ao mesmo tempo e todos recebem a revelação', async ({ page, context, baseURL }) => {
  test.setTimeout(120_000)
  await fakeCodex(context)
  await page.goto('/app/?exemplo=ostria')
  const nav = page.getByRole('navigation', { name: 'Áreas' })
  await nav.getByRole('button', { name: /^Mesa/ }).click()
  await page.getByRole('tab', { name: 'Codex' }).click()
  await page.getByRole('button', { name: 'Configurar servidor' }).click()
  await page.getByRole('textbox', { name: 'Endereço do projeto' }).fill(SERVER)
  await page.getByRole('textbox', { name: 'Chave pública (anon key)' }).fill('eyJ.chave-de-teste')
  await page.getByRole('textbox', { name: 'Endereço público do Papirus' }).fill(baseURL + '/')
  await page.getByRole('button', { name: 'Testar conexão' }).click()
  await expect(page.getByText('Conectado. O servidor está pronto')).toBeVisible()
  await nav.getByRole('button', { name: /^Mesa/ }).click()
  await page.getByRole('tab', { name: 'Codex' }).click()
  await page.getByRole('button', { name: 'Compartilhar ao vivo' }).click()
  const link = await page.getByRole('textbox', { name: 'Link para os jogadores' }).inputValue()

  // Quatro celulares entram juntos.
  const jogadores = await Promise.all(
    Array.from({ length: 4 }, async () => {
      const p = await context.newPage()
      await p.setViewportSize({ width: 390, height: 844 })
      return p
    }),
  )
  await Promise.all(jogadores.map((p) => p.goto(link)))
  // Três escolhem o seu personagem (cada um o seu); o quarto só quer ver o Codex.
  const nomes = ['Brisa', 'Taren', 'Ilmar']
  for (const [i, p] of jogadores.entries()) {
    if (i < 3) await p.getByRole('region', { name: 'Qual é o seu personagem?' }).getByRole('button', { name: new RegExp(`^${nomes[i]}`) }).click()
    await p.getByRole('navigation', { name: 'Partes do Codex' }).getByRole('button', { name: 'Codex' }).click()
    await expect(p.getByRole('heading', { name: 'Codex' })).toBeVisible()
  }

  // O mestre revela; todos recebem.
  await page.getByRole('combobox', { name: 'O que revelar' }).selectOption({ label: 'Evento' })
  const eventos = page.getByRole('combobox', { name: 'Escolher evento' })
  await eventos.selectOption({ label: (await eventos.locator('option', { hasText: 'A Queda' }).textContent())! })
  await page.getByRole('button', { name: 'Revelar', exact: true }).click()
  await expect(page.getByText(/Em dia · atualizado às/)).toBeVisible()
  // Cada celular busca de novo ao voltar para a tela; numa máquina lenta, o primeiro aviso pode chegar antes da
  // revelação publicada: repete o aviso até ela chegar (o tempo real do servidor fica de fora no teste).
  for (const p of jogadores) {
    const linha = p.locator('.codex-timeline')
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
      if (await linha.filter({ hasText: 'A Queda' }).waitFor({ timeout: 8_000 }).then(() => true, () => false)) break
    }
    await expect(linha).toContainText('A Queda')
  }
})
