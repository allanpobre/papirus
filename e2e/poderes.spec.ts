import { expect, test } from './fixtures.ts'
import { fichaModo } from './areas.ts'

/*
 * Poderes e magia, no celular: um sistema montado a partir de um modelo, o personagem aprende um poder numa
 * cena e a árvore dele acende conforme a régua da história.
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

test('poderes: árvore pelo modelo, aprende numa cena, acende pela régua e avisa o que não fecha', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await page.getByRole('button', { name: 'Mundo', exact: true }).first().click()

  // Um sistema de magia novo, a partir do modelo "Graus".
  await page.getByRole('button', { name: 'Nova ficha' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nova ficha' })
  await dialog.getByRole('textbox', { name: 'Nome' }).fill('Os Graus')
  await dialog.getByRole('combobox', { name: 'Tipo' }).selectOption('magia')
  await dialog.getByRole('button', { name: 'Criar e abrir' }).click()
  await fichaModo(page, 'Editar')
  await page.getByRole('group', { name: 'Começar com um modelo' }).getByRole('button', { name: 'Graus' }).click()
  await expect(page.getByRole('group', { name: /^Poder / })).toHaveCount(4)
  await fichaModo(page, 'Ler')
  const arvore = page.getByRole('list', { name: 'Árvore de Os Graus' })
  await expect(arvore.getByText('Nível 4')).toBeVisible()
  await expect(arvore).toContainText('pede Segundo grau')

  // Kael aprende o Segundo grau (sem o Primeiro) numa cena do meio.
  await page.getByRole('button', { name: 'Voltar para a lista' }).click()
  await page.getByRole('region', { name: 'Lista de fichas' }).getByRole('button', { name: /^Kael/ }).first().click()
  await fichaModo(page, 'Ler')
  await page.getByRole('button', { name: 'Bloco', exact: true }).click()
  await page.getByRole('group', { name: 'Acrescentar bloco' }).getByRole('button', { name: 'Poderes' }).click()
  const editando = page.getByRole('group', { name: 'Editando: Poderes' })
  await editando.getByRole('checkbox', { name: 'Segundo grau' }).check()
  const cena = editando.getByRole('combobox', { name: 'Aprende Segundo grau em' })
  await cena.selectOption({ index: 3 })
  const titulo = (await cena.locator('option:checked').textContent())!.replace(/^\d+\.\s*/, '')
  await editando.getByRole('button', { name: 'Pronto' }).click()

  const poderes = page.getByRole('region', { name: 'Poderes' })
  await expect(poderes.getByRole('listitem', { name: 'Segundo grau, tem' })).toContainText(`aprende em “${titulo}”`)
  await expect(poderes.getByRole('list', { name: 'O que não fecha nos poderes' })).toContainText('antes de “Primeiro grau”')

  // Antes da cena, ainda não tem.
  const regua = page.getByRole('combobox', { name: 'Até onde na história' })
  await regua.selectOption({ index: 1 })
  await expect(poderes.getByRole('listitem', { name: 'Segundo grau, ainda não' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('sem sistema ainda: o personagem acha os Poderes no "+ Bloco" e cria o sistema ali mesmo', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await page.getByRole('button', { name: 'Mundo', exact: true }).first().click()
  await page.getByRole('region', { name: 'Lista de fichas' }).getByRole('button', { name: /^Kael/ }).first().click()
  await fichaModo(page, 'Ler')
  await page.getByRole('button', { name: 'Bloco', exact: true }).click()
  await page.getByRole('group', { name: 'Acrescentar bloco' }).getByRole('button', { name: 'Poderes' }).click()
  const novo = page.getByRole('group', { name: 'Criar o sistema de poderes' })
  await novo.getByRole('textbox', { name: 'Nome do sistema' }).fill('Marés')
  await novo.getByRole('button', { name: 'Elementos' }).click()
  // O sistema nasceu: já dá para marcar o que o Kael tem.
  const editando = page.getByRole('group', { name: 'Editando: Poderes' })
  await editando.getByRole('checkbox', { name: 'Água' }).check()
  await editando.getByRole('button', { name: 'Pronto' }).click()
  await expect(page.getByRole('region', { name: 'Poderes' }).getByRole('listitem', { name: 'Água, tem' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Poderes' })).toContainText('Marés')
})
