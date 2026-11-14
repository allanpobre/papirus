import { devices } from '@playwright/test'
import { expect, test } from './fixtures.ts'

const nav = (page: import('@playwright/test').Page, name: string) => page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name, exact: true })

test('Seus universos: criar primeiro, o exemplo no fim com selo e o menu ··· de cada um', async ({ page }) => {
  await page.goto('/app/')
  // Na primeira vez, a caixa de criar vem antes do treino.
  const create = await page.getByRole('form', { name: 'Novo universo' }).boundingBox()
  const treino = await page.locator('.treino-card').first().boundingBox()
  expect(create!.y).toBeLessThan(treino!.y)

  await page.getByRole('textbox', { name: 'Nome do novo universo' }).fill('Maré Baixa')
  await page.getByRole('button', { name: 'Criar universo' }).click()
  await expect(page.getByRole('navigation', { name: 'Áreas' })).toBeVisible()
  await page.getByTitle('Trocar de universo').first().click()
  await page.getByRole('button', { name: /O Alienista, de Machado de Assis/ }).click()
  await page.getByRole('button', { name: 'Sair do exemplo' }).click()

  // Os seus primeiro; o exemplo no fim, com selo, e não no "Continuar".
  await expect(page.getByRole('button', { name: /^Continuar escrevendo Maré Baixa/ })).toBeVisible()
  const list = page.getByRole('list', { name: 'Universos' })
  await expect(list.locator('.library-name')).toHaveText(['Maré Baixa', /O AlienistaExemplo/])
  await expect(list.getByRole('listitem').last()).toContainText('Só neste aparelho')
  await expect(list.getByRole('listitem').first()).toContainText(/hoje, \d\d:\d\d/)
  await expect(page.getByRole('button', { name: /O Alienista, de Machado de Assis/ })).toHaveCount(0)

  // O ···: baixar o backup sem abrir, e apagar com confirmação.
  await list.getByRole('button', { name: 'Mais ações de Maré Baixa' }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Baixar backup (.json)' }).click()
  expect((await download).suggestedFilename()).toMatch(/^mare-baixa-backup-.*\.json$/)
  await list.getByRole('button', { name: 'Mais ações de Maré Baixa' }).click()
  await page.getByRole('button', { name: 'Apagar…' }).click()
  await page.getByRole('button', { name: 'Apagar universo' }).click()
  await expect(page.getByText('Maré Baixa')).toHaveCount(0)
})

test('Ajustes em três grupos, cada painel dizendo para quem vale', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await nav(page, 'Ajustes e dados').click()
  const cats = page.getByRole('navigation', { name: 'Categorias dos ajustes' })
  await expect(cats.getByRole('group', { name: 'Este universo' }).getByRole('button')).toHaveText(['Universo', 'Dados e backup', 'Lixeira e histórico', 'Importar e wiki'])
  await expect(cats.getByRole('group', { name: 'Este aparelho' }).getByRole('button')).toHaveText(['Aparência', 'Escrita', 'Menu e ajuda', 'Todas as ferramentas'])
  await expect(cats.getByRole('group', { name: 'Sua conta' }).getByRole('button')).toHaveText(['Conta'])
  // O servidor fica em Avançado, fechado.
  await expect(cats.getByRole('button', { name: 'Servidor próprio' })).toBeHidden()

  await cats.getByRole('button', { name: 'Universo', exact: true }).click()
  await expect(page.locator('.settings-scope')).toHaveText('Vale só para este universo.')
  // O tipo e o apagar moram em Universo.
  await expect(page.getByRole('radiogroup', { name: 'Este universo é' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Apagar este universo…' })).toBeVisible()
  // Cada tipo de ficha com o seu exemplo de campos.
  const campos = page.locator('section', { has: page.getByRole('heading', { name: 'Campos sugeridos nas fichas' }) })
  await expect(campos.locator('.field-template-row').filter({ hasText: 'Lugar' }).getByRole('textbox')).toHaveAttribute('placeholder', 'Ex.: Clima, Quem manda, Perigo')
  // E as listas que cada tipo sugere.
  const listas = page.locator('section', { has: page.getByRole('heading', { name: 'Listas sugeridas nas fichas' }) })
  await expect(listas.locator('.field-template-row').filter({ hasText: 'Reino' }).getByRole('textbox')).toHaveValue('Raças, Criaturas, Habitantes')

  await cats.getByRole('button', { name: 'Aparência' }).click()
  await expect(page.locator('.settings-scope')).toHaveText('Vale para este aparelho, em todos os universos.')

  // A busca acha o apagar e o servidor pelo nome de sempre.
  await page.getByRole('searchbox', { name: 'Procurar nos ajustes' }).fill('apagar')
  await expect(page.getByRole('button', { name: 'Apagar este universo…' })).toBeVisible()
  await page.getByRole('searchbox', { name: 'Procurar nos ajustes' }).fill('supabase')
  await expect(page.getByRole('textbox', { name: 'Endereço do projeto' })).toBeVisible()
})

test.describe('no celular', () => {
  const { defaultBrowserType: _ignored, ...pixel } = devices['Pixel 7']
  test.use(pixel)

  test('Ajustes: uma lista com tudo à vista; um toque abre e o "voltar" volta', async ({ page }) => {
    await page.goto('/app/?exemplo=ostria')
    await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Mais' }).tap()
    await page
      .getByRole('button', { name: /^Ajustes/ })
      .first()
      .tap()
    const cats = page.getByRole('navigation', { name: 'Categorias dos ajustes' })
    // Todas as categorias à vista, sem rolar de lado.
    for (const name of ['Universo', 'Dados e backup', 'Lixeira e histórico', 'Importar e wiki', 'Aparência', 'Escrita', 'Menu e ajuda', 'Conta']) {
      await expect(cats.getByRole('button', { name, exact: true })).toBeVisible()
    }
    await cats.getByRole('button', { name: 'Dados e backup', exact: true }).tap()
    await expect(cats).toBeHidden()
    await expect(page.getByRole('heading', { name: 'Dados e backup' })).toBeVisible()
    await page.goBack()
    await expect(cats.getByRole('button', { name: 'Dados e backup', exact: true })).toBeVisible()
    // O botão "Ajustes" no alto também volta.
    await cats.getByRole('button', { name: 'Aparência', exact: true }).tap()
    await page.getByRole('button', { name: 'Ajustes', exact: true }).tap()
    await expect(cats.getByRole('button', { name: 'Aparência', exact: true })).toBeVisible()
  })
})
