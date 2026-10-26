import { expect, test } from './fixtures.ts'

test.describe('no celular', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('atlas: arrastar o dedo não move o marcador; mover é de propósito, e dá para desfazer', async ({ page }) => {
    await page.goto('/app/')
    await page.getByRole('button', { name: 'Abrir um universo de exemplo' }).click()
    await page.getByRole('button', { name: 'Mais', exact: true }).click()
    await page.locator('#menu-mais').getByRole('button', { name: 'Atlas' }).click()
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
