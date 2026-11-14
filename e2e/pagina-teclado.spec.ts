import { expect, test, type Page } from './fixtures.ts'

/*
 * Escrever no celular com o teclado aberto: o texto precisa de espaço. Enquanto se digita na Página, a linha dos
 * modos (Estrutura · Página · Revisão) some e a barra acima do teclado fica; ao fechar o teclado, a linha volta.
 * O teclado é simulado: no Android a área visível (visualViewport) encolhe e a janela não.
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

const TECLADO = 300

async function prepararTecladoDeMentira(page: Page) {
  await page.addInitScript((kb) => {
    const ouvintes = new Set<() => void>()
    const falso = { height: innerHeight, width: innerWidth, offsetTop: 0, offsetLeft: 0, scale: 1, addEventListener: (_: string, f: () => void) => ouvintes.add(f), removeEventListener: (_: string, f: () => void) => ouvintes.delete(f) }
    Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => falso })
    ;(window as unknown as { __teclado: (aberto: boolean) => void }).__teclado = (aberto) => {
      falso.height = aberto ? innerHeight - kb : innerHeight
      ouvintes.forEach((f) => f())
    }
  }, TECLADO)
}

/** Quantas linhas inteiras do texto aparecem acima da barra do teclado. */
const linhasVisiveis = (page: Page) =>
  page.evaluate(() => {
    const vv = window.visualViewport!.height
    const barra = document.querySelector('[role=toolbar][aria-label="Formatação"]')
    const limite = Math.min(vv, barra ? barra.getBoundingClientRect().top : vv)
    const linhas = new Map<number, DOMRect>()
    const walker = document.createTreeWalker(document.querySelector('.ProseMirror')!, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const r = document.createRange()
      r.selectNodeContents(n)
      for (const c of r.getClientRects()) linhas.set(Math.round(c.top), c)
    }
    return [...linhas.values()].filter((c) => c.top >= 0 && c.bottom <= limite).length
  })

test('Página com o teclado aberto: a linha dos modos some, o texto ganha espaço e dá para voltar', async ({ page }) => {
  await prepararTecladoDeMentira(page)
  await page.addInitScript(() => localStorage.setItem('papirus:escrita-modo', 'pagina'))
  await page.goto('/app/?exemplo')
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Escrever/ }).click()
  const barraDoAlto = page.locator('.write-bar')
  await expect(barraDoAlto).toBeVisible()

  // Teclado fechado: a linha dos modos está lá.
  await page.getByRole('textbox', { name: 'Texto da cena' }).click()
  await expect(barraDoAlto).toBeVisible()

  // Teclado aberto: some a linha dos modos; a barra de formatação (acima do teclado) fica.
  await page.evaluate(() => (window as unknown as { __teclado: (a: boolean) => void }).__teclado(true))
  await expect(barraDoAlto).toBeHidden()
  await expect(page.getByRole('toolbar', { name: 'Formatação' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Fechar o teclado' })).toBeVisible()
  // Antes eram 13 linhas inteiras (com a linha dos modos); agora cabem pelo menos 14.
  expect(await linhasVisiveis(page), 'linhas do texto à vista com o teclado aberto').toBeGreaterThanOrEqual(14)

  // Fechar o teclado (o sistema encolhe o teclado e o foco sai do texto): a linha dos modos volta e dá para trocar de modo.
  await page.getByRole('button', { name: 'Fechar o teclado' }).click()
  await page.evaluate(() => (window as unknown as { __teclado: (a: boolean) => void }).__teclado(false))
  await expect(barraDoAlto).toBeVisible()
  await page.getByRole('navigation', { name: 'Momento da escrita' }).getByRole('button', { name: 'Revisão' }).click()
  await expect(page.locator('.view.write.is-revisao')).toBeVisible()
})

test('na Revisão, com o teclado aberto, a linha dos modos continua (só a Página a esconde)', async ({ page }) => {
  await prepararTecladoDeMentira(page)
  await page.addInitScript(() => localStorage.setItem('papirus:escrita-modo', 'revisao'))
  await page.goto('/app/?exemplo')
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Escrever/ }).click()
  await page.evaluate(() => (window as unknown as { __teclado: (a: boolean) => void }).__teclado(true))
  await expect(page.locator('.write-bar')).toBeVisible()
})
