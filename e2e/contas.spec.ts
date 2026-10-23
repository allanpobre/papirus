import { expect, test, type BrowserContext } from '@playwright/test'

const SERVER = 'https://papirus-teste.supabase.co'
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
const jwt = (sub: string) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.assinatura`

/** Imita o Supabase Auth e a tabela papirus_universes (com o RLS de "só o dono"). */
async function fakeAccounts(context: BrowserContext) {
  const rows = new Map<string, Record<string, unknown>>()
  const user = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@exemplo.com', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() }
  const cors = { 'access-control-allow-origin': '*' }
  await context.route(`${SERVER}/auth/v1/**`, async (route) => {
    const url = route.request().url()
    if (url.includes('/token')) {
      const body = route.request().postDataJSON() as { password?: string }
      if (body.password !== 'segredo123') return route.fulfill({ status: 400, headers: cors, json: { error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials' } })
      return route.fulfill({ headers: cors, json: { access_token: jwt(user.id), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user } })
    }
    if (url.includes('/logout')) return route.fulfill({ status: 204, headers: cors, body: '' })
    if (url.includes('/user')) return route.fulfill({ headers: cors, json: user })
    return route.fulfill({ status: 404, headers: cors, json: {} })
  })
  await context.route(`${SERVER}/rest/v1/papirus_universes**`, async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const idFilter = url.searchParams.get('id')?.replace('eq.', '')
    if (req.method() === 'GET') {
      const select = (url.searchParams.get('select') ?? '*').split(',')
      const list = [...rows.values()].filter((r) => !idFilter || r.id === idFilter).map((r) => (select[0] === '*' ? r : Object.fromEntries(select.map((c) => [c, r[c]]))))
      const single = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object')
      return route.fulfill({ headers: cors, json: single ? (list[0] ?? null) : list })
    }
    if (req.method() === 'POST') {
      const body = req.postDataJSON() as Record<string, unknown> | Record<string, unknown>[]
      for (const r of Array.isArray(body) ? body : [body]) rows.set(r.id as string, r)
      return route.fulfill({ status: 201, headers: cors, body: '' })
    }
    if (req.method() === 'PATCH') {
      const r = idFilter && rows.get(idFilter)
      if (r) rows.set(idFilter!, { ...r, ...(req.postDataJSON() as object) })
      return route.fulfill({ status: 204, headers: cors, body: '' })
    }
    return route.fulfill({ status: 405, headers: cors, body: '' })
  })
  return rows
}

test('conta opcional: entrar, levar os universos para a nuvem e sair sem perder nada', async ({ page, context }) => {
  const rows = await fakeAccounts(context)
  await page.goto('/app/')
  // Primeira visita: a tela inicial explica e não exige conta.
  await expect(page.getByRole('heading', { name: 'Comece seu primeiro universo' })).toBeVisible()
  await page.getByRole('textbox', { name: 'Nome do novo universo' }).fill('Ostria')
  await page.getByRole('button', { name: 'Criar universo' }).click()
  await page.getByRole('button', { name: 'Começar a escrever' }).click()
  await page.keyboard.type('Era noite em Ostria.')
  await expect(page.getByRole('status').first()).toHaveText('Salvo')

  await page.getByRole('button', { name: 'Entrar' }).click()
  const dialog = page.getByRole('dialog', { name: 'Entrar no Papirus' })
  await dialog.getByRole('textbox', { name: 'Endereço do projeto' }).fill(SERVER)
  await dialog.getByRole('textbox', { name: 'Chave pública (anon key)' }).fill('eyJ.chave-de-teste')
  await dialog.getByRole('button', { name: 'Pronto' }).click()
  await dialog.getByRole('textbox', { name: 'E-mail' }).fill('ana@exemplo.com')
  await dialog.getByLabel('Senha').fill('errada1')
  await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(dialog.getByRole('alert')).toHaveText('E-mail ou senha não conferem.')
  await dialog.getByLabel('Senha').fill('segredo123')
  await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Sua conta' })).toContainText('ana@exemplo.com')
  await page.getByRole('dialog', { name: 'Sua conta' }).getByRole('button', { name: 'Fechar' }).click()

  // O universo aberto sobe sozinho depois de salvo.
  await page.keyboard.press('End')
  await page.getByRole('textbox', { name: 'Texto da cena' }).click()
  await page.keyboard.type(' Kael esperava.')
  await expect.poll(() => rows.size, { timeout: 15_000 }).toBe(1)
  await expect.poll(() => JSON.stringify([...rows.values()][0].data), { timeout: 15_000 }).toContain('Kael esperava')

  // Na biblioteca, aparece como guardado na conta.
  await page.getByTitle('Trocar de universo').first().click()
  await expect(page.getByText(/· na conta/)).toBeVisible()

  // Sair não apaga nada deste navegador.
  await page.getByRole('button', { name: 'Conta: ana@exemplo.com' }).click()
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Universos' }).getByRole('button', { name: /^Ostria/ })).toBeVisible()
})
