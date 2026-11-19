import { expect, test } from './fixtures.ts'
import { fichaModo } from './areas.ts'

/*
 * Nova cara: a árvore de poderes vira uma constelação. Estrelas acesas (o que a ficha tem), apagadas (o que
 * não tem) e a carta ao tocar. No celular.
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

test('constelação: estrelas acendem pela régua e a carta mostra o poder', async ({ page }) => {
  await page.addInitScript(() => {
    const prefs = JSON.parse(localStorage.getItem('papirus:prefs') ?? '{}')
    localStorage.setItem('papirus:prefs', JSON.stringify({ ...prefs, novaCara: true }))
  })
  await page.goto('/app/?exemplo=ostria')
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Mundo', exact: true }).click()
  // Com a Nova cara, o Mundo abre no mapa (quando há um): as fichas ficam em "Fichas".
  await page.locator('[data-tour="partes"]').getByRole('button', { name: 'Fichas' }).click()
  // Um sistema pelo modelo "Elementos".
  await page.getByRole('button', { name: 'Nova ficha' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nova ficha' })
  await dialog.getByRole('textbox', { name: 'Nome' }).fill('Marés')
  await dialog.getByRole('combobox', { name: 'Tipo' }).selectOption('magia')
  await dialog.getByRole('button', { name: 'Criar e abrir' }).click()
  await fichaModo(page, 'Editar')
  await page.getByRole('group', { name: 'Começar com um modelo' }).getByRole('button', { name: 'Elementos' }).click()
  await fichaModo(page, 'Ler')
  const ceu = page.getByRole('group', { name: 'Constelação de Marés' })
  await expect(ceu.getByRole('button', { name: 'Vapor' })).toBeVisible()
  await ceu.getByRole('button', { name: 'Vapor' }).click()
  await expect(page.getByRole('region', { name: 'Poder: Vapor' })).toContainText('pede: Água + Fogo')

  // Kael aprende Água numa cena do meio.
  await page.getByRole('button', { name: 'Voltar para a lista' }).click()
  await page.getByRole('region', { name: 'Lista de fichas' }).getByRole('button', { name: /^Kael/ }).first().click()
  await fichaModo(page, 'Ler')
  await page.getByRole('button', { name: 'Bloco', exact: true }).click()
  await page.getByRole('group', { name: 'Acrescentar bloco' }).getByRole('button', { name: 'Poderes' }).click()
  const editando = page.getByRole('group', { name: 'Editando: Poderes' })
  await editando.getByRole('checkbox', { name: 'Água' }).check()
  await editando.getByRole('combobox', { name: 'Aprende Água em' }).selectOption({ index: 3 })
  await editando.getByRole('button', { name: 'Pronto' }).click()
  const ceuKael = page.getByRole('group', { name: 'Constelação de Marés' })
  await expect(ceuKael.getByRole('button', { name: 'Água, acesa' })).toBeVisible()
  await expect(ceuKael.getByRole('button', { name: 'Fogo, apagada' })).toBeVisible()
  // Antes da cena, apagada.
  await page.getByRole('combobox', { name: 'Até onde na história' }).selectOption({ index: 1 })
  await expect(ceuKael.getByRole('button', { name: 'Água, apagada' })).toBeVisible()
  await page.getByRole('combobox', { name: 'Até onde na história' }).selectOption({ index: 0 })
  await ceuKael.getByRole('button', { name: 'Água, acesa' }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  if (process.env.SHOT) {
    await ceuKael.scrollIntoViewIfNeeded()
    await page.screenshot({ path: process.env.SHOT })
  }
})

test.describe('no computador', () => {
  test.use({ viewport: { width: 1280, height: 900 }, hasTouch: false, isMobile: false })
  test('na ficha do sistema, arrastar de uma estrela até outra liga (e de novo desliga)', async ({ page }) => {
    await page.addInitScript(() => {
      const prefs = JSON.parse(localStorage.getItem('papirus:prefs') ?? '{}')
      localStorage.setItem('papirus:prefs', JSON.stringify({ ...prefs, novaCara: true }))
    })
    await page.goto('/app/?exemplo=ostria')
    await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Mundo/ }).first().click()
    await page.locator('[data-tour="partes"]').getByRole('button', { name: 'Fichas' }).click()
    await page.getByRole('textbox', { name: 'Nome da nova ficha' }).fill('Marés')
    await page.getByRole('combobox', { name: 'Tipo da nova ficha' }).selectOption('magia')
    await page.getByRole('button', { name: 'Criar ficha' }).click()
    await fichaModo(page, 'Editar')
    await page.getByRole('group', { name: 'Começar com um modelo' }).getByRole('button', { name: 'Elementos' }).click()
    await fichaModo(page, 'Ler')
    const ceu = page.getByRole('group', { name: 'Constelação de Marés' })
    const arrastar = async (de: string, ate: string) => {
      await ceu.scrollIntoViewIfNeeded()
      const a = (await ceu.getByRole('button', { name: de, exact: true }).locator('.star-dot').boundingBox())!
      const b = (await ceu.getByRole('button', { name: ate, exact: true }).locator('.star-dot').boundingBox())!
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
      await page.mouse.down()
      await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 5 })
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 5 })
      await page.mouse.up()
    }
    // Ar passa a pedir Terra.
    await arrastar('Terra', 'Ar')
    await ceu.getByRole('button', { name: 'Ar', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Poder: Ar' })).toContainText('pede: Terra')
    // De novo: desliga.
    await arrastar('Terra', 'Ar')
    await expect(page.getByRole('region', { name: 'Poder: Ar' })).not.toContainText('pede:')
  })
})
