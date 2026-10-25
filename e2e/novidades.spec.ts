import { readFile } from 'node:fs/promises'
import type { Browser } from '@playwright/test'
import { createFakeSupabase, PASSWORD, PEOPLE, SERVER } from './fakeSupabase.ts'
import { expect, test, type Page } from './fixtures.ts'

const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: new RegExp(`^${name}`) }).first()

test('arco na história: onde o boticário aparece e quando muda de lado', async ({ page }) => {
  await page.goto('/app/?exemplo')
  await nav(page, 'Fichas').click()
  await page.getByRole('button', { name: /^Crispim Soares/ }).click()
  const strip = page.getByRole('list', { name: 'Onde Crispim Soares aparece, cena a cena' })
  await expect(strip.getByRole('listitem')).toHaveCount(13)
  await expect(strip.getByRole('listitem').first()).toHaveAccessibleName(/^1\. De como Itaguaí ganhou uma casa de orates: presente/)
  await page.getByRole('button', { name: /Ver o arco inteiro/ }).click()
  await expect(page.locator('.arc-steps')).toContainText('Começa: Crispim Soares adere a Porfírio')
  await expect(page.locator('.arc-steps')).toContainText('O leitor descobre: Na revolta, finge-se doente')
})

test('wiki do mundo: só até uma cena, sem spoiler', async ({ page }) => {
  await page.goto('/app/?exemplo')
  await nav(page, 'Ajustes e dados').click()
  await page.getByRole('navigation', { name: 'Categorias dos ajustes' }).getByRole('button', { name: 'Livros e wiki' }).click()
  await page.getByRole('combobox', { name: 'O que entra' }).selectOption({ label: 'Só o que o leitor sabe até “De como Itaguaí ganhou uma casa de orates” (1)' })
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Baixar a wiki (.html)' }).click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/wiki\.html$/)
  const html = await readFile((await file.path())!, 'utf8')
  expect(html).toContain('<h2>Simão Bacamarte</h2>')
  expect(html).not.toContain('<h2>Porfírio</h2>')
  expect(html).not.toContain('Machado deixa no ar')
})

test('aparência: cor rosa, fonte de máquina e modo máquina de escrever', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await nav(page, 'Ajustes e dados').click()
  await page.getByRole('radio', { name: 'Rosa' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'rosa')
  await page.getByRole('combobox', { name: 'Fonte do texto' }).selectOption('maquina')
  await page.getByRole('navigation', { name: 'Categorias dos ajustes' }).getByRole('button', { name: 'Escrita' }).click()
  await page.getByText('Modo máquina de escrever: a linha em que você escreve fica no meio da tela').click()
  await page.getByText('Destacar só o parágrafo atual').click()
  await page.getByRole('combobox', { name: 'Som ao digitar' }).selectOption('maquina')
  await nav(page, 'Escrever').click()
  const article = page.locator('article.page')
  await expect(article).toHaveClass(/font-maquina/)
  await expect(article).toHaveClass(/typewriter/)
  await expect(article).toHaveClass(/focus-paragraph/)
  await page.getByRole('textbox', { name: 'Texto da cena' }).click()
  await expect(page.locator('.scene-text .is-current')).toHaveCount(1)
})

async function person(browser: Browser, fake: ReturnType<typeof createFakeSupabase>) {
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
  return page.getByRole('dialog', { name: 'Sua conta' })
}

