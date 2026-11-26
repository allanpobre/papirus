import { expect, test, type Page } from './fixtures.ts'

// Pacote B (personas, acessibilidade), na Nova cara: contraste medido, letra que se lê, letra do app que cresce,
// zoom grande sem rolar para o lado, nada só por cor e os nomes dos botões do leitor.
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem('papirus:cara-antiga', '0'))
})

/** O pior contraste (WCAG) entre os textos secundários à vista e o fundo de verdade atrás deles. */
const piorContraste = (page: Page) =>
  page.evaluate(() => {
    const lum = (c: string) => {
      const [r, g, b] = c.match(/\d+(\.\d+)?/g)!.slice(0, 3).map(Number).map((v) => {
        v /= 255
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const ratio = (a: string, b: string) => {
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
      return (x + 0.05) / (y + 0.05)
    }
    const bgOf = (el: Element | null): string => {
      for (let e = el; e; e = e.parentElement) {
        const c = getComputedStyle(e).backgroundColor
        if (c && !/rgba\(.*, 0\)$/.test(c) && c !== 'transparent') return c
      }
      return getComputedStyle(document.body).backgroundColor
    }
    let pior = { r: 99, txt: '' }
    for (const el of document.querySelectorAll('.muted, .tiny, .small, .eyebrow, .entity-row-kind, .section-label, .field-label')) {
      if (!el.textContent?.trim() || !el.getClientRects().length) continue
      const r = ratio(getComputedStyle(el).color, bgOf(el))
      if (r < pior.r) pior = { r, txt: el.textContent.trim().slice(0, 30) }
    }
    return pior
  })

test.describe('no computador', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  for (const tema of ['claro', 'escuro'] as const) {
    test(`texto secundário com contraste de pelo menos 4,5:1 (tema ${tema})`, async ({ page, context }) => {
      await context.addInitScript((t) => {
        const prefs = JSON.parse(localStorage.getItem('papirus:prefs') ?? '{}')
        localStorage.setItem('papirus:prefs', JSON.stringify({ ...prefs, theme: t }))
      }, tema)
      await page.goto('/app/?exemplo=ostria')
      for (const area of ['Início', 'Mundo', 'História']) {
        await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: area, exact: true }).first().click()
        await page.waitForTimeout(300)
        const pior = await piorContraste(page)
        expect(pior.r, `${area}: “${pior.txt}”`).toBeGreaterThanOrEqual(4.5)
      }
    })
  }

  test('a lista de fichas e as dicas com pelo menos 13 px', async ({ page }) => {
    await page.goto('/app/?exemplo=ostria')
    await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Mundo', exact: true }).click()
    await page.locator('[data-tour="partes"]').getByRole('button', { name: 'Fichas' }).click()
    const tamanho = (sel: string) => page.locator(sel).first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
    expect(await tamanho('.entity-row-summary')).toBeGreaterThanOrEqual(13)
    expect(await tamanho('.entity-row-kindtext, .entity-row-kind')).toBeGreaterThanOrEqual(13)
  })

  test('com zoom de 200% (a tela fica com 640 px), nada rola para o lado', async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 400 })
    await page.goto('/app/?exemplo=ostria')
    for (const area of ['Mundo', 'História', 'Escrever']) {
      await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: area, exact: true }).first().click()
      await page.waitForTimeout(300)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), area).toBe(true)
    }
  })

  test('“pior” e “igual” na faixa da Estrutura têm textura, não só cor', async ({ page }) => {
    await page.goto('/app/?exemplo')
    await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Escrever', exact: true }).click()
    await page.getByRole('navigation', { name: 'Momento da escrita' }).getByRole('button', { name: /Estrutura/ }).click()
    await expect(page.locator('.map-legend').first()).toBeVisible()
    const textura = (sel: string) => page.locator(sel).first().evaluate((el) => getComputedStyle(el).backgroundImage)
    expect(await textura('.map-legend i.shift-pior')).toContain('repeating-linear-gradient')
    expect(await textura('.map-legend i.shift-igual')).toContain('radial-gradient')
    expect(await textura('.map-legend i.shift-melhor')).toBe('none')
  })
})

test.describe('no celular', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('“Tamanho da letra do app” em Maior: tudo cresce e nada rola para o lado', async ({ page }) => {
    await page.goto('/app/?exemplo=ostria')
    const nav = page.getByRole('navigation', { name: 'Áreas' })
    await nav.getByRole('button', { name: 'Menu', exact: true }).click()
    await page.getByRole('group', { name: 'Todas as áreas' }).getByRole('button', { name: /Ajustes/ }).click()
    await page.getByRole('navigation', { name: 'Categorias dos ajustes' }).getByRole('button', { name: /^Aparência/ }).click()
    await page.getByRole('combobox', { name: 'Tamanho da letra do app' }).selectOption('maior')
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('20px')
    for (const area of ['Mundo', 'História', 'Escrever']) {
      await nav.getByRole('button', { name: area, exact: true }).click()
      await page.waitForTimeout(300)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), area).toBe(true)
    }
    await page.reload()
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('20px')
  })

  test('no leitor, os botões do alto têm o nome à vista', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Ou só ler o livro' }).click()
    const leitor = page.getByRole('dialog', { name: 'Modo leitor' })
    for (const nome of ['Ouvir', 'Como ler', 'Caderno']) await expect(leitor.locator('.leitor-btn-label', { hasText: nome })).toBeVisible()
  })
})
