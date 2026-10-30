import type { Browser } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { strFromU8, unzipSync } from 'fflate'
import { createFakeSupabase, PASSWORD, SERVER, PEOPLE } from './fakeSupabase.ts'
import { expect, test, type Page } from './fixtures.ts'
import { openPart } from './areas.ts'

/** Uma "foto" de teste: um PNG grande gerado no navegador (o app deve encolher). */
async function photo(page: Page, color = '#2f6fae', w = 2400, h = 1600) {
  const data = await page.evaluate(
    ([c, w, h]) => {
      const cv = document.createElement('canvas')
      cv.width = w as number
      cv.height = h as number
      const g = cv.getContext('2d')!
      const grad = g.createLinearGradient(0, 0, w as number, h as number)
      grad.addColorStop(0, c as string)
      grad.addColorStop(1, '#f2c14e')
      g.fillStyle = grad
      g.fillRect(0, 0, w as number, h as number)
      for (let i = 0; i < 400; i++) {
        g.fillStyle = `hsl(${(i * 37) % 360} 60% 50% / .5)`
        g.beginPath()
        g.arc((i * 97) % (w as number), (i * 53) % (h as number), 20 + (i % 40), 0, 7)
        g.fill()
      }
      return cv.toDataURL('image/png')
    },
    [color, w, h] as const,
  )
  return { name: 'foto.png', mimeType: 'image/png', buffer: Buffer.from(data.split(',')[1], 'base64') }
}

const newUniverse = async (page: Page, name = 'Ilhas') => {
  await page.goto('/app/')
  await page.getByRole('textbox', { name: 'Nome do novo universo' }).fill(name)
  await page.getByRole('button', { name: 'Criar universo' }).click()
  await page.getByRole('button', { name: 'Começar a escrever' }).click()
  await expect(page.getByRole('textbox', { name: 'Texto da cena' })).toBeFocused()
}

const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: new RegExp(`^${name}`) })

test('imagens: retrato na ficha, capa do universo e imagem na cena, encolhidas e guardadas', async ({ page }) => {
  await newUniverse(page)
  const pic = await photo(page)
  expect(pic.buffer.length).toBeGreaterThan(400_000)

  // Imagem na cena (botão da barra).
  await page.keyboard.type('Primeiro parágrafo.')
  await page.locator('input[aria-label="Imagem para a cena"]').setInputFiles(pic)
  const figure = page.getByRole('textbox', { name: 'Texto da cena' }).locator('figure.scene-figure img')
  await expect(figure).toHaveAttribute('src', /^blob:/)
  // Encolhida: o lado maior fica em 1600 px.
  expect(await figure.evaluate((img: HTMLImageElement) => Math.max(img.naturalWidth, img.naturalHeight))).toBe(1600)

  // Retrato numa ficha.
  await nav(page, 'Mundo').click()
  await page.getByRole('textbox', { name: 'Nome da nova ficha' }).fill('Mira')
  await page.getByRole('button', { name: 'Criar ficha' }).click()
  await page.locator('.portrait-edit input[type=file]').setInputFiles(await photo(page, '#c0577a', 1200, 1500))
  await expect(page.getByRole('button', { name: 'Trocar a imagem da ficha' }).locator('img')).toHaveAttribute('src', /^blob:/)
  await expect(page.locator('.entity-row-pic')).toBeVisible()
  await page.getByRole('group', { name: 'Modo da ficha' }).getByRole('button', { name: 'Ler' }).click()
  await expect(page.getByRole('img', { name: 'Imagem de Mira' })).toBeVisible()
  expect(await page.getByRole('img', { name: 'Imagem de Mira' }).evaluate((img: HTMLImageElement) => img.naturalHeight)).toBe(800)

  // Capa do universo, no Início.
  await nav(page, 'Início').click()
  await page.locator('.home-quick input[type=file]').setInputFiles(await photo(page, '#1d6b58'))
  await expect(page.locator('.home-hero.has-cover img.home-hero-cover')).toHaveAttribute('src', /^blob:/)

  // Tudo continua depois de recarregar (as imagens ficam neste navegador).
  await expect(page.getByRole('status').first()).toHaveText('Salvo')
  await page.reload()
  await expect(page.locator('.home-hero.has-cover img.home-hero-cover')).toHaveAttribute('src', /^blob:/)
  await page.getByRole('button', { name: 'Seus universos' }).click()
  await expect(page.locator('.hub-continue-cover')).toHaveAttribute('src', /^blob:/)
  await page.getByRole('button', { name: /Ilhas/ }).click()
  await nav(page, 'Escrever').click()
  await expect(page.getByRole('textbox', { name: 'Texto da cena' }).locator('figure.scene-figure img')).toHaveAttribute('src', /^blob:/)

  // O backup leva as imagens dentro; importado em outro navegador, tudo volta.
  await nav(page, 'Ajustes').click()
  await page.getByRole('navigation', { name: 'Categorias dos ajustes' }).getByRole('button', { name: 'Dados e backup' }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: /Baixar backup/ }).first().click()
  const file = await (await download).path()
  const json = JSON.parse(await readFile(file, 'utf8')) as { images?: Record<string, string>; universe: { settings: { cover: string } } }
  expect(Object.keys(json.images ?? {})).toHaveLength(3)
  expect(json.universe.settings.cover).toMatch(/^img:[0-9a-f]{32}$/)
  expect(json.images![json.universe.settings.cover.slice(4)]).toMatch(/^data:image\/(webp|jpeg);base64,/)

  const other = await page.context().browser()!.newContext()
  await other.addInitScript(() => localStorage.setItem('papirus:prefs', JSON.stringify({ tourDone: true })))
  const p2 = await other.newPage()
  await p2.goto('/app/')
  await p2.locator('input[type=file][accept*="json"]').first().setInputFiles(file)
  await expect(p2.locator('.home-hero.has-cover img.home-hero-cover')).toHaveAttribute('src', /^blob:/)
  await other.close()
})

