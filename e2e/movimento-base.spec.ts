import { expect, test, type Page } from './fixtures.ts'

// Auditoria 24, pacote 2: o movimento de base. O fundo da aba ativa desliza, as trocas de cor têm transição curta,
// o tema muda com um fade, o toque dá resposta, e tudo isso some para quem pede menos movimento.
const slideOf = (page: Page, sel: string) =>
  page.locator(sel).evaluate((box) => {
    const el = box as HTMLElement
    const on = el.querySelector<HTMLElement>('[aria-current="page"], [aria-selected="true"]')!
    return { ready: 'slideReady' in el.dataset, on: el.dataset.slide, x: el.style.getPropertyValue('--slide-x'), left: on.offsetLeft, w: el.style.getPropertyValue('--slide-w'), ow: on.offsetWidth }
  })

test('o fundo da parte aberta acompanha a parte (Fichas · Ligações · Mapas)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/app/?exemplo=ostria')
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Mundo', exact: true }).click()
  const partes = '[data-tour="partes"]'
  const a = await slideOf(page, partes)
  expect(a.on).toBe('on')
  expect(a.x).toBe(`${a.left}px`)
  expect(a.w).toBe(`${a.ow}px`)
  await page.locator(partes).getByRole('button', { name: 'Mapas' }).click()
  await expect.poll(async () => (await slideOf(page, partes)).x).not.toBe(a.x)
  const b = await slideOf(page, partes)
  expect(b.x).toBe(`${b.left}px`)
  // Depois do primeiro desenho, as trocas passam a animar.
  expect(b.ready).toBe(true)
  // O botão ativo fica sem fundo próprio (quem desenha é o deslizante).
  const mapas = page.locator(partes).getByRole('button', { name: 'Mapas' })
  await expect.poll(() => mapas.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)')
})

test('Estrutura · Página · Revisão e a barra de baixo do celular também deslizam', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/app/?exemplo=ostria')
  const modos = '[data-tour="modos"]'
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Escrever' }).click()
  const m = await slideOf(page, modos)
  expect(m.on).toBe('on')
  expect(m.x).toBe(`${m.left}px`)
  const barra = '[data-tour="menu"]'
  const r1 = await slideOf(page, barra)
  expect(r1.on).toBe('on')
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Trama' }).click()
  await expect.poll(async () => (await slideOf(page, barra)).x).not.toBe(r1.x)
})

test('botões e abas trocam de cor com transição e afundam ao toque', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  const botao = page.getByRole('button', { name: 'Ler como livro' })
  await expect(botao).toBeVisible()
  const t = await botao.evaluate((el) => getComputedStyle(el).transitionProperty)
  expect(t).toContain('background-color')
  expect(t).toContain('transform')
  const ms = await botao.evaluate((el) => getComputedStyle(el).transitionDuration)
  expect(ms).toMatch(/^0\.12s(, 0\.12s)*$/)
})

test('trocar o tema faz um fade curto, e na abertura não', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/app/?exemplo=ostria')
  const html = page.locator('html')
  await expect(html).not.toHaveClass(/theme-fade/)
  await page.getByRole('button', { name: /Usar tema (claro|escuro)/ }).click()
  await expect(html).toHaveClass(/theme-fade/)
  await expect(html).not.toHaveClass(/theme-fade/, { timeout: 2000 })
})

test.describe('com “menos movimento”', () => {
  test.use({ reducedMotion: 'reduce' })
  test('sem transição, sem afundar e sem fade de tema', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/app/?exemplo=ostria')
    const botao = page.getByRole('button', { name: 'Ler como livro' })
    await expect(botao).toBeVisible()
    const ms = await botao.evaluate((el) => getComputedStyle(el).transitionDuration)
    expect(ms).toMatch(/^0s(, 0s)*$/)
    await page.getByRole('button', { name: /Usar tema (claro|escuro)/ }).click()
    await page.waitForTimeout(100)
    await expect(page.locator('html')).not.toHaveClass(/theme-fade/)
  })
})
