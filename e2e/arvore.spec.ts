import { expect, test } from './fixtures.ts'
import { fichaModo } from './areas.ts'

const nav = (page: import('@playwright/test').Page, name: string) => page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name, exact: true })

test('árvore: criar pela grade, galhos com o +, mover, e a seção na ficha', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await expect(page.getByRole('navigation', { name: 'Áreas' })).toBeVisible()
  await nav(page, 'Mundo').click()
  await page.locator('[data-tour="partes"]').getByRole('button', { name: 'Fichas' }).click()
  const grade = page.getByRole('region', { name: 'O que vamos criar hoje?' })
  if (!(await grade.getByRole('button', { name: 'Árvore' }).isVisible())) await grade.getByRole('button', { name: 'O que vamos criar hoje?' }).click()
  await grade.getByRole('button', { name: 'Árvore' }).click()

  // 1. A ficha do alto: não existe ainda, então cria ali mesmo.
  const janela = page.getByRole('dialog', { name: 'Criar uma árvore' })
  await janela.getByRole('combobox', { name: 'Ficha do alto da árvore' }).fill('Dragões')
  await janela.getByRole('option', { name: /Criar “Dragões”/ }).click()
  const arvore = page.getByRole('dialog', { name: 'Árvore: Dragões' })
  await expect(arvore.getByText('Ainda sem galhos')).toBeVisible()

  // 2. Dois galhos pelo +.
  // O campo continua aberto depois de criar: dá para fazer vários seguidos.
  await arvore.getByRole('button', { name: 'Novo galho em Dragões' }).click()
  for (const nome of ['Cromáticos', 'Metálicos']) {
    await arvore.getByRole('textbox', { name: 'Nome do novo galho em Dragões' }).fill(nome)
    await arvore.getByRole('button', { name: 'Criar', exact: true }).click()
    await expect(arvore.getByRole('button', { name: `Abrir a ficha ${nome}` })).toBeVisible()
  }
  await expect(arvore.getByText('2 galhos abaixo de Dragões')).toBeVisible()

  // 3. Mover Metálicos para dentro de Cromáticos.
  await arvore.getByRole('button', { name: 'Mover Metálicos' }).click()
  await arvore.getByRole('combobox', { name: 'Mover Metálicos para dentro de' }).fill('Cromát')
  await arvore.getByRole('option', { name: /Cromáticos/ }).click()
  await expect(arvore.getByText('2 galhos abaixo de Dragões')).toBeVisible()
  await expect(arvore.locator('.tree ul ul').getByRole('button', { name: 'Abrir a ficha Metálicos' })).toBeVisible()

  // 4. Tirar solta o galho, mas a ficha continua.
  await arvore.getByRole('button', { name: 'Tirar Metálicos da árvore' }).click()
  await expect(arvore.getByText('1 galho abaixo de Dragões')).toBeVisible()

  // 5. Na leitura da ficha, a seção "Árvore" mostra o galho, e abrir a ficha de um galho funciona.
  await arvore.getByRole('button', { name: 'Abrir Dragões', exact: true }).click()
  await fichaModo(page, 'Ler')
  const secao = page.getByRole('region', { name: 'Árvore' })
  await expect(secao.getByRole('button', { name: 'Cromáticos' })).toBeVisible()
  await expect(secao.getByRole('button', { name: 'Ver e editar como árvore' })).toBeVisible()
})
