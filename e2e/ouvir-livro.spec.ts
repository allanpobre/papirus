import { expect, test, type Page } from './fixtures.ts'

/*
 * Ouvir o livro com um livro escolhido, no celular: começa no livro certo, passa de cena sozinho, para no fim
 * do livro (sem entrar no próximo) e lembra o parágrafo onde parou.
 */
test.use({ viewport: { width: 390, height: 844 } })

/** O navegador de teste não fala: uma voz de mentira guarda o que seria lido. `auto`: cada fala acaba sozinha. */
async function fakeVoice(page: Page, auto: boolean) {
  await page.addInitScript((automatic) => {
    const w = window as unknown as { falas: string[]; proxima: () => void }
    w.falas = []
    let pending: (() => void) | undefined
    w.proxima = () => pending?.()
    const synth = {
      cancel() {},
      pause() {},
      resume() {},
      getVoices: () => [{ lang: 'pt-BR', name: 'teste' }],
      speak(u: { text: string; onend?: () => void }) {
        w.falas.push(u.text)
        pending = () => u.onend?.()
        if (automatic) setTimeout(() => u.onend?.(), 5)
      },
    }
    Object.defineProperty(window, 'speechSynthesis', { value: synth })
    ;(window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = function (this: { text: string }, t: string) {
      this.text = t
    }
  }, auto)
}

const falas = (page: Page) => page.evaluate(() => (window as unknown as { falas: string[] }).falas)

async function escolherLivro(page: Page, nome: RegExp) {
  const select = page.getByLabel('Livro', { exact: true })
  await select.selectOption((await select.locator('option', { hasText: nome }).first().getAttribute('value'))!)
}

test('com um livro escolhido: começa nele, passa de cena e para no fim dele', async ({ page }) => {
  await fakeVoice(page, true)
  await page.goto('/app/?exemplo')
  await escolherLivro(page, /^Ozma de Oz/)
  await page.getByRole('button', { name: 'Ler como livro' }).first().click()
  const leitor = page.getByRole('dialog', { name: 'Modo leitor' })
  const cena = leitor.locator('#leitor-cena')
  const inicio = Number(await cena.inputValue())
  await leitor.getByRole('button', { name: 'Ouvir' }).click()
  // Passa de cena sozinho e, no fim do livro, para (a barra da voz some).
  await expect(leitor.getByRole('group', { name: 'Leitura em voz alta' })).toHaveCount(0, { timeout: 30_000 })
  const fim = Number(await cena.inputValue())
  expect(fim).toBeGreaterThan(inicio)
  // Há cenas depois (de outro livro, a Zixi): a voz não entrou nelas.
  expect(await cena.locator('option').count()).toBeGreaterThan(fim + 1)
  expect((await falas(page)).length).toBeGreaterThan(5)
})

test('lembra o parágrafo onde a voz parou, depois de fechar', async ({ page }) => {
  await fakeVoice(page, false)
  await page.goto('/app/?exemplo')
  await escolherLivro(page, /^Ozma de Oz/)
  await page.getByRole('button', { name: 'Ler como livro' }).first().click()
  const leitor = page.getByRole('dialog', { name: 'Modo leitor' })
  await leitor.getByRole('button', { name: 'Ouvir' }).click()
  for (let i = 0; i < 3; i++) await page.evaluate(() => (window as unknown as { proxima: () => void }).proxima())
  const lidas = await falas(page)
  expect(lidas).toHaveLength(4)
  await leitor.getByRole('button', { name: 'Parar de ouvir' }).click()

  await page.reload()
  await page.getByRole('button', { name: 'Ler como livro' }).first().click()
  await page.getByRole('dialog', { name: 'Modo leitor' }).getByRole('button', { name: 'Ouvir' }).click()
  // Volta do parágrafo em que parou (o quarto), não do começo.
  await expect.poll(async () => (await falas(page))[0]).toBe(lidas[3])
})
