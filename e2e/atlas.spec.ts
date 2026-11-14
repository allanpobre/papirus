import { openPart } from './areas.ts'
import { expect, test } from './fixtures.ts'

test.describe('no celular', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('atlas: arrastar o dedo não move o marcador; mover é de propósito, e dá para desfazer', async ({ page }) => {
    await page.goto('/app/')
    await page.getByRole('button', { name: /O Alienista, de Machado de Assis/ }).click()
    await openPart(page, 'Mapas')
    const pin = page.getByRole('button', { name: /^Casa Verde/ })
    const style = () => pin.getAttribute('style')
    const before = await style()

    // Um "arrasto" com o dedo em cima do marcador: só seleciona.
    const box = (await pin.boundingBox())!
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
    await page.dispatchEvent('.pin.selected', 'pointerdown', { pointerType: 'touch', clientX: box.x + 5, clientY: box.y + 5, pointerId: 7, bubbles: true })
    await page.dispatchEvent('.atlas-image', 'pointermove', { pointerType: 'touch', clientX: box.x + 80, clientY: box.y + 60, pointerId: 7, bubbles: true })
    await page.dispatchEvent('.atlas-image', 'pointerup', { pointerType: 'touch', pointerId: 7, bubbles: true })
    expect(await style()).toBe(before)

    // Mover: "Mover" no cartão e toque no lugar novo.
    const card = page.getByRole('complementary', { name: 'Marcador' })
    await card.getByRole('button', { name: 'Mover', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Toque no mapa onde' })).toBeVisible()
    const map = (await page.locator('.atlas-image').boundingBox())!
    await page.locator('.atlas-image').click({ position: { x: map.width * 0.2, y: map.height * 0.8 } })
    await expect.poll(style).not.toBe(before)
    await page.getByRole('button', { name: 'Desfazer' }).click()
    await expect.poll(style).toBe(before)
  })
})

test.describe('no celular: mover e aproximar o mapa com o dedo', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('dois dedos aproximam, um dedo move (mesmo começando num marcador, que não abre), e um toque parado abre', async ({ page }) => {
    await page.goto('/app/')
    await page.getByRole('button', { name: /O Alienista, de Machado de Assis/ }).click()
    await openPart(page, 'Mapas')
    const scroll = page.locator('.atlas-scroll')
    const image = page.locator('.atlas-image')
    await expect(page.getByRole('button', { name: /^Casa Verde/ })).toBeVisible()
    const cdp = await page.context().newCDPSession(page)
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', pts: [number, number][]) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) })
    const size = () => image.evaluate((el) => ({ w: (el as HTMLElement).offsetWidth, transform: (el as HTMLElement).style.transform }))
    const sb = (await scroll.boundingBox())!
    const w0 = (await size()).w
    const cx = sb.x + sb.width / 2
    const cy = sb.y + Math.min(sb.height / 2, 200)

    // Pinça: durante o gesto é só uma pré-visualização (transform); ao soltar vira o zoom de verdade.
    await touch('touchStart', [[cx - 40, cy], [cx + 40, cy]])
    for (let i = 1; i <= 6; i++) await touch('touchMove', [[cx - 40 - i * 12, cy], [cx + 40 + i * 12, cy]])
    expect((await size()).transform).toMatch(/scale\(2\.\d+/)
    await touch('touchEnd', [])
    await expect.poll(async () => (await size()).transform).toBe('')
    const w1 = (await size()).w
    expect(w1).toBeGreaterThan(w0 * 2.2)
    expect(w1).toBeLessThan(w0 * 3)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)

    // Um marcador à vista, no meio da área.
    await page.locator('.pin').first().evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'center' }))
    const pin = page.locator('.pin').first()
    const pb = (await pin.boundingBox())!
    const x = pb.x + pb.width / 2
    const y = pb.y + pb.height / 2
    const left0 = await scroll.evaluate((el) => el.scrollLeft)

    // Um dedo começando em cima do marcador: o mapa anda com o dedo e o marcador não abre.
    await touch('touchStart', [[x, y]])
    for (let i = 1; i <= 6; i++) await touch('touchMove', [[x - i * 12, y]])
    await touch('touchEnd', [])
    expect((await scroll.evaluate((el) => el.scrollLeft)) - left0).toBeGreaterThan(50)
    await expect(page.locator('.pin.selected')).toHaveCount(0)
    await expect(page.getByRole('complementary', { name: 'Marcador' })).toHaveCount(0)

    // Um toque parado (um instante depois) abre.
    await page.waitForTimeout(300)
    const pb2 = (await pin.boundingBox())!
    await touch('touchStart', [[pb2.x + pb2.width / 2, pb2.y + pb2.height / 2]])
    await touch('touchEnd', [])
    await expect(page.getByRole('complementary', { name: 'Marcador' })).toBeVisible()
    await expect(page.locator('.pin.selected')).toHaveCount(1)
  })

  test('com o mapa aproximado, o ponto entre os dedos continua debaixo deles', async ({ page }) => {
    await page.goto('/app/')
    await page.getByRole('button', { name: /O Alienista, de Machado de Assis/ }).click()
    await openPart(page, 'Mapas')
    await expect(page.locator('.pin').first()).toBeVisible()
    const cdp = await page.context().newCDPSession(page)
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', pts: [number, number][]) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) })
    // O marcador mais perto do meio vira a âncora: pinça com ele entre os dedos.
    const pb = (await page.locator('.pin').first().boundingBox())!
    const ax = pb.x + pb.width / 2
    const ay = pb.y + pb.height
    await touch('touchStart', [[ax - 30, ay], [ax + 30, ay]])
    for (let i = 1; i <= 5; i++) await touch('touchMove', [[ax - 30 - i * 12, ay], [ax + 30 + i * 12, ay]])
    await touch('touchEnd', [])
    await page.waitForTimeout(200)
    const pa = (await page.locator('.pin').first().boundingBox())!
    // O ponto do marcador (a ponta de baixo) continua perto de onde estava entre os dedos.
    expect(Math.abs(pa.x + pa.width / 2 - ax)).toBeLessThan(24)
    expect(Math.abs(pa.y + pa.height - ay)).toBeLessThan(24)
  })
})

test('mapa político: pintar a região de Ostria, ver o nome e apagar', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await openPart(page, 'Mapas')
  await page.getByRole('button', { name: 'Pintar região' }).click()
  const paint = page.getByRole('group', { name: 'Pintar região' })
  await paint.getByRole('combobox', { name: 'De quem é esta região?' }).fill('Reino de Ost')
  await page.getByRole('option', { name: /Reino de Ostria/ }).first().click()
  const map = page.locator('.atlas-image')
  const box = (await map.boundingBox())!
  for (const [x, y] of [
    [0.2, 0.2],
    [0.6, 0.2],
    [0.4, 0.6],
  ])
    await map.click({ position: { x: box.width * x, y: box.height * y } })
  await paint.getByRole('button', { name: 'Concluir' }).click()
  const label = page.locator('.atlas-region-label', { hasText: 'Reino de Ostria' })
  await expect(label).toBeVisible()
  await label.click()
  await page.getByRole('button', { name: 'Apagar região' }).click()
  await expect(label).toHaveCount(0)
})
