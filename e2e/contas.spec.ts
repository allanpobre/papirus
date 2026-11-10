import { readFile } from 'node:fs/promises'
import { expect, test, type BrowserContext } from './fixtures.ts'

const SERVER = 'https://papirus-teste.supabase.co'
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
const jwt = (sub: string) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.assinatura`

/** Imita o Supabase Auth e a tabela papirus_universes (com o RLS de "só o dono"). */
async function fakeAccounts(context: BrowserContext, rows = new Map<string, Record<string, unknown>>()) {
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

  // Na biblioteca, o lado da nuvem está igual ao deste aparelho.
  await page.getByTitle('Trocar de universo').first().click()
  await expect(page.getByText(/na nuvem: igual/)).toBeVisible()

  // Sair não apaga nada deste navegador.
  await page.getByRole('button', { name: 'Conta: ana@exemplo.com' }).click()
  await page.getByRole('dialog', { name: 'Sua conta' }).getByRole('tab', { name: 'Conta' }).click()
  await page.getByRole('button', { name: 'Sair da conta' }).click()
  // Volta para a apresentação; o app abre de novo sem conta.
  await expect(page).not.toHaveURL(/\/app\/$/)
  await page.goto('/app/')
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Continuar escrevendo Ostria/ })).toBeVisible()
})

test('duplas: a cópia antiga vira versão guardada dentro do universo, e na nuvem fica um só', async ({ page, context }) => {
  const rows = await fakeAccounts(context)
  await page.goto('/app/')
  await page.getByRole('textbox', { name: 'Nome do novo universo' }).fill('Ostria')
  await page.getByRole('button', { name: 'Criar universo' }).click()
  await page.getByRole('button', { name: 'Começar a escrever' }).click()
  await page.keyboard.type('Era noite em Ostria.')
  await expect(page.getByRole('status').first()).toHaveText('Salvo')

  // Como as versões antigas faziam: a cada conflito, a cópia da nuvem virava outro universo, "Nome (versão da nuvem)".
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /Ajustes e dados/ }).click()
  await page.getByRole('navigation', { name: 'Categorias dos ajustes' }).getByRole('button', { name: 'Dados e backup' }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: /Baixar backup/ }).first().click()
  const file = JSON.parse(await readFile(await (await download).path(), 'utf8')) as { universe: { id: string; name: string } }
  file.universe = { ...file.universe, id: '99999999-9999-4999-8999-999999999999', name: 'Ostria (versão da nuvem)' }
  await page.getByTitle('Trocar de universo').first().click()
  await page.locator('input[type=file][accept*="json"]').first().setInputFiles({ name: 'copia.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) })
  await expect(page.getByRole('navigation', { name: 'Áreas' })).toBeVisible()

  // Na lista: um item só, com a cópia dentro dele como versão guardada.
  await page.getByTitle('Trocar de universo').first().click()
  const list = page.getByRole('list', { name: 'Universos', exact: true })
  await expect(list.locator('> li')).toHaveCount(1)
  await expect(list.locator('> li .library-name')).toHaveText('Ostria')
  await list.getByText('1 versão guardada').click()
  const versions = page.getByRole('list', { name: 'Versões guardadas de Ostria' })
  await expect(versions.getByRole('listitem')).toHaveCount(1)
  await expect(versions).toContainText('versão da nuvem')

  // Com a conta, só o universo sobe: na nuvem, um registro. A dupla mostra os dois lados iguais.
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Entrar no Papirus' })
  await dialog.getByRole('textbox', { name: 'Endereço do projeto' }).fill(SERVER)
  await dialog.getByRole('textbox', { name: 'Chave pública (anon key)' }).fill('eyJ.chave-de-teste')
  await dialog.getByRole('button', { name: 'Pronto' }).click()
  await dialog.getByRole('textbox', { name: 'E-mail' }).fill('ana@exemplo.com')
  await dialog.getByLabel('Senha').fill('segredo123')
  await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.getByRole('dialog', { name: 'Sua conta' }).getByRole('button', { name: 'Fechar' }).click()
  const pair = page.getByRole('group', { name: 'Onde está Ostria' })
  await expect(pair).toContainText('igual', { timeout: 15_000 })
  expect([...rows.values()].map((r) => r.name)).toEqual(['Ostria'])

  // A versão aberta e mexida continua só neste aparelho.
  await page.getByRole('list', { name: 'Versões guardadas de Ostria' }).getByRole('button', { name: 'Abrir' }).click()
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Escrever/ }).click()
  await page.getByRole('textbox', { name: 'Texto da cena' }).click()
  await page.keyboard.type(' Só na versão.')
  await expect(page.getByRole('status').first()).toHaveText('Salvo')
  await page.waitForTimeout(1500)
  expect(rows.size).toBe(1)
  expect(JSON.stringify([...rows.values()][0].data)).not.toContain('Só na versão')

  // Apagar a versão não mexe no universo.
  await page.getByTitle('Trocar de universo').first().click()
  await page.getByRole('list', { name: 'Universos', exact: true }).getByText('1 versão guardada').click()
  await page.getByRole('list', { name: 'Versões guardadas de Ostria' }).getByRole('button', { name: 'Apagar esta versão' }).click()
  await page.getByRole('button', { name: 'Apagar versão' }).click()
  await expect(page.getByRole('button', { name: /^Continuar escrevendo Ostria/ })).toBeVisible()
  await expect(page.getByText('versão guardada')).toHaveCount(0)
  expect([...rows.values()].filter((r) => !r.deleted).map((r) => r.name)).toEqual(['Ostria'])
})

test('duplas: arrumar os repetidos deixa um universo e um só na nuvem; importar o mesmo livro pergunta', async ({ page, context }) => {
  const rows = new Map<string, Record<string, unknown>>()
  await fakeAccounts(context, rows)
  await page.goto('/app/')
  await page.getByRole('textbox', { name: 'Nome do novo universo' }).fill('Ostria')
  await page.getByRole('button', { name: 'Criar universo' }).click()
  await page.getByRole('button', { name: 'Começar a escrever' }).click()
  await page.keyboard.type('Era noite em Ostria.')
  await expect(page.getByRole('status').first()).toHaveText('Salvo')
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /Ajustes e dados/ }).click()
  await page.getByRole('navigation', { name: 'Categorias dos ajustes' }).getByRole('button', { name: 'Dados e backup' }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: /Baixar backup/ }).first().click()
  const file = JSON.parse(await readFile(await (await download).path(), 'utf8')) as { schemaVersion: number; universe: { id: string; name: string; description: string; updatedAt: string } }
  const u = file.universe

  // Na conta, como as versões antigas deixaram: o universo e uma "versão da nuvem" que subiu como outro universo.
  const row = (universe: typeof u) => ({ user_id: '11111111-1111-4111-8111-111111111111', id: universe.id, name: universe.name, words: 4, data: { schemaVersion: file.schemaVersion, revision: 0, universe }, updated_at: universe.updatedAt, deleted: false })
  const copy = { ...u, id: '99999999-9999-4999-8999-999999999999', name: 'Ostria (versão da nuvem)', description: 'a que estava na nuvem', updatedAt: new Date(Date.parse(u.updatedAt) - 3 * 86400000).toISOString() }
  rows.set(u.id, row(u))
  rows.set(copy.id, row(copy))

  await page.getByTitle('Trocar de universo').first().click()
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Entrar no Papirus' })
  await dialog.getByRole('textbox', { name: 'Endereço do projeto' }).fill(SERVER)
  await dialog.getByRole('textbox', { name: 'Chave pública (anon key)' }).fill('eyJ.chave-de-teste')
  await dialog.getByRole('button', { name: 'Pronto' }).click()
  await dialog.getByRole('textbox', { name: 'E-mail' }).fill('ana@exemplo.com')
  await dialog.getByLabel('Senha').fill('segredo123')
  await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.getByRole('dialog', { name: 'Sua conta' }).getByRole('button', { name: 'Fechar' }).click()

  // A cópia desce e já aparece dentro do universo; como ela ainda está na nuvem, há o que arrumar.
  const card = page.getByRole('region', { name: 'Livros repetidos' })
  await expect(card).toContainText('Um livro aparece mais de uma vez.', { timeout: 15_000 })
  await expect(page.getByRole('list', { name: 'Universos', exact: true }).locator('> li')).toHaveCount(1)
  await card.getByRole('button', { name: 'Arrumar' }).click()
  const tidy = page.getByRole('dialog', { name: 'Arrumar repetidos' })
  await expect(tidy.getByRole('heading', { name: 'Ostria: 2 versões encontradas' })).toBeVisible()
  const options = tidy.getByRole('radiogroup', { name: 'Qual é o universo de Ostria' }).getByRole('radio')
  await expect(options).toHaveCount(2)
  // A mais recente vem marcada; aqui, a boa é a outra (a que estava na nuvem).
  await expect(options.first()).toBeChecked()
  await options.nth(1).check()
  await tidy.getByRole('button', { name: 'Guardar as outras como versões' }).click()
  await expect(tidy.getByRole('status')).toHaveText('Tudo arrumado: um universo por livro.')
  await tidy.getByRole('button', { name: 'Fechar' }).click()

  // Na nuvem, um só: o universo (com o mesmo id de sempre) agora com o conteúdo escolhido; a cópia saiu.
  await expect.poll(() => (rows.get(copy.id) as { deleted: boolean }).deleted, { timeout: 15_000 }).toBe(true)
  await expect.poll(() => JSON.stringify(rows.get(u.id)!.data), { timeout: 15_000 }).toContain('a que estava na nuvem')
  expect([...rows.values()].filter((r) => !r.deleted).map((r) => r.id)).toEqual([u.id])
  await expect(page.getByRole('region', { name: 'Livros repetidos' })).toHaveCount(0)
  await expect(page.getByRole('group', { name: 'Onde está Ostria' })).toContainText('igual', { timeout: 15_000 })
  const list = page.getByRole('list', { name: 'Universos', exact: true })
  await list.getByText('1 versão guardada').click()
  const versions = page.getByRole('list', { name: 'Versões guardadas de Ostria' })
  await expect(versions.getByRole('listitem')).toHaveCount(1)
  await expect(versions).toContainText('versão anterior')

  // Importar o backup do mesmo livro pergunta, em vez de criar "Ostria (importado)".
  await page.locator('input[type=file][accept*="json"]').first().setInputFiles({ name: 'ostria.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) })
  const ask = page.getByRole('dialog', { name: 'Este universo já está aqui' })
  await expect(ask).toContainText('O backup é de “Ostria”')
  await ask.getByRole('button', { name: 'Guardar como versão' }).click()
  await expect(page.getByText('O backup ficou guardado como versão de “Ostria”.')).toBeVisible()
  await expect(list.locator('> li')).toHaveCount(1)
  await expect(list.getByText('2 versões guardadas')).toBeVisible()
  await expect(versions).toContainText('backup importado')
  expect([...rows.values()].filter((r) => !r.deleted).map((r) => r.id)).toEqual([u.id])

  // Aberta, a versão diz o que é; "Ficar com esta versão" troca e abre o universo já com ela.
  await versions.getByRole('listitem').filter({ hasText: 'backup importado' }).getByRole('button', { name: 'Abrir' }).click()
  const banner = page.getByRole('status').filter({ hasText: 'Versão guardada' })
  await expect(banner).toContainText('backup importado')
  await banner.getByRole('button', { name: 'Ficar com esta versão' }).click()
  await page.getByRole('button', { name: 'Ficar com esta', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Versão guardada' })).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: 'Áreas' })).toBeVisible()
  // O universo voltou a ser o do backup (sem a descrição da cópia), e sobe para a mesma dupla.
  await expect.poll(() => JSON.stringify(rows.get(u.id)!.data), { timeout: 20_000 }).not.toContain('a que estava na nuvem')
  expect([...rows.values()].filter((r) => !r.deleted).map((r) => r.id)).toEqual([u.id])
})
