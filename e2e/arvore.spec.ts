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
  await expect(arvore.locator('.ftree ul ul').getByRole('button', { name: 'Abrir a ficha Metálicos' })).toBeVisible()

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

test('Ligações ganha quadros: Família à vista, Árvores e Diplomacia com cores e texto', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await expect(page.getByRole('navigation', { name: 'Áreas' })).toBeVisible()
  await nav(page, 'Mundo').click()
  // Uma ligação entre duas facções/reinos, pela ficha.
  await page.getByRole('button', { name: /^Casa de Vaelor/ }).first().click()
  await page.getByRole('combobox', { name: 'Nova ligação' }).fill('em guerra com')
  await page.getByRole('combobox', { name: 'Com' }).fill('Reino de Ostria')
  await page.getByRole('option', { name: /^Reino de Ostria/ }).first().click()
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click()

  await page.locator('[data-tour="partes"]').getByRole('button', { name: 'Ligações' }).click()
  const modos = page.getByRole('group', { name: 'Ver as ligações como' })
  await expect(modos.getByRole('button', { name: 'Mural' })).toHaveAttribute('aria-pressed', 'true')

  await modos.getByRole('button', { name: 'Diplomacia' }).click()
  await expect(page.getByRole('img', { name: /Quadro de diplomacia/ })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Legenda' })).toContainText('Guerra e rivalidade')
  await expect(page.locator('.dip-list')).toContainText('Casa de Vaelor em guerra com Reino de Ostria')

  await modos.getByRole('button', { name: 'Árvores' }).click()
  await page.getByRole('combobox', { name: 'Árvore de' }).selectOption({ label: 'Reino de Ostria' })
  await expect(page.locator('.ftree').getByRole('button', { name: 'Abrir a ficha Ostria', exact: true })).toBeVisible()

  await modos.getByRole('button', { name: 'Família' }).click()
  await expect(page.locator('.family')).toBeVisible()

  // A escolha fica: ao voltar a Ligações, abre na última.
  await page.reload()
  await nav(page, 'Mundo').click()
  await page.locator('[data-tour="partes"]').getByRole('button', { name: 'Ligações' }).click()
  await expect(modos.getByRole('button', { name: 'Família' })).toHaveAttribute('aria-pressed', 'true')
})
