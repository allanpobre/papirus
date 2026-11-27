import { expect, test, type Page } from './fixtures.ts'
import { fichaModo } from './areas.ts'

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

/** A Mesa do exemplo de Oz, no bestiário ("Dados e tabelas"). */
async function bestiario(page: Page) {
  await page.goto('/app/?exemplo')
  await page.getByRole('button', { name: 'Menu', exact: true }).click()
  await page.getByRole('group', { name: 'Todas as áreas' }).getByRole('button', { name: 'Mesa', exact: true }).click()
  await page.getByRole('tab', { name: 'Regras' }).click()
  await page.getByRole('tab', { name: 'Dados e tabelas' }).click()
  const sec = page.getByRole('region', { name: 'Inimigos prontos' })
  await expect(sec).toBeVisible()
  return sec
}

test('o inimigo que vem do Mundo herda o "No jogo" da ficha (traços e modificadores) e fica ligado a ela', async ({ page }) => {
  const sec = await bestiario(page)
  // O Kalidah do exemplo vem da ficha do Mundo: tem os modificadores e traços dela, em dia.
  await sec.locator('.bestiary-row', { hasText: 'Kalidah' }).click()
  const kalidah = sec.getByLabel('Do Mundo', { exact: true })
  await expect(kalidah).toContainText('Do Mundo: Kalidah')
  const herdado = kalidah.getByRole('list', { name: 'O que vem do No jogo' })
  await expect(herdado).toContainText('FOR +3')
  await expect(herdado).toContainText('Garras longas')
  await expect(herdado).toContainText('Caça em dupla')
  await expect(sec.locator('.bestiary-row', { hasText: 'Kalidah' })).toContainText('Fera · nv 4')

  // Uma espécie do Mundo que ainda não é inimigo vira um com um toque, já com o que a ficha tem.
  await sec.getByRole('button', { name: 'Cabeças-de-Martelo' }).click()
  const novo = sec.locator('.monster-editor')
  await expect(novo.getByRole('textbox', { name: 'Nome', exact: true })).toHaveValue('Cabeças-de-Martelo')
  await expect(novo.getByLabel('Do Mundo', { exact: true })).toContainText('Do Mundo: Cabeças-de-Martelo')
  await expect(novo.getByRole('list', { name: 'O que vem do No jogo' })).toContainText('Cabeçada a distância')
  // Já não é oferecida de novo.
  await expect(sec.locator('.bestiary-world .chip', { hasText: 'Cabeças-de-Martelo' })).toHaveCount(0)

  // Tipo e nível, para achar depois.
  await novo.getByRole('combobox', { name: 'Tipo', exact: true }).fill('Criatura')
  await novo.getByRole('textbox', { name: 'Nível do inimigo' }).fill('3')
  await expect(sec.locator('.bestiary-row', { hasText: 'Cabeças-de-Martelo' })).toContainText('Criatura · nv 3')

  // Qualquer outra ficha do Mundo também vira inimigo (um vilão, um NPC), pela busca.
  await sec.getByRole('combobox', { name: 'Inimigo a partir de outra ficha do Mundo' }).fill('Bruxa Má do Oeste')
  await page.getByRole('option', { name: /^Bruxa Má do Oeste/ }).first().click()
  const vilao = sec.locator('.monster-editor').last()
  await expect(vilao.getByRole('textbox', { name: 'Nome', exact: true })).toHaveValue('Bruxa Má do Oeste')
  await expect(vilao.getByLabel('Do Mundo', { exact: true })).toContainText('Do Mundo: Bruxa Má do Oeste')
  await expect(vilao.getByLabel('Do Mundo', { exact: true })).toContainText('A ficha ainda não tem “No jogo”')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('o inimigo acompanha a ficha do Mundo: o que muda no "No jogo" da espécie aparece no bestiário e na iniciativa', async ({ page }) => {
  // Na ficha da Kalidah (Mundo), um traço novo no "No jogo".
  await page.goto('/app/?exemplo')
  await page.getByRole('button', { name: 'Menu', exact: true }).click()
  await page.getByRole('group', { name: 'Todas as áreas' }).getByRole('button', { name: 'Mundo', exact: true }).click()
  await page.locator('.entity-row', { has: page.locator('.entity-row-name', { hasText: /^Kalidah$/ }) }).first().click()
  await fichaModo(page, 'Editar')
  const jogo = page.locator('details.fold', { hasText: 'No jogo' })
  if (!(await jogo.evaluate((d) => (d as HTMLDetailsElement).open))) await jogo.locator('summary').click()
  await jogo.getByLabel('Traços (um por linha)').fill('Garras longas\nCaça em dupla\nTem medo de água')

  // No bestiário, o inimigo já tem o traço novo.
  await page.getByRole('button', { name: 'Menu', exact: true }).click()
  await page.getByRole('group', { name: 'Todas as áreas' }).getByRole('button', { name: 'Mesa', exact: true }).click()
  await page.getByRole('tab', { name: 'Regras' }).click()
  await page.getByRole('tab', { name: 'Dados e tabelas' }).click()
  const sec = page.getByRole('region', { name: 'Inimigos prontos' })
  await sec.locator('.bestiary-row', { hasText: 'Kalidah' }).click()
  await expect(sec.getByRole('list', { name: 'O que vem do No jogo' })).toContainText('Tem medo de água')
})

test('busca e filtros do bestiário no celular: por nome, por tipo e por nível', async ({ page }) => {
  const sec = await bestiario(page)
  const linhas = sec.locator('.bestiary-row')
  // Com três inimigos a lista cabe numa olhada: os filtros só aparecem com quatro ou mais.
  await expect(linhas).toHaveCount(3)
  await expect(sec.getByRole('search', { name: 'Buscar inimigos' })).toHaveCount(0)
  await sec.getByRole('button', { name: 'Cabeças-de-Martelo' }).click()
  const filtros = sec.getByRole('search', { name: 'Buscar inimigos' })
  await expect(filtros).toBeVisible()
  await expect(linhas).toHaveCount(4)

  // Cabem no celular, com alvos de 44 px e sem rolagem de lado.
  for (const campo of [filtros.getByRole('searchbox'), filtros.getByRole('combobox', { name: 'Tipo de inimigo' }), filtros.getByRole('combobox', { name: 'Nível do inimigo' })]) {
    expect((await campo.boundingBox())!.height).toBeGreaterThanOrEqual(43)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)

  // Por nome.
  await filtros.getByRole('searchbox').fill('lob')
  await expect(linhas).toHaveCount(1)
  await expect(linhas.first()).toContainText('Lobo da Bruxa')
  await expect(filtros.getByRole('status')).toContainText('1 de 4')
  await filtros.getByRole('button', { name: 'Limpar' }).click()
  await expect(linhas).toHaveCount(4)

  // Por tipo: as duas feras. Por nível: do 1 ao 3, do 4 ao 6, e quem ainda não tem nível.
  await filtros.getByRole('combobox', { name: 'Tipo de inimigo' }).selectOption('Fera')
  await expect(linhas).toHaveCount(2)
  await filtros.getByRole('combobox', { name: 'Tipo de inimigo' }).selectOption('')
  await filtros.getByRole('combobox', { name: 'Nível do inimigo' }).selectOption('1-3')
  await expect(linhas).toHaveCount(2)
  await expect(linhas.nth(0)).toContainText('Lobo da Bruxa')
  await expect(linhas.nth(1)).toContainText('Macaco Alado')
  await filtros.getByRole('combobox', { name: 'Nível do inimigo' }).selectOption('4-6')
  await expect(linhas).toHaveCount(1)
  await expect(linhas.first()).toContainText('Kalidah')
  await filtros.getByRole('combobox', { name: 'Nível do inimigo' }).selectOption('7+')
  await expect(page.getByText('Nenhum inimigo com esse filtro.')).toBeVisible()
  await filtros.getByRole('combobox', { name: 'Nível do inimigo' }).selectOption('sem')
  await expect(linhas).toHaveCount(1)
  await expect(linhas.first()).toContainText('Cabeças-de-Martelo')
})
