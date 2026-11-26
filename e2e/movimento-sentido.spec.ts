import { expect, test } from './fixtures.ts'
import { fichaModo } from './areas.ts'

// Auditoria 24, pacote 3: o movimento com sentido. A ficha troca com fade ao mudar, a lista entra em cascata,
// os marcadores caem no mapa, o “Salvo” e o anel da meta têm vida; e quem pede menos movimento não vê nada.
const nome = (page: import('@playwright/test').Page, sel: string) => page.locator(sel).first().evaluate((el) => getComputedStyle(el).animationName)

test('a ficha troca o nome com um fade quando ele muda (e na abertura não)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/app/?exemplo=ostria')
  await page.getByRole('button', { name: 'Mundo', exact: true }).first().click()
  await page.getByRole('region', { name: 'Lista de fichas' }).getByRole('button', { name: /^Torre de Marfim/ }).first().click()
  await fichaModo(page, 'Ler')
  const troca = page.locator('article.entity-reader h1.swap-in')
  await expect(troca).toHaveCount(0)
  await page.getByRole('button', { name: 'Editar o básico' }).click()
  await page.getByRole('textbox', { name: 'Nome', exact: true }).fill('Torre de Marfim Alta')
  await expect(troca).toHaveText('Torre de Marfim Alta')
})

test('a lista de fichas entra em cascata e os marcadores caem no mapa', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/app/?exemplo=ostria')
  await page.getByRole('button', { name: 'Mundo', exact: true }).first().click()
  await expect(page.locator('.entity-list > li').first()).toBeVisible()
  expect(await nome(page, '.entity-list > li')).toBe('row-in')
  const atraso = await page.locator('.entity-list > li').nth(3).evaluate((el) => getComputedStyle(el).animationDelay)
  expect(atraso).toBe('0.054s')
  await page.locator('[data-tour="partes"]').getByRole('button', { name: 'Mapas' }).click()
  await expect(page.locator('.atlas-image .pin').first()).toBeVisible()
  expect(await nome(page, '.atlas-image .pin')).toBe('pin-drop')
  expect(await nome(page, '.atlas-roads .road')).toBe('road-in')
})

test('o “Salvo” e o anel da meta têm animação', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/app/?exemplo=ostria')
  await expect(page.locator('.save-status').first()).toBeVisible()
  expect(await nome(page, '.save-status[data-status="salvo"] .save-dot')).toBe('save-pop')
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Início', exact: true }).first().click()
  const anel = page.locator('.home-ring').first()
  if (await anel.count()) expect(await anel.evaluate((el) => getComputedStyle(el).animationName)).toBe('home-ring-fill')
})

test.describe('com “menos movimento”', () => {
  test.use({ reducedMotion: 'reduce' })
  test('nenhuma delas anima', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/app/?exemplo=ostria')
    await page.getByRole('button', { name: 'Mundo', exact: true }).first().click()
    await expect(page.locator('.entity-list > li').first()).toBeVisible()
    expect(await nome(page, '.entity-list > li')).toBe('none')
    await page.locator('[data-tour="partes"]').getByRole('button', { name: 'Mapas' }).click()
    await expect(page.locator('.atlas-image .pin').first()).toBeVisible()
    expect(await nome(page, '.atlas-image .pin')).toBe('none')
    expect(await nome(page, '.save-status .save-dot')).toBe('none')
  })
})
