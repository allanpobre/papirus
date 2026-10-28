import { expect, test, type Page } from './fixtures.ts'
import type { Browser } from '@playwright/test'
import { createFakeSupabase, PASSWORD, PEOPLE, SERVER } from './fakeSupabase.ts'

const words = (n: number) => Array.from({ length: n }, (_, i) => `palavra${i}`).join(' ')

test('treino de escrita: sprint com tempo e mínimo, resultado, histórico e refazer', async ({ page }) => {
  await page.clock.install()
  await page.goto('/app/')
  const card = page.getByRole('region', { name: 'Treino de hoje' })
  await card.getByRole('button', { name: 'Começar o treino' }).click()
  const treino = page.getByRole('dialog', { name: 'Treino de escrita' })
  await treino.getByRole('button', { name: /^Aquecimento/ }).click()
  await treino.getByRole('button', { name: /^Começar · 5 min · 100 palavras/ }).click()

  const area = treino.getByRole('textbox', { name: 'Texto do treino' })
  await area.fill(words(60))
  await expect(treino.getByText(/60\s+de 100 palavras/)).toBeVisible()
  await page.clock.runFor(60_000)
  await expect(treino.getByRole('timer')).toHaveText('4:00')
  await area.fill(words(120))
  await expect(treino.getByText('mínimo batido!', { exact: false })).toBeVisible()
  // Acabou o tempo: termina sozinho e mostra o resultado.
  await page.clock.runFor(4 * 60_000 + 500)
  await page.clock.resume()
  await expect(treino.getByText('Mínimo batido!')).toBeVisible()
  await expect(treino.getByRole('definition').first()).toHaveText('120')

  // Fica nos treinos, com o texto, e dá para refazer o mesmo desafio.
  await treino.getByRole('button', { name: 'Ver seus treinos' }).click()
  const historico = page.getByRole('dialog', { name: 'Seus treinos' })
  await expect(historico.getByRole('list', { name: 'Treinos feitos' }).getByRole('listitem')).toHaveCount(1)
  await expect(historico).toContainText('Só neste aparelho')
  await historico.getByRole('list', { name: 'Treinos feitos' }).getByRole('button').click()
  await expect(page.getByRole('dialog', { name: 'Treino' })).toContainText('palavra119')
  await page.getByRole('button', { name: 'Refazer este desafio' }).click()
  await expect(treino.getByText(/Seu recorde neste desafio: 120 palavras em 5 min/)).toBeVisible()

  // Em caracteres, com o meu mínimo; terminar antes do tempo também vale.
  await treino.getByRole('radio', { name: 'Caracteres' }).click()
  await treino.getByText('Do meu jeito').click()
  await treino.getByRole('textbox', { name: 'Mínimo de caracteres' }).fill('50')
  await treino.getByRole('button', { name: /^Começar/ }).click()
  await treino.getByRole('textbox', { name: 'Texto do treino' }).fill('Curto demais.')
  await treino.getByRole('button', { name: 'Terminar' }).click()
  await expect(treino.getByText('Faltaram 37 caracteres')).toBeVisible()
  await treino.getByRole('button', { name: 'Ver seus treinos' }).click()
  await expect(page.getByRole('dialog', { name: 'Seus treinos' }).getByRole('list', { name: 'Treinos feitos' }).getByRole('listitem')).toHaveCount(2)
  await page.getByRole('dialog', { name: 'Seus treinos' }).getByRole('button', { name: 'Fechar' }).click()

  // O cartão de hoje conta o feito, e o treino continua depois de recarregar.
  await expect(card).toContainText('Feito hoje: 120 palavras em 5 min')
  await page.reload()
  await expect(page.getByRole('region', { name: 'Treino de hoje' })).toContainText('Feito hoje')
})

test('treino em andamento sobrevive ao app fechar, e no universo o texto vira cena', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await page.getByRole('region', { name: 'Treino de hoje' }).getByRole('button', { name: 'Começar o treino' }).click()
  const treino = page.getByRole('dialog', { name: 'Treino de escrita' })
  await treino.getByRole('button', { name: /^Começar/ }).click()
  await treino.getByRole('textbox', { name: 'Texto do treino' }).fill('Primeira linha do treino.\nSegunda linha.')
  await page.reload()
  await page.getByRole('region', { name: 'Treino de hoje' }).getByRole('button', { name: 'Continuar o treino' }).click()
  await expect(treino.getByRole('textbox', { name: 'Texto do treino' })).toHaveValue('Primeira linha do treino.\nSegunda linha.')
  await expect(treino.getByText('Relógio parado.', { exact: false })).toBeVisible()
  await treino.getByRole('button', { name: 'Terminar' }).click()
  await treino.getByRole('button', { name: 'Guardar como cena' }).click()
  await expect(treino.getByRole('button', { name: 'Virou uma cena' })).toBeDisabled()
  await page.keyboard.press('Escape')
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Escrever/ }).click()
  await expect(page.getByText(/^Treino: /).first()).toBeVisible()
})

async function device(browser: Browser, fake: ReturnType<typeof createFakeSupabase>): Promise<Page> {
  const context = await browser.newContext()
  await context.addInitScript(() => localStorage.setItem('papirus:prefs', JSON.stringify({ tourDone: true })))
  await fake.attach(context)
  return context.newPage()
}

async function signIn(page: Page, email: string) {
  await page.getByRole('button', { name: 'Entrar', exact: true }).first().click()
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

test('treinos vão para a nuvem e aparecem no outro aparelho; apagar some dos dois', async ({ browser }) => {
  const fake = createFakeSupabase()
  const a = await device(browser, fake)
  await a.goto('/app/')
  await signIn(a, PEOPLE.ana.email)
  await a.getByRole('region', { name: 'Treino de hoje' }).getByRole('button', { name: 'Começar o treino' }).click()
  const treino = a.getByRole('dialog', { name: 'Treino de escrita' })
  await treino.getByRole('button', { name: /^Começar/ }).click()
  await treino.getByRole('textbox', { name: 'Texto do treino' }).fill(words(40))
  await treino.getByRole('button', { name: 'Terminar' }).click()
  await expect.poll(() => fake.tables.papirus_treinos.length).toBe(1)
  expect(fake.tables.papirus_treinos[0]).toMatchObject({ user_id: PEOPLE.ana.id, words: 40, unit: 'palavras' })

  const b = await device(browser, fake)
  await b.goto('/app/')
  await signIn(b, PEOPLE.ana.email)
  await b.getByRole('region', { name: 'Treino de hoje' }).getByRole('button', { name: /Seus treinos/ }).click()
  const hist = b.getByRole('dialog', { name: 'Seus treinos' })
  await expect(hist.getByRole('list', { name: 'Treinos feitos' }).getByRole('listitem')).toHaveCount(1)
  await expect(hist).toContainText('Guardados na sua conta.')
  await hist.getByRole('list', { name: 'Treinos feitos' }).getByRole('button').click()
  await b.getByRole('button', { name: 'Apagar' }).click()
  await b.getByRole('button', { name: 'Apagar', exact: true }).last().click()
  await expect.poll(() => fake.tables.papirus_treinos.length).toBe(0)

  // Outra pessoa não vê os treinos de ninguém.
  const c = await device(browser, fake)
  await c.goto('/app/')
  await signIn(c, PEOPLE.bia.email)
  await c.getByRole('region', { name: 'Treino de hoje' }).getByRole('button', { name: /Seus treinos/ }).click()
  await expect(c.getByRole('dialog', { name: 'Seus treinos' })).toContainText('Nenhum treino ainda')
})
