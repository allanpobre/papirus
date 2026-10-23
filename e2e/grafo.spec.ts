import { expect, test } from './fixtures.ts'

const transform = (page: import('@playwright/test').Page) => page.locator('.graph > g').getAttribute('transform')

test('mover o mapa funciona mesmo quando o navegador dá largura 0 ao SVG (Safari, Firefox)', async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(Element.prototype, 'clientWidth', {
      get() {
        return this instanceof SVGElement ? 0 : this.getBoundingClientRect().width
      },
    }),
  )
  await page.goto('/app/')
  await page.getByRole('button', { name: 'Abrir um universo de exemplo' }).click()
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Relações/ }).click()
  await page.locator('.node').first().waitFor()
  const box = (await page.locator('.graph').boundingBox())!
  await page.mouse.move(box.x + 60, box.y + 60)
  await page.mouse.down()
  await page.mouse.move(box.x + 160, box.y + 120, { steps: 5 })
  await page.mouse.up()
  const t = await transform(page)
  expect(t).not.toMatch(/Infinity|NaN/)
  expect(t).toMatch(/^translate\(1\d\d/)
})

test.describe('no celular', () => {
  test.use({ viewport: { width: 412, height: 860 }, hasTouch: true, isMobile: true })

  test('um dedo move, dois dedos dão zoom, e a página não rola', async ({ page }) => {
    await page.goto('/app/')
    await page.getByRole('button', { name: 'Abrir um universo de exemplo' }).click()
    await page.getByRole('button', { name: 'Mais' }).click()
    await page.getByRole('group', { name: 'Todas as áreas' }).getByRole('button', { name: 'Relações' }).click()
    await page.locator('.node').first().waitFor()
    const box = (await page.locator('.graph').boundingBox())!
    const cdp = await page.context().newCDPSession(page)
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', pts: [number, number][]) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) })
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    await touch('touchStart', [[cx, cy]])
    for (let i = 1; i <= 6; i++) await touch('touchMove', [[cx + i * 15, cy + i * 10]])
    await touch('touchEnd', [])
    const moved = await transform(page)
    expect(moved).not.toMatch(/Infinity|NaN/)
    expect(moved).toContain('scale(1)')
    await touch('touchStart', [[cx - 40, cy], [cx + 40, cy]])
    for (let i = 1; i <= 6; i++) await touch('touchMove', [[cx - 40 - i * 12, cy], [cx + 40 + i * 12, cy]])
    await touch('touchEnd', [])
    expect(await transform(page)).toMatch(/scale\(2\.\d+\)/)
    expect(await page.evaluate(() => [scrollX, scrollY, document.querySelector('.stage')!.scrollTop])).toEqual([0, 0, 0])
  })
})