test('desafio de escrita: Ana cria, escreve, e a amiga entra e vê o placar', async ({ browser }) => {
  test.setTimeout(120_000)
  const fake = createFakeSupabase()
  fake.tables.papirus_profiles.push(
    { user_id: PEOPLE.ana.id, handle: 'ana', name: 'Ana', bio: '', avatar: null },
    { user_id: PEOPLE.bia.id, handle: 'bia', name: 'Bia', bio: '', avatar: null },
  )
  fake.tables.papirus_friendships.push({ requester: PEOPLE.bia.id, addressee: PEOPLE.ana.id, status: 'aceita', created_at: new Date().toISOString() })

  // Ana escreve num universo e cria o desafio.
  const ana = await person(browser, fake)
  await ana.goto('/app/')
  await ana.getByRole('textbox', { name: 'Nome do novo universo' }).fill('Rascunho')
  await ana.getByRole('button', { name: 'Criar universo' }).click()
  await ana.getByRole('button', { name: 'Começar a escrever' }).click()
  await ana.getByRole('textbox', { name: 'Texto da cena' }).click()
  await ana.keyboard.type('Era uma vez uma vila onde todos escreviam um pouco todos os dias, e ninguém sabia por quê.')
  await expect(ana.getByRole('status').first()).toHaveText('Salvo')
  await ana.waitForTimeout(1800)
  const hub = await signIn(ana, 'ana@exemplo.com')
  await hub.getByRole('tab', { name: 'Desafios' }).click()
  await expect(hub).toContainText(/Hoje você escreveu \d+ palavras/)
  await hub.getByRole('button', { name: 'Novo desafio' }).click()
  await hub.getByRole('textbox', { name: 'Nome do desafio' }).fill('Semana de fogo')
  await hub.getByRole('spinbutton', { name: 'Meta por dia (palavras)' }).fill('50')
  await hub.getByRole('button', { name: 'Criar desafio' }).click()
  const board = hub.getByRole('region', { name: 'Desafio Semana de fogo' })
  await expect(board).toContainText('dia 1 de 7')
  await expect.poll(() => fake.tables.papirus_challenge_days.map((d) => Number(d.words) > 0)).toEqual([true])
  await hub.getByRole('button', { name: 'Fechar' }).click()

  // Bia vê o desafio da amiga, entra e vê o placar.
  const bia = await person(browser, fake)
  await bia.goto('/app/')
  const biaHub = await signIn(bia, 'bia@exemplo.com')
  await biaHub.getByRole('tab', { name: 'Desafios' }).click()
  await expect(biaHub.getByRole('region', { name: 'Desafios de amigos' })).toContainText('Semana de fogo')
  await biaHub.getByRole('button', { name: 'Entrar', exact: true }).click()
  const biaBoard = biaHub.getByRole('region', { name: 'Desafio Semana de fogo' })
  await expect(biaBoard).toContainText('Ana')
  await expect(biaBoard).toContainText('Você')
  await expect(biaBoard.getByRole('listitem').first()).toContainText('Ana')
})

test('som ao digitar: toca em letras, espaço e Enter (pelo texto que entra, como no teclado do celular)', async ({ page }) => {
  // Troca o áudio do navegador por um contador de sons.
  await page.addInitScript(() => {
    const w = window as unknown as { sons: string[]; AudioContext: unknown }
    w.sons = []
    class FakeParam {
      value = 0
      setValueAtTime() {}
      exponentialRampToValueAtTime() {}
    }
    class FakeNode {
      connect(n: unknown) {
        return n
      }
    }
    class FakeSource extends FakeNode {
      buffer: unknown = null
      playbackRate = new FakeParam()
      start() {
        w.sons.push('clique')
      }
      stop() {}
    }
    class FakeOsc extends FakeNode {
      type = ''
      frequency = new FakeParam()
      start() {
        w.sons.push('sino')
      }
      stop() {}
    }
    w.AudioContext = class {
      state = 'suspended'
      sampleRate = 8000
      currentTime = 0
      destination = {}
      resume() {
        this.state = 'running'
        return Promise.resolve()
      }
      createBuffer(_c: number, n: number) {
        return { getChannelData: () => new Float32Array(n) }
      }
      createBufferSource() {
        return new FakeSource()
      }
      createOscillator() {
        return new FakeOsc()
      }
      createBiquadFilter() {
        return Object.assign(new FakeNode(), { type: '', frequency: new FakeParam(), Q: new FakeParam() })
      }
      createGain() {
        return Object.assign(new FakeNode(), { gain: new FakeParam() })
      }
    }
  })
  await page.goto('/app/?exemplo=ostria')
  await nav(page, 'Ajustes e dados').click()
  await page.getByRole('navigation', { name: 'Categorias dos ajustes' }).getByRole('button', { name: 'Escrita' }).click()
  await page.getByRole('combobox', { name: 'Som ao digitar' }).selectOption('maquina')
  // Escolher já toca uma amostra.
  await expect.poll(() => page.evaluate(() => (window as unknown as { sons: string[] }).sons.length)).toBeGreaterThan(0)
  await page.evaluate(() => ((window as unknown as { sons: string[] }).sons = []))
  await nav(page, 'Escrever').click()
  await page.getByRole('textbox', { name: 'Texto da cena' }).click()
  await page.keyboard.press('End')
  await page.keyboard.type('Oi a')
  await page.keyboard.press('Enter')
  const sons = await page.evaluate(() => (window as unknown as { sons: string[] }).sons)
  expect(sons.filter((s) => s === 'clique').length).toBeGreaterThanOrEqual(10)
  expect(sons).toContain('sino')
})
