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

test('listas: Habitantes do reino, vários de uma vez, e o que todos têm aparece em cada um', async ({ page }) => {
  await mundo(page)
  await row(page, 'Reino de Ostria').click()
  await page.getByRole('group', { name: 'Modo da ficha' }).getByRole('button', { name: 'Editar' }).click()
  const listas = page.getByRole('region', { name: 'Listas' })
  // O reino sugere as listas dele; um toque cria.
  await listas.getByRole('button', { name: 'Habitantes' }).click()
  const card = listas.getByRole('article', { name: 'Habitantes' })
  await card.getByRole('button', { name: '+ O que todos desta lista têm' }).click()
  await card.getByRole('button', { name: 'Campo para todos' }).click()
  await card.getByRole('textbox', { name: 'Campo que todos têm' }).fill('Idioma')
  await card.getByRole('textbox', { name: 'Valor de Idioma para todos' }).fill('ostriano')
  await card.getByRole('button', { name: 'Adicionar' }).click()
  const dialog = page.getByRole('dialog', { name: 'Adicionar a Habitantes de Reino de Ostria' })
  await dialog.getByText(/^Marcar as \d+ da lista$/).click()
  await dialog.getByRole('button', { name: /^Adicionar \d+$/ }).click()
  await expect(card.locator('.member-name')).toContainText(['Cassian', 'Ilsa', 'Kael'])

  // Do outro lado: "Faz parte de" e o idioma, com a origem.
  await row(page, 'Kael').click()
  await page.getByRole('group', { name: 'Modo da ficha' }).getByRole('button', { name: 'Ler' }).click()
  const ler = page.getByRole('article', { name: 'Ler a ficha Kael' })
  await expect(ler.getByLabel('Faz parte de')).toContainText('Reino de Ostria · Habitantes')
  await expect(ler.locator('.reader-infobox')).toContainText('ostriano · de Reino de Ostria')
  // Mudar só nele.
  await page.getByRole('group', { name: 'Modo da ficha' }).getByRole('button', { name: 'Editar' }).click()
  await page.getByRole('button', { name: 'Mudar só nesta' }).click()
  await expect(page.locator('.inherited-row.is-overridden')).toContainText('diferente nesta ficha')
})

test('selecionar várias no Mundo e pôr uma etiqueta em todas; a tabela compara e edita na célula', async ({ page }) => {
  await mundo(page)
  await page.getByRole('button', { name: 'Selecionar' }).click()
  await page.getByRole('checkbox', { name: 'Marcar Mira' }).check()
  await page.getByRole('checkbox', { name: 'Marcar Ilsa' }).check()
  const bar = page.getByRole('toolbar', { name: 'Fichas marcadas' })
  await expect(bar).toContainText('2 marcadas')
  await bar.getByRole('button', { name: 'Etiqueta' }).click()
  await page.getByRole('dialog', { name: 'Etiqueta em 2 fichas' }).getByRole('textbox', { name: 'Etiqueta' }).fill('torre')
  await page.getByRole('button', { name: 'Pôr a etiqueta' }).click()
  await page.getByRole('textbox', { name: 'Filtrar fichas' }).fill('torre')
  await expect(row(page, 'Mira')).toBeVisible()
  await expect(row(page, 'Ilsa')).toBeVisible()
  await page.getByRole('textbox', { name: 'Filtrar fichas' }).fill('')

  // Tabela: os personagens lado a lado; a célula edita ali mesmo.
  await page.getByRole('radiogroup', { name: 'Tipo' }).getByRole('radio', { name: 'Personagens' }).click()
  await page.getByRole('radiogroup', { name: 'Vista do Mundo' }).getByRole('radio', { name: 'Tabela' }).click()
  const table = page.getByRole('region', { name: 'Tabela de fichas' })
  await expect(table.getByRole('columnheader', { name: /Cenas/ })).toBeVisible()
  await table.getByRole('button', { name: /^Olhos de Kael/ }).click()
  await page.keyboard.type('castanhos')
  await page.keyboard.press('Enter')
  await expect(table.getByRole('button', { name: 'Olhos de Kael: castanhos' })).toBeVisible()
  await table.getByRole('columnheader', { name: /Cenas/ }).getByRole('button').click()
  await expect(table.locator('tbody th').first()).toHaveText(/Odo|Cassian|Rhea/)
})

test('modelo de ficha: "Usar como modelo" e criar outra já preenchida', async ({ page }) => {
  await mundo(page)
  await row(page, 'Kael').click()
  await page.getByRole('group', { name: 'Modo da ficha' }).getByRole('button', { name: 'Editar' }).click()
  await page.getByRole('button', { name: 'Campo', exact: true }).click()
  await page.locator('.kv-typed').last().getByRole('textbox', { name: 'Campo' }).fill('Ofício')
  await page.locator('.kv-typed').last().getByRole('textbox', { name: 'Valor' }).fill('contrabandista')
  await page.getByRole('button', { name: 'Usar como modelo' }).click()
  await page.getByRole('textbox', { name: 'Nome da nova ficha' }).fill('Doran')
  await page.getByRole('button', { name: 'Criar a partir de um modelo' }).click()
  await page.locator('.more-menu-pop').getByRole('button', { name: 'Kael' }).click()
  await expect(page.locator('#entity-name')).toHaveValue('Doran')
  await expect(
    page
      .locator('.kv-typed')
      .filter({ has: page.locator('input[value="Ofício"]') })
      .getByRole('textbox', { name: 'Valor' }),
  ).toHaveValue('contrabandista')
})

test('em Ler, campo vazio some; o que as ligações já dizem preenche o campo', async ({ page }) => {
  await mundo(page)
  await row(page, 'Ostria').click()
  await page.getByRole('group', { name: 'Modo da ficha' }).getByRole('button', { name: 'Editar' }).click()
  // Dois campos vazios: "Clima" e "Quem governa" (Cassian governa Ostria, pelas ligações).
  for (const key of ['Clima', 'Quem governa']) {
    await page.getByRole('button', { name: 'Campo', exact: true }).click()
    await page.locator('.kv-typed').last().getByRole('textbox', { name: 'Campo' }).fill(key)
  }
  await expect(page.locator('.kv-typed').last().getByRole('textbox', { name: 'Valor' })).toHaveAttribute('placeholder', 'Cassian · pelas ligações')
  await page.getByRole('group', { name: 'Modo da ficha' }).getByRole('button', { name: 'Ler' }).click()
  const box = page.getByRole('article', { name: 'Ler a ficha Ostria' }).getByRole('complementary', { name: 'Em resumo' })
  await expect(box.locator('div', { has: page.locator('dt', { hasText: 'Quem governa' }) }).locator('dd')).toHaveText('Cassian')
  await expect(box.locator('dt', { hasText: 'Clima' })).toHaveCount(0)
  // No "Espiar", o mesmo: sem o campo vazio, com quem governa.
  await page.getByRole('group', { name: 'Modo da ficha' }).getByRole('button', { name: 'Editar' }).click()
  await page.locator('.entity-side').getByRole('button', { name: 'Espiar' }).click()
  const peek = page.getByRole('dialog', { name: 'Ostria' })
  await expect(peek.locator('dl.kv')).toContainText('Quem governaCassian')
  await expect(peek.locator('dl.kv')).not.toContainText('Clima')
})
