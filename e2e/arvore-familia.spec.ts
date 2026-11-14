import { expect, test } from './fixtures.ts'
import { openPart } from './areas.ts'

const transform = (page: import('@playwright/test').Page) => page.locator('.family > g').getAttribute('transform')
const scaleOf = (t: string | null) => Number(t?.match(/scale\(([\d.]+)\)/)?.[1])
const shiftOf = (t: string | null) => {
  const m = t?.match(/translate\(([-\d.]+) ([-\d.]+)\)/)
  return { x: Number(m?.[1]), y: Number(m?.[2]) }
}

async function openTree(page: import('@playwright/test').Page, example = '?exemplo') {
  await page.goto(`/app/${example}`)
  await openPart(page, 'Ligações')
  await page.locator('.graph .node').first().waitFor()
  await page.getByRole('radio', { name: 'Árvore da família' }).click()
  await expect(page.locator('.family')).toBeVisible()
}

test.describe('Árvore da família no celular', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('abre com letra legível, a página não ganha rolagem de lado, e dá para ver todos com Enquadrar', async ({ page }) => {
    await openTree(page)
    // 4 pessoas lado a lado: mais largo que a tela. Abre no tamanho de ler, não encolhido até não dar para ler.
    const k = scaleOf(await transform(page))
    expect(k).toBeGreaterThanOrEqual(0.9)
    const fontPx = await page.locator('.family-name').first().evaluate((el, scale) => parseFloat(getComputedStyle(el).fontSize) * scale, k)
    expect(fontPx).toBeGreaterThanOrEqual(11)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    // A área cabe na tela.
    const box = (await page.locator('.family-stage').boundingBox())!
    expect(box.x + box.width).toBeLessThanOrEqual(390)

    // Enquadrar: todas as pessoas dentro da área.
    await page.getByRole('button', { name: 'Enquadrar' }).click()
    const stage = (await page.locator('.family-stage').boundingBox())!
    for (const n of await page.locator('.family-node').all()) {
      const r = (await n.boundingBox())!
      expect(r.x).toBeGreaterThanOrEqual(stage.x - 1)
      expect(r.x + r.width).toBeLessThanOrEqual(stage.x + stage.width + 1)
    }
    expect(scaleOf(await transform(page))).toBeLessThan(k)
  })

  test('um dedo move, dois dedos aproximam, e a página não rola', async ({ page }) => {
    await openTree(page)
    const box = (await page.locator('.family-stage').boundingBox())!
    const cdp = await page.context().newCDPSession(page)
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', pts: [number, number][]) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) })
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    const before = shiftOf(await transform(page))
    const scroll0: number = await page.evaluate(() => window.scrollY)

    // Arrasta para a esquerda: o desenho anda.
    await touch('touchStart', [[cx + 100, cy]])
    for (let i = 1; i <= 8; i++) await touch('touchMove', [[cx + 100 - i * 20, cy + i]])
    await touch('touchEnd', [])
    const moved = shiftOf(await transform(page))
    expect(moved.x).toBeLessThan(before.x - 100)
    expect(await page.evaluate(() => window.scrollY)).toBe(scroll0)

    // Pinça: afasta os dois dedos, aproxima.
    const k0 = scaleOf(await transform(page))
    await touch('touchStart', [[cx - 40, cy], [cx + 40, cy]])
    for (let i = 1; i <= 6; i++) await touch('touchMove', [[cx - 40 - i * 15, cy], [cx + 40 + i * 15, cy]])
    await touch('touchEnd', [])
    const k1 = scaleOf(await transform(page))
    expect(k1).toBeGreaterThan(k0 * 1.5)
    expect(await transform(page)).not.toMatch(/NaN|Infinity/)
  })

  test('arrastar começando numa pessoa move o desenho e não abre a ficha; tocar abre', async ({ page }) => {
    await openTree(page)
    const person = page.locator('.family-node').first()
    const r = (await person.boundingBox())!
    const x = r.x + r.width / 2
    const y = r.y + r.height / 2
    const cdp = await page.context().newCDPSession(page)
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', pts: [number, number][]) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([px, py], id) => ({ x: px, y: py, id })) })
    const before = shiftOf(await transform(page))
    await touch('touchStart', [[x, y]])
    for (let i = 1; i <= 6; i++) await touch('touchMove', [[x - i * 12, y]])
    await touch('touchEnd', [])
    expect(shiftOf(await transform(page)).x).toBeLessThan(before.x - 40)
    // Nenhuma janela de ficha abriu.
    await expect(page.getByRole('dialog')).toHaveCount(0)

    // Um toque parado numa pessoa à vista abre a ficha dela (um instante depois do arrasto, como uma pessoa faria).
    await page.waitForTimeout(300)
    const r2 = (await page.locator('.family-node').nth(1).boundingBox())!
    await touch('touchStart', [[r2.x + r2.width / 2, r2.y + r2.height / 2]])
    await touch('touchEnd', [])
    await expect(page.getByRole('dialog')).toBeVisible()
  })

  test('com o teclado, a pessoa que ganha o foco aparece na área', async ({ page }) => {
    await openTree(page)
    const nodes = page.locator('.family-node')
    const last = nodes.last()
    await last.focus()
    const stage = (await page.locator('.family-stage').boundingBox())!
    const r = (await last.boundingBox())!
    expect(r.x).toBeGreaterThanOrEqual(stage.x - 1)
    expect(r.x + r.width).toBeLessThanOrEqual(stage.x + stage.width + 1)
  })
})

test('no computador, a roda do mouse aproxima e a árvore cabe inteira', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await openTree(page, '?exemplo=alienista')
  expect(scaleOf(await transform(page))).toBe(1)
  const box = (await page.locator('.family-stage').boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.wheel(0, -300)
  await expect.poll(async () => scaleOf(await transform(page))).toBeGreaterThan(1.05)
})
