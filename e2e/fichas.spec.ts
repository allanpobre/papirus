import { devices } from '@playwright/test'
import { expect, test, type Page } from './fixtures.ts'

const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name, exact: true })
const row = (page: Page, name: string) => page.locator('.entity-row').filter({ has: page.locator('.entity-row-name', { hasText: new RegExp(`^${name}$`) }) })

async function mundo(page: Page) {
  await page.goto('/app/?exemplo=ostria')
  await expect(page.getByRole('navigation', { name: 'Áreas' })).toBeVisible()
  await nav(page, 'Mundo').click()
}

test('Mundo: criar várias de uma vez, busca nos campos e na descrição, e a ordem', async ({ page }) => {
  await mundo(page)
  await page.getByRole('button', { name: 'Criar várias de uma vez' }).click()
  const dialog = page.getByRole('dialog', { name: 'Criar várias fichas' })
  await dialog.getByRole('textbox', { name: 'Um nome por linha' }).fill('Doran\nSelma\n- Orin\nselma\n\n')
  await dialog.getByRole('combobox', { name: 'Tipo' }).selectOption('personagem')
  await dialog.getByRole('button', { name: 'Criar 3' }).click()
  await expect(row(page, 'Doran')).toBeVisible()
  await expect(row(page, 'Orin')).toBeVisible()
  await page.getByRole('button', { name: 'Desfazer' }).click()
  await expect(row(page, 'Doran')).toHaveCount(0)

  // A busca acha pela descrição ("forja de vidro negro" está na de Kael).
  await page.getByRole('textbox', { name: 'Filtrar fichas' }).fill('forja de vidro')
  await expect(row(page, 'Kael')).toBeVisible()
  await page.getByRole('textbox', { name: 'Filtrar fichas' }).fill('')

  // Ordem: mais nas cenas primeiro.
  await page.getByRole('combobox', { name: 'Ordem da lista' }).selectOption('cenas')
  await expect(page.locator('.entity-row-name').first()).toHaveText(/Kael|Mira/)

  // Tipos próprios aparecem na criação rápida.
  await row(page, 'Kael').click()
  await page.getByRole('group', { name: 'Modo da ficha' }).getByRole('button', { name: 'Editar' }).click()
  await page.getByRole('combobox', { name: 'Tipo', exact: true }).selectOption('__outro')
  await page.getByPlaceholder('Nome do tipo: navio, doença, idioma…').fill('Contrabandista')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('combobox', { name: 'Tipo da nova ficha' }).locator('option', { hasText: 'Contrabandista' })).toHaveCount(1)
})

test('ficha: ligações numa linha, outros nomes no alto e campo que aponta para outra ficha', async ({ page }) => {
  await mundo(page)
  await row(page, 'Kael').click()
  await page.getByRole('group', { name: 'Modo da ficha' }).getByRole('button', { name: 'Editar' }).click()

  // Outros nomes e etiquetas à vista, sem abrir "Mais detalhes".
  await expect(
    page
      .getByRole('combobox', { name: 'Etiquetas' })
      .or(page.getByRole('textbox', { name: 'Etiquetas' }))
      .first(),
  ).toBeVisible()

  // Cada ligação é uma linha; o lápis abre o resto.
  const irmao = page.locator('.relation-row.is-line').filter({ hasText: 'irmão de' })
  await expect(irmao.locator('.chip-entity')).toHaveText(['Mira'])
  await irmao.getByRole('button', { name: 'Editar a ligação “irmão de”' }).click()
  await expect(page.locator('input[value="irmão de"]')).toBeVisible()
  await page.getByRole('button', { name: 'Pronto' }).click()

  // "Mãe: Ilsa" aponta para a ficha da Ilsa.
  await page.getByRole('button', { name: 'Campo', exact: true }).click()
  const campo = page.locator('.kv-typed').last()
  await campo.getByRole('textbox', { name: 'Campo' }).fill('Mãe')
  await campo.getByRole('combobox', { name: 'Tipo do campo Mãe' }).selectOption('ficha')
  await campo.getByRole('combobox', { name: 'Mãe (ficha)' }).fill('Ils')
  await page.getByRole('option', { name: /^Ilsa/ }).first().click()
  await expect(page.locator('.relation-row.is-field').filter({ hasText: 'Mãe' })).toContainText('Ilsa')

  // Do outro lado, em Ler: "Ilsa é mãe de Kael".
  await row(page, 'Ilsa').click()
  await page.getByRole('group', { name: 'Modo da ficha' }).getByRole('button', { name: 'Ler' }).click()
  await expect(page.getByRole('article', { name: 'Ler a ficha Ilsa' })).toContainText('Ilsa é mãe de Kael')
})

test.describe('no celular', () => {
  const { defaultBrowserType: _ignored, ...pixel } = devices['Pixel 7']
  test.use(pixel)

  test('a lista primeiro; o botão redondo cria uma atrás da outra sem sair da lista', async ({ page }) => {
    await page.goto('/app/?exemplo=ostria')
    await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Mundo', exact: true }).tap()
    // A primeira ficha aparece no alto da tela.
    const first = await page.locator('.entity-row').first().boundingBox()
    expect(first!.y).toBeLessThan(260)
    await page.getByRole('button', { name: 'Nova ficha' }).tap()
    const dialog = page.getByRole('dialog', { name: 'Nova ficha' })
    await dialog.getByRole('textbox', { name: 'Nome' }).fill('Doran')
    await dialog.getByRole('button', { name: 'Criar e fazer outra' }).tap()
    await dialog.getByRole('textbox', { name: 'Nome' }).fill('Selma')
    await dialog.getByRole('button', { name: 'Criar e fazer outra' }).tap()
    await dialog.getByRole('button', { name: 'Fechar' }).tap()
    await expect(row(page, 'Doran')).toBeVisible()
    await expect(row(page, 'Selma')).toBeVisible()
  })
})