test('imagens: o mapa novo vai para as imagens (o universo fica leve)', async ({ page }) => {
  await newUniverse(page, 'Mapas')
  await openPart(page, 'Atlas')
  await page.locator('.atlas-view input[type=file]').setInputFiles(await photo(page, '#4a5260', 3000, 2000))
  await expect(page.locator('.atlas-image')).toHaveAttribute('style', /blob:/)
  const stored = await page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!
      if (k.startsWith('papirus:emergency')) return localStorage.getItem(k)
    }
    return null
  })
  if (stored) expect(stored).not.toContain('data:image')
})

type Fake = ReturnType<typeof createFakeSupabase>

async function device(browser: Browser, fake: Fake): Promise<Page> {
  const context = await browser.newContext()
  await context.addInitScript(() => localStorage.setItem('papirus:prefs', JSON.stringify({ tourDone: true })))
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

test('imagens: com conta, sobem sozinhas e aparecem no outro aparelho', async ({ browser }) => {
  const fake = createFakeSupabase()
  const a = await device(browser, fake)
  await newUniverse(a, 'Nuvem')
  await signIn(a, PEOPLE.ana.email)
  await nav(a, 'Mundo').click()
  await a.getByRole('textbox', { name: 'Nome da nova ficha' }).fill('Kael')
  await a.getByRole('button', { name: 'Criar ficha' }).click()
  await a.locator('.portrait-edit input[type=file]').setInputFiles(await photo(a, '#7b5ea7', 900, 900))
  await expect.poll(() => fake.images.size, { timeout: 15_000 }).toBe(1)
  const [stored] = [...fake.images.values()]
  expect(stored.owner).toBe(PEOPLE.ana.id)
  expect(stored.body.length).toBeLessThan(200_000)

  // Ajustes mostra o uso da conta.
  await nav(a, 'Ajustes').click()
  await a.getByRole('navigation', { name: 'Categorias dos ajustes' }).getByRole('button', { name: 'Dados e backup' }).click()
  await expect(a.getByText(/Na conta: .* de 100 MB/)).toBeVisible()

  // Outro aparelho: entra, o universo chega e o retrato vem do servidor.
  const b = await device(browser, fake)
  await b.goto('/app/')
  await signIn(b, PEOPLE.ana.email)
  await b.getByRole('button', { name: /Nuvem/ }).click()
  await nav(b, 'Mundo').click()
  await b.locator('.entity-row-name', { hasText: /^Kael$/ }).click()
  // Noutro aparelho, a ficha abre para ler: o retrato fica no quadro de resumo.
  await expect(b.getByRole('img', { name: 'Imagem de Kael' })).toHaveAttribute('src', /^blob:/)
})

test('imagens: quem lê pelo link (sem conta) vê a imagem da cena, vinda do servidor', async ({ browser }) => {
  const fake = createFakeSupabase()
  const a = await device(browser, fake)
  await newUniverse(a, 'Visto')
  await a.keyboard.type('Uma ilha ao longe.')
  await a.locator('input[aria-label="Imagem para a cena"]').setInputFiles(await photo(a, '#a5762a', 1000, 700))
  await expect(a.getByRole('textbox', { name: 'Texto da cena' }).locator('figure.scene-figure img')).toHaveAttribute('src', /^blob:/)
  await expect(a.getByRole('status').first()).toHaveText('Salvo')
  await signIn(a, PEOPLE.ana.email)
  await expect.poll(() => fake.images.size, { timeout: 15_000 }).toBe(1)

  await a.getByRole('button', { name: 'Compartilhar', exact: true }).first().click()
  const share = a.getByRole('dialog', { name: 'Compartilhar' })
  await share.getByRole('button', { name: 'Começar a compartilhar' }).click()
  await share.getByRole('button', { name: 'Criar link de leitura' }).click()
  await share.getByRole('radio', { name: 'Universo inteiro' }).click()
  const link = await share.getByRole('textbox', { name: 'Link de leitura' }).inputValue()

  const reader = await device(browser, fake)
  await reader.goto(`/app/${new URL(link).search}`)
  await expect(reader.getByRole('status').filter({ hasText: 'pelo link' })).toBeVisible()
  await reader.getByRole('button', { name: 'Escrever' }).click()
  await expect(reader.getByRole('textbox', { name: 'Texto da cena' }).locator('figure.scene-figure img')).toHaveAttribute('src', /^blob:/)
})

test('imagens: a imagem da cena vai para o e-book como arquivo', async ({ page }) => {
  await newUniverse(page, 'Livro com figura')
  await page.keyboard.type('Antes da figura.')
  await page.locator('input[aria-label="Imagem para a cena"]').setInputFiles(await photo(page, '#8a2f3b', 900, 600))
  await expect(page.getByRole('textbox', { name: 'Texto da cena' }).locator('figure.scene-figure img')).toHaveAttribute('src', /^blob:/)
  await expect(page.getByRole('status').first()).toHaveText('Salvo')
  await nav(page, 'Ajustes').click()
  await page.getByRole('navigation', { name: 'Categorias dos ajustes' }).getByRole('button', { name: 'Livros' }).click()
  const epub = page.waitForEvent('download')
  await page.getByRole('button', { name: 'EPUB' }).click()
  const zip = unzipSync(new Uint8Array(await readFile(await (await epub).path())))
  const pics = Object.keys(zip).filter((k) => k.startsWith('OEBPS/imagens/cena-'))
  expect(pics).toHaveLength(1)
  const chapter = strFromU8(zip['OEBPS/cap-001.xhtml'])
  expect(chapter).toContain(`src="${pics[0].replace('OEBPS/', '')}"`)
  expect(strFromU8(zip['OEBPS/content.opf'])).toContain(pics[0].replace('OEBPS/', ''))
})

test('imagens: no Codex dos jogadores, a ficha revelada mostra o retrato (miniatura dentro do Codex)', async ({ page, context, baseURL }) => {
  const puts: unknown[] = []
  const store = new Map<string, { data: unknown; updated_at: string }>()
  await context.route(`${SERVER}/rest/v1/rpc/*`, async (route) => {
    const fn = route.request().url().split('/rpc/')[1].split('?')[0]
    const body = route.request().postDataJSON() as Record<string, string>
    const json = (data: unknown) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(data), headers: { 'access-control-allow-origin': '*' } })
    if (fn === 'codex_put') {
      const updated_at = new Date().toISOString()
      store.set(body.codex_id, { data: body.codex_data, updated_at })
      puts.push(body.codex_data)
      return json(updated_at)
    }
    const row = store.get(body.codex_id)
    return json(fn === 'codex_get' && row ? [row] : [])
  })
  await context.route(`${SERVER}/realtime/**`, (route) => route.abort())

  await page.goto('/app/?exemplo=ostria')
  await nav(page, 'Mundo').click()
  await page.locator('.entity-row-name', { hasText: /^Ostria$/ }).click()
  await page.locator('.portrait-edit input[type=file]').setInputFiles(await photo(page, '#2f6fae', 1200, 900))
  await expect(page.locator('.entity-row-pic')).toBeVisible()

  await nav(page, 'Ajustes').click()
  await page.getByRole('navigation', { name: 'Categorias dos ajustes' }).getByRole('button', { name: /Conta/ }).click()
  await page.getByRole('textbox', { name: 'Endereço do projeto' }).fill(SERVER)
  await page.getByRole('textbox', { name: 'Chave pública (anon key)' }).fill('eyJ.chave-de-teste')
  await page.getByRole('textbox', { name: 'Endereço público do Papirus' }).fill(baseURL + '/')
  await nav(page, 'RPG').click()
  await page.getByRole('tab', { name: 'Revelações e Codex' }).click()
  await page.getByRole('button', { name: 'Compartilhar ao vivo' }).click()
  const link = await page.getByRole('textbox', { name: 'Link para os jogadores' }).inputValue()
  await expect.poll(() => JSON.stringify(puts.at(-1) ?? '')).toContain('data:image/')

  const player = await context.newPage()
  await player.goto(link)
  const portrait = player.getByRole('img', { name: 'Retrato de Ostria' })
  await expect(portrait).toHaveAttribute('src', /^data:image\//)
  expect(await portrait.evaluate((img: HTMLImageElement) => Math.max(img.naturalWidth, img.naturalHeight))).toBe(256)
})
