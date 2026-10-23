import { expect, test, type BrowserContext } from './fixtures.ts'

const SERVER = 'https://papirus-teste.supabase.co'

/** Imita as funções do script supabase/codex.sql, guardando em memória. */
async function fakeSupabase(context: BrowserContext) {
  const store = new Map<string, { key: string; data: unknown; updated_at: string }>()
  const puts: unknown[] = []
  await context.route(`${SERVER}/rest/v1/rpc/*`, async (route) => {
    const fn = route.request().url().split('/rpc/')[1].split('?')[0]
    const body = route.request().postDataJSON() as Record<string, string>
    const json = (status: number, data: unknown) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data), headers: { 'access-control-allow-origin': '*' } })
    if (fn === 'codex_put') {
      const prev = store.get(body.codex_id)
      if (prev && prev.key !== body.codex_key) return json(400, { message: 'chave errada' })
      const updated_at = new Date().toISOString()
      store.set(body.codex_id, { key: body.codex_key, data: body.codex_data, updated_at })
      puts.push(body.codex_data)
      return json(200, updated_at)
    }
    if (fn === 'codex_get') {
      const row = store.get(body.codex_id)
      return json(200, row ? [{ data: row.data, updated_at: row.updated_at }] : [])
    }
    if (fn === 'codex_delete') {
      if (store.get(body.codex_id)?.key === body.codex_key) store.delete(body.codex_id)
      return json(200, null)
    }
    return json(404, { message: 'função desconhecida' })
  })
  // O aviso em tempo real usa WebSocket; aqui ele falha e os jogadores dependem da checagem periódica.
  await context.route(`${SERVER}/realtime/**`, (route) => route.abort())
  return { store, puts }
}

test('Codex ao vivo: o mestre compartilha, o jogador vê e recebe as novas revelações', async ({ page, context, baseURL }) => {
  const fake = await fakeSupabase(context)
  await page.goto('/app/')
  await page.getByRole('button', { name: 'Abrir um universo de exemplo' }).click()
  const nav = page.getByRole('navigation', { name: 'Áreas' })

  // Sem servidor, o Codex aponta para os Ajustes.
  await nav.getByRole('button', { name: /^RPG/ }).click()
  await page.getByRole('tab', { name: 'Revelações e Codex' }).click()
  await page.getByRole('button', { name: 'Configurar servidor' }).click()

  await page.getByRole('textbox', { name: 'Endereço do projeto' }).fill(SERVER)
  await page.getByRole('textbox', { name: 'Chave pública (anon key)' }).fill('eyJ.chave-de-teste')
  await page.getByRole('textbox', { name: 'Endereço público do Papirus' }).fill(baseURL + '/')
  await page.getByRole('button', { name: 'Testar conexão' }).click()
  await expect(page.getByText('Conectado. O servidor está pronto')).toBeVisible()

  await nav.getByRole('button', { name: /^RPG/ }).click()
  await page.getByRole('tab', { name: 'Revelações e Codex' }).click()
  await page.getByRole('button', { name: 'Compartilhar ao vivo' }).click()
  await expect(page.getByText('Codex ao vivo. Mande o link para a mesa.')).toBeVisible()
  const link = await page.getByRole('textbox', { name: 'Link para os jogadores' }).inputValue()
  expect(link).toContain('?mesa=')
  await expect(page.getByRole('img', { name: 'QR code do link para os jogadores' }).locator('svg')).toBeVisible()
  expect(fake.store.size).toBe(1)

  // O jogador abre o link: vê o Codex e nada do resto.
  const player = await context.newPage()
  await player.goto(link)
  await expect(player.getByRole('heading', { name: 'Codex' })).toBeVisible()
  await expect(player.getByText('Cidade portuária', { exact: false })).toBeVisible()
  await expect(player.getByRole('navigation', { name: 'Áreas' })).toHaveCount(0)
  await expect(player.getByRole('heading', { name: 'Linha do tempo' })).toHaveCount(0)

  // O mestre revela um evento; a mudança é publicada sozinha.
  await page.getByRole('combobox', { name: 'O que revelar' }).selectOption({ label: 'Evento' })
  const events = page.getByRole('combobox', { name: 'Escolher evento' })
  await events.selectOption({ label: (await events.locator('option', { hasText: 'A Queda' }).textContent())! })
  await page.getByRole('button', { name: 'Revelar', exact: true }).click()
  await expect.poll(() => JSON.stringify(fake.puts.at(-1))).toContain('A Queda')
  await expect(page.getByText(/Em dia · atualizado às/)).toBeVisible()

  // O jogador recebe ao voltar para a página (ou na checagem periódica).
  await player.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await expect(player.getByRole('heading', { name: 'Linha do tempo' })).toBeVisible()
  await expect(player.locator('.codex-timeline')).toContainText('A Queda')
  await expect(player.getByRole('status')).toHaveText('Novidades do mestre')

  // Parar apaga do servidor; o link avisa.
  await page.getByRole('button', { name: 'Parar' }).click()
  await page.getByRole('button', { name: 'Parar', exact: true }).last().click()
  await expect(page.getByRole('button', { name: 'Compartilhar ao vivo' })).toBeVisible()
  expect(fake.store.size).toBe(0)
  await player.reload()
  await expect(player.getByText('Este Codex não está mais compartilhado.')).toBeVisible()
})
